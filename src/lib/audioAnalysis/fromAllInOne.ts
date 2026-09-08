/**
 * All-In-One Music Structure Analysis（Replicate / allin1）の JSON →
 * StructureResultV2 / AudioAnalysisResult への変換。
 *
 * モデル出力例（mir-aidj/all-in-one）:
 * { bpm, beats[], downbeats[], segments: [{ start, end, label }] }
 */

import type {
  AudioAnalysisResult,
  BeatInfo,
  MusicSection,
  SectionType,
} from "../../types/audioAnalysis";
import type {
  ChangePointV2,
  SectionLabelV2,
  SongSectionV2,
  StructureResultV2,
} from "../choreocore/types/songStructure";
import { cleanseMusicSections } from "./cleanseSections";
import { applyDownbeatSnapToAnalysis } from "./snapToDownbeat";
import { mapLabelToSectionType, sectionDisplayMeta } from "./sectionMeta";
import { logAudioAnalysisEngine } from "./evenBeatGrid";
import { musicSectionFromRaw } from "./fromStructureV2";

export type AllInOneSegment = {
  start: number;
  end: number;
  label: string;
};

export type AllInOneRawResult = {
  bpm?: number;
  duration?: number;
  beats?: number[];
  downbeats?: number[];
  segments?: AllInOneSegment[];
  /** 一部実装は sections キー */
  sections?: AllInOneSegment[];
  path?: string;
};

/** 英語ラベル → 日本語表示（ダンサー向け） */
export function japaneseLabelForAllInOne(raw: string): string {
  const u = raw.trim().toUpperCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (u === "INTRO") return "イントロ";
  if (u === "VERSE" || u === "A_MELO") return "Aメロ";
  if (u === "PRE_CHORUS" || u === "PRECHORUS" || u === "B_MELO") return "Bメロ";
  if (u === "CHORUS" || u === "REFRAIN") return "サビ";
  if (u === "INTERLUDE" || u === "INST" || u === "INSTRUMENTAL") return "間奏";
  if (u === "BRIDGE") return "Cメロ";
  if (u === "BREAK" || u === "BREAKDOWN") return "ブレイク";
  if (u === "OUTRO" || u === "ENDING") return "アウトロ";
  if (u === "SOLO") return "ソロ";
  return sectionDisplayMeta(mapLabelToSectionType(raw)).label;
}

export function mapAllInOneLabelToV2(raw: string): SectionLabelV2 {
  const t = mapLabelToSectionType(raw);
  if (t === "intro") return "INTRO";
  if (t === "outro") return "OUTRO";
  if (t === "chorus") return "CHORUS";
  if (t === "bridge") return "BREAKDOWN";
  if (t === "pre_chorus") return "B_MELO";
  return "A_MELO";
}

/** AI beats + downbeats → BeatInfo（ダウンビートは正確な時刻を優先） */
export function beatInfosFromAllInOne(
  beats: number[],
  downbeats: number[],
  duration: number
): BeatInfo[] {
  const beatTimes = [...beats]
    .filter((t) => Number.isFinite(t) && t >= 0 && (duration <= 0 || t <= duration + 0.05))
    .sort((a, b) => a - b);
  const dbSet = new Set(
    downbeats
      .filter((t) => Number.isFinite(t) && t >= 0)
      .map((t) => Math.round(t * 1000) / 1000)
  );

  // ダウンビート近傍マッチ（±40ms）
  const isNearDownbeat = (t: number) => {
    const r = Math.round(t * 1000) / 1000;
    if (dbSet.has(r)) return true;
    for (const d of dbSet) {
      if (Math.abs(d - r) <= 0.04) return true;
    }
    return false;
  };

  if (beatTimes.length === 0 && downbeats.length > 0) {
    return downbeats
      .filter((t) => Number.isFinite(t) && t >= 0)
      .sort((a, b) => a - b)
      .map((t) => ({
        timestamp: Math.round(t * 1000) / 1000,
        isDownbeat: true,
        beatNumber: 1,
      }));
  }

  let beatInCycle = 0;
  let seenDownbeat = false;
  const out: BeatInfo[] = [];
  for (const t of beatTimes) {
    const down = isNearDownbeat(t);
    if (down) {
      beatInCycle = 0;
      seenDownbeat = true;
    }
    out.push({
      timestamp: Math.round(t * 1000) / 1000,
      isDownbeat: down || (!seenDownbeat && beatInCycle % 8 === 0),
      beatNumber: (beatInCycle % 8) + 1,
    });
    beatInCycle += 1;
  }
  return out;
}

function parseSegments(raw: AllInOneRawResult): AllInOneSegment[] {
  const list = raw.segments ?? raw.sections ?? [];
  return list
    .map((s) => ({
      start: Number((s as AllInOneSegment).start),
      end: Number((s as AllInOneSegment).end),
      label: String((s as AllInOneSegment).label ?? "verse"),
    }))
    .filter(
      (s) =>
        Number.isFinite(s.start) &&
        Number.isFinite(s.end) &&
        s.end > s.start
    )
    .sort((a, b) => a.start - b.start);
}

function estimateDuration(raw: AllInOneRawResult, segments: AllInOneSegment[]): number {
  if (raw.duration && raw.duration > 0) return raw.duration;
  const fromSeg = segments.length ? segments[segments.length - 1]!.end : 0;
  const fromBeats = raw.beats?.length
    ? Math.max(...raw.beats.filter(Number.isFinite))
    : 0;
  const fromDb = raw.downbeats?.length
    ? Math.max(...raw.downbeats.filter(Number.isFinite))
    : 0;
  return Math.max(fromSeg, fromBeats, fromDb, 1);
}

/** All-In-One raw → StructureResultV2（Fly / Edge キャッシュ互換） */
export function structureV2FromAllInOne(
  raw: AllInOneRawResult,
  opts?: { source?: string }
): StructureResultV2 | null {
  const segments = parseSegments(raw);
  if (segments.length === 0) return null;

  const duration = estimateDuration(raw, segments);
  const bpm = raw.bpm && raw.bpm > 0 ? raw.bpm : 120;
  const beats = (raw.beats ?? []).filter((t) => Number.isFinite(t) && t >= 0);
  const downbeats = (raw.downbeats ?? []).filter(
    (t) => Number.isFinite(t) && t >= 0
  );

  const eight_times =
    downbeats.length > 0
      ? [...downbeats].sort((a, b) => a - b)
      : beats.filter((_, i) => i % 8 === 0);

  const sections: SongSectionV2[] = segments.map((seg, i) => {
    const label = mapAllInOneLabelToV2(seg.label);
    const start_eight = eight_times.findIndex((t) => t >= seg.start - 1e-3);
    const end_eight = eight_times.findIndex((t) => t >= seg.end - 1e-3);
    return {
      label,
      start_eight: start_eight >= 0 ? start_eight : i,
      end_eight: end_eight > start_eight ? end_eight : start_eight + 1,
      start_time: seg.start,
      end_time: Math.min(duration, seg.end),
      cluster_id: i,
      mean_energy: label === "CHORUS" ? 0.85 : 0.45,
      energy_trend: 0,
      repeat_count: 1,
      confidence: 0.9,
    };
  });

  const change_points: ChangePointV2[] = sections.map((s) => ({
    time: s.start_time,
    eight_index: s.start_eight,
    type: s.label === "CHORUS" ? "CHORUS_START" : s.label,
    is_major: s.label === "CHORUS" || s.label === "INTRO" || s.label === "OUTRO",
    confidence: s.confidence,
    note: "all-in-one",
  }));

  return {
    bpm,
    duration,
    eight_times,
    sections,
    change_points,
    source: opts?.source ?? "all-in-one",
    beats,
    downbeats,
  };
}

/** All-In-One → UI 用 AudioAnalysisResult（スナップ＋クレンジング） */
export function audioAnalysisFromAllInOne(
  raw: AllInOneRawResult,
  opts?: { cleanse?: boolean; applySnap?: boolean }
): AudioAnalysisResult | null {
  const v2 = structureV2FromAllInOne(raw);
  if (!v2) return null;

  const beatInfos = beatInfosFromAllInOne(
    v2.beats ?? [],
    v2.downbeats ?? [],
    v2.duration
  );

  let sections: MusicSection[] = parseSegments(raw).map((seg) => {
    const type: SectionType = mapLabelToSectionType(seg.label);
    return musicSectionFromRaw({
      type,
      startTime: seg.start,
      endTime: Math.min(v2.duration, seg.end),
      label: japaneseLabelForAllInOne(seg.label),
      bpm: v2.bpm,
    });
  });

  if (opts?.cleanse !== false) {
    sections = cleanseMusicSections(sections, {
      duration: v2.duration,
      bpm: v2.bpm,
    });
  }

  let analysis: AudioAnalysisResult = {
    duration: v2.duration,
    beats: beatInfos,
    sections,
    sourceLabel: "all-in-one",
    bpm: v2.bpm,
  };

  if (opts?.applySnap !== false && beatInfos.some((b) => b.isDownbeat)) {
    analysis = applyDownbeatSnapToAnalysis(analysis);
    if (opts?.cleanse !== false) {
      analysis = {
        ...analysis,
        sections: cleanseMusicSections(analysis.sections, {
          duration: analysis.duration,
          bpm: v2.bpm,
        }),
      };
    }
  }

  logAudioAnalysisEngine({
    engine: "all-in-one",
    bpm: v2.bpm,
    beatsCount: analysis.beats.length,
    sectionsCount: analysis.sections.length,
    sourceLabel: "all-in-one",
  });

  return analysis;
}

/** 開発・テスト用モック（Replicate 未設定時のデモ） */
export function mockAllInOneRawResult(durationSec = 96): AllInOneRawResult {
  const bpm = 120;
  const spb = 60 / bpm;
  const beats: number[] = [];
  const downbeats: number[] = [];
  for (let i = 0; i * spb <= durationSec; i += 1) {
    const t = Math.round(i * spb * 1000) / 1000;
    beats.push(t);
    if (i % 8 === 0) downbeats.push(t);
  }
  const segments: AllInOneSegment[] = [
    { start: 0, end: 8, label: "intro" },
    { start: 8, end: 24, label: "verse" },
    { start: 24, end: 32, label: "pre-chorus" },
    { start: 32, end: 48, label: "chorus" },
    { start: 48, end: 56, label: "verse" },
    { start: 56, end: 64, label: "bridge" },
    { start: 64, end: 80, label: "chorus" },
    { start: 80, end: durationSec, label: "outro" },
  ].filter((s) => s.start < durationSec);
  return { bpm, duration: durationSec, beats, downbeats, segments };
}
