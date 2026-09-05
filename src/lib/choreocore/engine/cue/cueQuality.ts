/**
 * Stage 4: 既存 Cue 出力の評価。Cue Engine / Formation は変更しない。
 * 分類は既存 FormationCue の isMajor / action / reasonCodes を読むだけ。
 *
 * MAJOR = isMajor
 * MICRO = MICRO_SHIFT or ANTICIPATION
 * PREPARATION = ANTICIPATION / PREPARATION / PHRASE_PREPARATION / SECTION_PRE_CHORUS
 * SECTION = SECTION_* / SECTION_CHANGE
 * HIT = HIT
 */

import type { CueAnalysisResult, FormationCue } from "../types/CueTypes";
import type {
  EventCluster,
  MusicSection,
} from "../types/MusicTypes";
import type { MusicAnalysisSource } from "../music/productionTimeline";
import { DEFAULT_CUE_ENGINE_CONFIG } from "./cueConfig";

export type CueHumanRating = "good" | "acceptable" | "wrong";

export type CueKind = "major" | "micro" | "preparation" | "section" | "hit" | "hold";

export type CueQualityRow = {
  cueId: string;
  cueTime: number;
  eventTime: number | null;
  timingDeltaMs: number | null;
  beatTime: number | null;
  beatOffsetMs: number | null;
  beatDistance: number | null;
  barTime: number | null;
  barDistance: number | null;
  isMajor: boolean;
  kinds: CueKind[];
  action: FormationCue["action"];
  reasonCodes: string[];
  sourceEventId: string;
  sourceChangePointIds: string[];
  sourceEventType: string | null;
  sourceTimestamp: number | null;
  sourceConfidence: number | null;
  confidence: number;
  suppressed: boolean;
  humanRating?: CueHumanRating;
};

export type CueQualityReport = {
  source?: MusicAnalysisSource;
  cueCount: number;
  activeCount: number;
  majorCount: number;
  microCount: number;
  preparationCount: number;
  preChorusSec: number | null;
  chorusStartSec: number | null;
  preChorusBeforeChorus: boolean;
  timestamps: number[];
  interCueIntervalsSec: number[];
  duplicateSourceIds: string[];
  nearDuplicatePairs: number;
  meanConfidence: number;
  rows: CueQualityRow[];
};

export type CueQualityComparison = {
  legacy: CueQualityReport;
  real: CueQualityReport;
  delta: {
    cueCount: number;
    majorCount: number;
    microCount: number;
    preChorusSec: number | null;
    chorusStartSec: number | null;
  };
};

export function classifyCueKinds(cue: FormationCue): CueKind[] {
  const kinds: CueKind[] = [];
  if (cue.isMajor) kinds.push("major");
  if (
    cue.action === "MICRO_SHIFT" ||
    cue.reasonCodes.includes("ANTICIPATION")
  ) {
    kinds.push("micro");
  }
  if (
    cue.reasonCodes.includes("ANTICIPATION") ||
    cue.reasonCodes.includes("PREPARATION") ||
    cue.reasonCodes.includes("PHRASE_PREPARATION") ||
    cue.reasonCodes.includes("SECTION_PRE_CHORUS")
  ) {
    kinds.push("preparation");
  }
  if (
    cue.reasonCodes.includes("SECTION_CHANGE") ||
    cue.reasonCodes.some((r) => r.startsWith("SECTION_"))
  ) {
    kinds.push("section");
  }
  if (cue.reasonCodes.includes("HIT")) kinds.push("hit");
  if (cue.action === "HOLD") kinds.push("hold");
  return kinds;
}

function chorusStartSec(sections: MusicSection[]): number | null {
  const chorus = sections.find(
    (s) => s.type === "CHORUS" || s.type === "FINAL_CHORUS"
  );
  return chorus ? chorus.startTime : null;
}

function preChorusSec(sections: MusicSection[]): number | null {
  const chorus = chorusStartSec(sections);
  const pres = sections
    .filter((s) => s.type === "PRE_CHORUS")
    .sort((a, b) => a.startTime - b.startTime);
  if (!pres.length) return null;
  if (chorus == null) return pres[0]!.startTime;
  const valid = pres.find((s) => s.startTime < chorus - 1e-6);
  return valid ? valid.startTime : null;
}

export function evaluateCueQuality(input: {
  analysis: CueAnalysisResult;
  sections: MusicSection[];
  eventClusters: EventCluster[];
  bpm?: number;
  source?: MusicAnalysisSource;
}): CueQualityReport {
  const clusterById = new Map(
    input.eventClusters.map((c) => [c.id, c] as const)
  );
  const bpm = input.bpm && input.bpm > 0 ? input.bpm : 120;
  const beatPeriod = 60 / bpm;
  const barPeriod = beatPeriod * 4;
  const mergeWindow = DEFAULT_CUE_ENGINE_CONFIG.clusterMergeWindowSeconds;
  const rows: CueQualityRow[] = input.analysis.cues.map((cue) => {
    const cluster = clusterById.get(cue.sourceEventClusterId) ?? null;
    const eventTime = cluster?.time ?? null;
    const timingDeltaMs =
      eventTime == null ? null : (cue.rawTime - eventTime) * 1000;
    const beatOffsetMs =
      cue.beatTime == null ? null : (cue.rawTime - cue.beatTime) * 1000;
    const beatDistance =
      cue.beatTime == null ? null : (cue.rawTime - cue.beatTime) / beatPeriod;
    const barDistance =
      cue.barTime == null ? null : (cue.rawTime - cue.barTime) / barPeriod;
    return {
      cueId: cue.id,
      cueTime: cue.rawTime,
      eventTime,
      timingDeltaMs,
      beatTime: cue.beatTime,
      beatOffsetMs,
      beatDistance,
      barTime: cue.barTime,
      barDistance,
      isMajor: cue.isMajor,
      kinds: classifyCueKinds(cue),
      action: cue.action,
      reasonCodes: cue.reasonCodes.slice(),
      sourceEventId: cue.sourceEventClusterId,
      sourceChangePointIds: cue.sourceChangePointIds.slice(),
      sourceEventType: cluster?.dominantType ?? null,
      sourceTimestamp: eventTime,
      sourceConfidence: cluster?.confidence ?? null,
      confidence: cue.confidence,
      suppressed: cue.suppressed,
    };
  });

  const active = rows
    .filter((r) => !r.suppressed)
    .sort((a, b) => a.cueTime - b.cueTime || a.cueId.localeCompare(b.cueId));
  const timestamps = active.map((r) => r.cueTime);
  const interCueIntervalsSec: number[] = [];
  let nearDuplicatePairs = 0;
  for (let i = 1; i < active.length; i += 1) {
    const gap = active[i]!.cueTime - active[i - 1]!.cueTime;
    interCueIntervalsSec.push(gap);
    const aHold = active[i - 1]!.action === "HOLD";
    const bHold = active[i]!.action === "HOLD";
    if (!aHold && !bHold && gap <= mergeWindow) nearDuplicatePairs += 1;
  }

  const sourceCounts = new Map<string, number>();
  for (const row of active) {
    if (row.reasonCodes.includes("ANTICIPATION")) continue;
    sourceCounts.set(row.sourceEventId, (sourceCounts.get(row.sourceEventId) ?? 0) + 1);
  }
  const duplicateSourceIds = [...sourceCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));

  const chorus = chorusStartSec(input.sections);
  const pre = preChorusSec(input.sections);
  const preChorusBeforeChorus =
    pre == null || chorus == null || pre < chorus - 1e-6;

  const meanConfidence =
    active.length === 0
      ? 0
      : active.reduce((s, r) => s + r.confidence, 0) / active.length;

  return {
    source: input.source,
    cueCount: rows.length,
    activeCount: active.length,
    majorCount: active.filter((r) => r.isMajor).length,
    microCount: active.filter((r) => r.kinds.includes("micro")).length,
    preparationCount: active.filter((r) => r.kinds.includes("preparation")).length,
    preChorusSec: pre,
    chorusStartSec: chorus,
    preChorusBeforeChorus,
    timestamps,
    interCueIntervalsSec,
    duplicateSourceIds,
    nearDuplicatePairs,
    meanConfidence,
    rows,
  };
}

export function compareCueQuality(
  legacy: CueQualityReport,
  real: CueQualityReport
): CueQualityComparison {
  return {
    legacy,
    real,
    delta: {
      cueCount: real.cueCount - legacy.cueCount,
      majorCount: real.majorCount - legacy.majorCount,
      microCount: real.microCount - legacy.microCount,
      preChorusSec:
        real.preChorusSec != null && legacy.preChorusSec != null
          ? real.preChorusSec - legacy.preChorusSec
          : null,
      chorusStartSec:
        real.chorusStartSec != null && legacy.chorusStartSec != null
          ? real.chorusStartSec - legacy.chorusStartSec
          : null,
    },
  };
}

export function cuesAreTimeOrdered(cues: FormationCue[]): boolean {
  let prev = -Infinity;
  for (const cue of cues) {
    if (cue.suppressed) continue;
    if (cue.rawTime + 1e-9 < prev) return false;
    prev = cue.rawTime;
  }
  return true;
}
