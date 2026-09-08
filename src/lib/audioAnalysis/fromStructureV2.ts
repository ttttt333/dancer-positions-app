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
import { cleanseMusicSections } from "./cleanseSections";
import {
  buildEvenBeatGrid,
  inferTempoFromEightTimes,
  logAudioAnalysisEngine,
} from "./evenBeatGrid";

function newSectionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Phase1 BeatEvent → BeatInfo（参考用。表示グリッドは BPM 均等を優先） */
export function beatsFromBeatEvents(events: BeatEvent[]): BeatInfo[] {
  return events.map((b) => ({
    timestamp: b.time,
    isDownbeat: b.beatInBar === 0,
    beatNumber: (b.beatInBar % 8) + 1,
  }));
}

/**
 * @deprecated 不揃い eight_times を分割するとグリッドが歪む。
 * 新規は `buildEvenBeatGrid` / `beatsFromTempo` を使う。
 */
export function beatsFromEightTimes(
  eightTimes: number[],
  duration: number,
  beatsPerEight = 8
): BeatInfo[] {
  const inferred = inferTempoFromEightTimes(eightTimes);
  if (inferred) {
    return buildEvenBeatGrid({
      bpm: inferred.bpm,
      duration,
      firstDownbeatTime: inferred.firstDownbeatTime,
      beatsPerCycle: beatsPerEight,
    });
  }
  return buildEvenBeatGrid({
    bpm: 120,
    duration,
    firstDownbeatTime: 0,
    beatsPerCycle: beatsPerEight,
  });
}

/** BPM ベースの均等グリッド（推奨） */
export function beatsFromTempo(opts: {
  bpm: number;
  duration: number;
  firstDownbeatTime?: number;
}): BeatInfo[] {
  return buildEvenBeatGrid({
    bpm: opts.bpm,
    duration: opts.duration,
    firstDownbeatTime: opts.firstDownbeatTime ?? 0,
    beatsPerCycle: 8,
  });
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

function resolveTempoFromV2(v2: StructureResultV2): {
  bpm: number;
  firstDownbeatTime: number;
} {
  const inferred = v2.eight_times?.length
    ? inferTempoFromEightTimes(v2.eight_times)
    : null;
  const bpm =
    v2.bpm > 0 ? v2.bpm : inferred?.bpm && inferred.bpm > 0 ? inferred.bpm : 120;
  const firstDownbeatTime =
    inferred?.firstDownbeatTime ??
    (v2.eight_times?.[0] != null && Number.isFinite(v2.eight_times[0])
      ? v2.eight_times[0]
      : 0);
  return { bpm, firstDownbeatTime };
}

/** StructureResultV2 → AudioAnalysisResult（均等グリッド＋セクションクレンジング） */
export function audioAnalysisFromStructureV2(
  v2: StructureResultV2,
  opts?: { applySnap?: boolean; cleanse?: boolean }
): AudioAnalysisResult {
  const duration = v2.duration > 0 ? v2.duration : 0;
  const { bpm, firstDownbeatTime } = resolveTempoFromV2(v2);
  const beats = beatsFromTempo({ bpm, duration, firstDownbeatTime });

  let sections: MusicSection[] = (v2.sections ?? []).map((s) => {
    const type = mapLabelToSectionType(s.label);
    return musicSectionFromRaw({
      type,
      startTime: s.start_time,
      endTime: s.end_time,
      bpm,
    });
  });

  if (opts?.cleanse !== false) {
    sections = cleanseMusicSections(sections, { duration, bpm });
  }

  const raw: AudioAnalysisResult = {
    duration,
    beats,
    sections,
    sourceLabel: v2.source ?? "structure-v2",
    bpm,
  };

  const final =
    opts?.applySnap === false ? raw : applyDownbeatSnapToAnalysis(raw);

  if (opts?.cleanse !== false) {
    final.sections = cleanseMusicSections(final.sections, {
      duration: final.duration,
      bpm,
    });
  }

  logAudioAnalysisEngine({
    engine: v2.source ?? "structure-v2",
    bpm,
    beatsCount: final.beats.length,
    sectionsCount: final.sections.length,
    sourceLabel: final.sourceLabel,
  });

  return final;
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
