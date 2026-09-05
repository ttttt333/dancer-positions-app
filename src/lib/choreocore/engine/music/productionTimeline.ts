/**
 * 本番が扱う音楽タイムラインの契約（Stage 3 の接続面）。
 *
 * Change Point = 変化が起きた時刻。
 * Musical Event = その変化が何を意味するか（既存 ChangePoint.type / section.type）。
 *
 * Accuracy 型（MusicAccuracy*）は Stage 6 用の空契約。Stage 2 は使わない。
 */

import type {
  BeatEvent,
  ChangePoint,
  EnergyCurve,
  EventCluster,
  HitEvent,
  MusicPhrase,
  MusicSection,
  MusicStructureAnalysisResult,
  Phase1Provenance,
} from "../types";
import { STRUCTURE_ANALYSIS_VERSION } from "./structureConfig";

export type MusicAnalysisSource =
  | "engine-phase12"
  | "fly"
  | "browser"
  | "synthetic-legacy";

export type Phase2OverwriteSite =
  | "overlaySectionsFromChangePoints"
  | "clustersFromRemoteChangePoints";

export type Phase2FallbackReason =
  | "flag-off"
  | "missing-cache-key"
  | "cache-miss"
  | "wrong-provenance"
  | "version-mismatch"
  | "invalid-phase1"
  | "phase2-error"
  | "empty-phase2"
  | "invalid-phase2"
  | "timeline-invalid"
  | "adapter-failure";

/**
 * Phase1 / Phase2 / Remote / Browser が最終的に揃える共通契約。
 * FLAG ON の本番境界。Cue Engine は timelineToMusicStructure() 経由でこれを読む。
 *
 * Duplicate policy: primary-only。
 * Real Phase2 が有効なときは remote/browser を sections / eventClusters に混ぜない・上書きしない。
 * 近い時刻でも id / type が違うイベントは同一視して消さない。
 */
export type UnifiedMusicTimeline = {
  beats: BeatEvent[];
  sections: MusicSection[];
  phrases: MusicPhrase[];
  changePoints: ChangePoint[];
  eventClusters: EventCluster[];
  hits: HitEvent[];
  energyCurve?: EnergyCurve["points"];
  confidence: number;
  source: MusicAnalysisSource;
  analysisVersion: string;
  phase1Provenance: Phase1Provenance;
};

export type PreChorusSource = "phase2" | "legacy-heuristic" | "none";

export type FinalizedProductionTimeline = {
  ok: true;
  timeline: UnifiedMusicTimeline;
  preChorusSource: PreChorusSource;
} | {
  ok: false;
  reason: Phase2FallbackReason;
};

/** 同一ソース内の並び。既存 ChangePointDetector と同じ time → type。 */
function cmpTimeTypeId(
  a: { time: number; id: string; type?: string },
  b: { time: number; id: string; type?: string }
): number {
  const t = a.time - b.time;
  if (t !== 0) return t;
  const typeCmp = (a.type ?? "").localeCompare(b.type ?? "");
  if (typeCmp !== 0) return typeCmp;
  return a.id.localeCompare(b.id);
}

function cmpStartId(
  a: { startTime: number; id: string },
  b: { startTime: number; id: string }
): number {
  const t = a.startTime - b.startTime;
  if (t !== 0) return t;
  return a.id.localeCompare(b.id);
}

export function sortTimelineArrays(timeline: UnifiedMusicTimeline): UnifiedMusicTimeline {
  return {
    ...timeline,
    beats: [...timeline.beats].sort((a, b) => a.time - b.time || a.index - b.index),
    sections: [...timeline.sections].sort(cmpStartId),
    phrases: [...timeline.phrases].sort(cmpStartId),
    changePoints: [...timeline.changePoints].sort(cmpTimeTypeId),
    eventClusters: [...timeline.eventClusters].sort(
      (a, b) => a.time - b.time || a.id.localeCompare(b.id)
    ),
    hits: [...timeline.hits].sort(
      (a, b) => a.time - b.time || a.id.localeCompare(b.id)
    ),
    energyCurve: timeline.energyCurve
      ? [...timeline.energyCurve].sort((a, b) => a.time - b.time)
      : timeline.energyCurve,
  };
}

function twoEightSec(bpm: number): number {
  return 16 * (60 / Math.max(1, bpm));
}

function isChorusSection(type: MusicSection["type"]): boolean {
  return type === "CHORUS" || type === "FINAL_CHORUS";
}

function makePreChorusSection(
  startTime: number,
  endTime: number,
  donor: MusicSection
): MusicSection {
  const dur = Math.max(0.25, endTime - startTime);
  return {
    id: `sec-PRE_CHORUS-${Math.round(startTime * 1000)}`,
    type: "PRE_CHORUS",
    startTime,
    endTime,
    startBar: donor.startBar,
    endBar: donor.startBar,
    barCount: Math.max(1, Math.round(dur / Math.max(0.5, (endTime - startTime) || 1))),
    energyMean: Math.max(20, donor.energyMean * 0.75),
    energyPeak: donor.energyPeak,
    energyDelta: 8,
    rhythmicDensity: donor.rhythmicDensity,
    spectralProfile: { ...donor.spectralProfile },
    confidence: 0.72,
  };
}

export function ensurePreChorusBeforeChorus(
  sections: MusicSection[],
  bpm: number
): { sections: MusicSection[]; source: PreChorusSource } {
  const sorted = [...sections].sort(cmpStartId);
  const chorus = sorted.find((s) => isChorusSection(s.type));
  if (!chorus) {
    return { sections: sorted, source: "none" };
  }
  const chorusStart = chorus.startTime;
  const validPre = sorted.filter(
    (s) => s.type === "PRE_CHORUS" && s.startTime < chorusStart - 1e-6
  );
  if (validPre.length > 0) {
    const next = sorted
      .map((s) => {
        if (s.type !== "PRE_CHORUS") return s;
        if (s.startTime >= chorusStart - 1e-6) return null;
        return { ...s, endTime: Math.min(s.endTime, chorusStart) };
      })
      .filter((s): s is MusicSection => s != null);
    return { sections: next.sort(cmpStartId), source: "phase2" };
  }

  const preStart = Math.max(0, chorusStart - twoEightSec(bpm));
  if (chorusStart - preStart < 0.25) {
    return {
      sections: sorted.filter(
        (s) => !(s.type === "PRE_CHORUS" && s.startTime >= chorusStart - 1e-6)
      ),
      source: "none",
    };
  }

  const donor =
    sorted.filter((s) => s.startTime < chorusStart).at(-1) ?? chorus;
  const pre = makePreChorusSection(preStart, chorusStart, donor);
  const out: MusicSection[] = [];
  let inserted = false;
  for (const s of sorted) {
    if (s.type === "PRE_CHORUS") continue;
    if (!inserted && s.startTime >= chorusStart - 1e-9) {
      out.push(pre);
      inserted = true;
    }
    if (s.endTime <= preStart + 1e-9) {
      out.push(s);
      continue;
    }
    if (s.startTime >= chorusStart - 1e-9) {
      out.push(s);
      continue;
    }
    if (s.startTime < preStart) {
      out.push({
        ...s,
        endTime: preStart,
        barCount: Math.max(1, s.barCount),
      });
      continue;
    }
    // overlap inside [preStart, chorus): drop tail, PRE_CHORUS covers it
  }
  if (!inserted) out.push(pre);
  return { sections: out.sort(cmpStartId), source: "legacy-heuristic" };
}

export function isUsableProductionTimeline(
  timeline: UnifiedMusicTimeline
): boolean {
  if (timeline.phase1Provenance !== "real") return false;
  if (timeline.source !== "engine-phase12") return false;
  if (!timeline.sections.length) return false;
  if (
    !Array.isArray(timeline.phrases) ||
    !Array.isArray(timeline.changePoints) ||
    !Array.isArray(timeline.eventClusters) ||
    !Array.isArray(timeline.hits)
  ) {
    return false;
  }
  const timesOk = timeline.sections.every(
    (s) =>
      Number.isFinite(s.startTime) &&
      Number.isFinite(s.endTime) &&
      s.endTime > s.startTime
  );
  return timesOk;
}

export function timelineToMusicStructure(
  timeline: UnifiedMusicTimeline
): MusicStructureAnalysisResult {
  return {
    sections: timeline.sections,
    phrases: timeline.phrases,
    hits: timeline.hits,
    changePoints: timeline.changePoints,
    eventClusters: timeline.eventClusters,
    confidence: timeline.confidence,
    analysisVersion: timeline.analysisVersion,
  };
}

export function finalizeProductionTimeline(
  timeline: UnifiedMusicTimeline,
  input: { bpm: number; duration?: number }
): FinalizedProductionTimeline {
  try {
    const sorted = sortTimelineArrays(timeline);
    const pre = ensurePreChorusBeforeChorus(
      sorted.sections,
      input.bpm > 0 ? input.bpm : 120
    );
    const next: UnifiedMusicTimeline = sortTimelineArrays({
      ...sorted,
      sections: pre.sections,
    });
    if (!isUsableProductionTimeline(next)) {
      return { ok: false, reason: "timeline-invalid" };
    }
    const chorus = next.sections.find((s) => isChorusSection(s.type));
    const badPre = next.sections.some(
      (s) =>
        s.type === "PRE_CHORUS" &&
        chorus != null &&
        s.startTime >= chorus.startTime - 1e-6
    );
    if (badPre) {
      return { ok: false, reason: "timeline-invalid" };
    }
    return { ok: true, timeline: next, preChorusSource: pre.source };
  } catch {
    return { ok: false, reason: "adapter-failure" };
  }
}

export function cloneMusicStructureResult(
  structure: MusicStructureAnalysisResult
): MusicStructureAnalysisResult {
  return {
    ...structure,
    sections: structure.sections.slice(),
    phrases: structure.phrases.slice(),
    hits: structure.hits.slice(),
    changePoints: structure.changePoints.slice(),
    eventClusters: structure.eventClusters.slice(),
  };
}

export function timelineFromPhase2(
  structure: MusicStructureAnalysisResult,
  beats: BeatEvent[],
  energyCurve: EnergyCurve["points"] | undefined,
  source: MusicAnalysisSource,
  phase1Provenance: Phase1Provenance
): UnifiedMusicTimeline {
  return {
    beats,
    sections: structure.sections,
    phrases: structure.phrases,
    changePoints: structure.changePoints,
    eventClusters: structure.eventClusters,
    hits: structure.hits,
    energyCurve,
    confidence: structure.confidence,
    source,
    analysisVersion: structure.analysisVersion || STRUCTURE_ANALYSIS_VERSION,
    phase1Provenance,
  };
}

/**
 * Intelligence Success 用。Integration Success（接続できた）とは別物。
 * 計測ランナーは Stage 6。Stage 2 の完了判定に使わない。
 */
export type MusicAccuracyExpected = {
  chorusStartSec?: number;
  preChorusSec?: number;
  dropSec?: number;
  majorTransitionSec?: number;
};

export type MusicAccuracyCase = {
  id: string;
  expected: MusicAccuracyExpected;
};

export type MusicAccuracyMetrics = {
  changePointTimingErrorMs?: number;
  sectionBoundaryErrorMs?: number;
  falsePositives?: number;
  falseNegatives?: number;
  preChorusTimingErrorMs?: number;
  chorusStartTimingErrorMs?: number;
};

export type MusicEngineTrace = {
  analysisSource: MusicAnalysisSource;
  analysisVersion: string;
  phase1DurationMs?: number;
  phase2DurationMs?: number;
  cacheHit: boolean;
  cacheMiss: boolean;
  fallbackReason?: string;
  changePointCount?: number;
  phase1CacheHit?: boolean;
  phase1Provenance?: Phase1Provenance;
  phase1AnalysisVersion?: string;
  phase2Executed?: boolean;
  phase2FallbackReason?: Phase2FallbackReason;
  phase2OverwriteSites?: Phase2OverwriteSite[];
};

let lastTrace: MusicEngineTrace | null = null;

export function recordMusicEngineTrace(trace: MusicEngineTrace): void {
  lastTrace = trace;
}

export function getLastMusicEngineTrace(): MusicEngineTrace | null {
  return lastTrace;
}

export function resetMusicEngineTrace(): void {
  lastTrace = null;
}

export function isRealPhase1Provenance(
  provenance: string | undefined
): boolean {
  return provenance === "real";
}
