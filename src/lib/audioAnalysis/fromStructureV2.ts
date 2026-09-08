/**
 * StructureResultV2 / BeatEvent → AudioAnalysisResult へのブリッジ。
 */

import type { BeatEvent } from "../choreocore/engine/types/AudioTypes";
import type { StructureResultV2 } from "../choreocore/types/songStructure";
import type {
  AudioAnalysisResult,
  BeatInfo,
  MusicSection,
  SectionType,
} from "../../types/audioAnalysis";
import { mapLabelToSectionType, sectionDisplayMeta } from "./sectionMeta";
import { applyDownbeatSnapToAnalysis } from "./snapToDownbeat";

function newSectionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Phase1 BeatEvent → BeatInfo（beatInBar === 0 をダウンビート） */
export function beatsFromBeatEvents(events: BeatEvent[]): BeatInfo[] {
  return events.map((b) => ({
    timestamp: b.time,
    isDownbeat: b.beatInBar === 0,
    beatNumber: (b.beatInBar % 8) + 1,
  }));
}

/**
 * 8カウント先頭時刻列 → BeatInfo。
 * 各 eight をダウンビートとし、間を等分して 1–8 を埋める（グリッド表示・マグネット用）。
 */
export function beatsFromEightTimes(
  eightTimes: number[],
  duration: number,
  beatsPerEight = 8
): BeatInfo[] {
  if (eightTimes.length === 0) return [];
  const sorted = [...eightTimes]
    .filter((t) => Number.isFinite(t) && t >= 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const out: BeatInfo[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const start = sorted[i]!;
    const next = sorted[i + 1];
    const end =
      next != null && next > start
        ? next
        : duration > start
          ? duration
          : start + (60 / 120) * beatsPerEight;
    const span = Math.max(1e-6, end - start);
    const step = span / beatsPerEight;
    for (let n = 0; n < beatsPerEight; n += 1) {
      const t = start + step * n;
      if (duration > 0 && t > duration + 1e-6) break;
      out.push({
        timestamp: t,
        isDownbeat: n === 0,
        beatNumber: n + 1,
      });
    }
  }
  return out;
}

export function musicSectionFromRaw(opts: {
  type: SectionType;
  startTime: number;
  endTime: number;
  bpm?: number;
  id?: string;
  label?: string;
}): MusicSection {
  const meta = sectionDisplayMeta(opts.type);
  return {
    id: opts.id ?? newSectionId(),
    type: opts.type,
    label: opts.label ?? meta.label,
    startTime: opts.startTime,
    endTime: opts.endTime,
    color: meta.color,
    bpm: opts.bpm,
  };
}

/** StructureResultV2 → AudioAnalysisResult（未スナップ） */
export function audioAnalysisFromStructureV2(
  v2: StructureResultV2,
  opts?: { applySnap?: boolean }
): AudioAnalysisResult {
  const duration = v2.duration > 0 ? v2.duration : 0;
  const beats =
    v2.eight_times?.length > 0
      ? beatsFromEightTimes(v2.eight_times, duration)
      : [];

  const sections: MusicSection[] = (v2.sections ?? []).map((s) => {
    const type = mapLabelToSectionType(s.label);
    return musicSectionFromRaw({
      type,
      startTime: s.start_time,
      endTime: s.end_time,
      bpm: v2.bpm > 0 ? v2.bpm : undefined,
    });
  });

  const raw: AudioAnalysisResult = {
    duration,
    beats,
    sections,
    sourceLabel: v2.source ?? "structure-v2",
    bpm: v2.bpm > 0 ? v2.bpm : undefined,
  };

  return opts?.applySnap === false ? raw : applyDownbeatSnapToAnalysis(raw);
}

/** AudioAnalysisResult.sections → 既存オーバーレイセグメント形 */
export function overlaySegmentsFromAnalysis(
  analysis: AudioAnalysisResult
): Array<{
  startSec: number;
  endSec: number;
  sectionType: string;
  label: string;
  color: string;
}> {
  const typeToEngine: Record<SectionType, string> = {
    intro: "INTRO",
    verse: "VERSE",
    pre_chorus: "PRE_CHORUS",
    chorus: "CHORUS",
    bridge: "BREAK",
    outro: "OUTRO",
    unknown: "UNKNOWN",
  };
  return analysis.sections.map((s) => ({
    startSec: s.startTime,
    endSec: s.endTime,
    sectionType: typeToEngine[s.type] ?? "UNKNOWN",
    label: s.label,
    color: s.color,
  }));
}
