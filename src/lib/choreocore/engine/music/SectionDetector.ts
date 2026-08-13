import type { FrequencyBandEnergy, MusicAnalysisResultPhase1 } from "../types";
import type {
  MusicSection,
  MusicSectionType,
  MusicStructureConfig,
} from "../types/MusicTypes";
import { clamp01 } from "../audio/signalMath";
import { DEFAULT_BEATS_PER_BAR } from "../constants";
import {
  type BeatSnapshot,
  cosineDistance,
  prefixSums,
  rangeMean,
  secondsPerBar,
  spectralVector,
  ensureBeatGrid,
  buildBeatSnapshots,
} from "./structureMath";

export type SectionBoundaryCandidate = {
  time: number;
  beatIndex: number;
  barIndex: number;
  score: number;
};

function bandMean(
  snaps: BeatSnapshot[],
  start: number,
  end: number
): FrequencyBandEnergy {
  const n = Math.max(1, end - start);
  let bass = 0;
  let lowMid = 0;
  let mid = 0;
  let highMid = 0;
  let high = 0;
  for (let i = start; i < end; i += 1) {
    const s = snaps[i]!;
    bass += s.bass;
    lowMid += s.lowMid;
    mid += s.mid;
    highMid += s.highMid;
    high += s.high;
  }
  return {
    bass: bass / n,
    lowMid: lowMid / n,
    mid: mid / n,
    highMid: highMid / n,
    high: high / n,
  };
}

function boundaryScoreAt(
  i: number,
  snaps: BeatSnapshot[],
  prefixes: {
    energy: Float64Array;
    onset: Float64Array;
    bass: Float64Array;
  },
  window: number,
  config: MusicStructureConfig
): number {
  const w = config.sectionBoundaryWeights;
  const beforeStart = Math.max(0, i - window);
  const afterEnd = Math.min(snaps.length, i + window);
  const eBefore = rangeMean(prefixes.energy, beforeStart, i);
  const eAfter = rangeMean(prefixes.energy, i, afterEnd);
  const oBefore = rangeMean(prefixes.onset, beforeStart, i);
  const oAfter = rangeMean(prefixes.onset, i, afterEnd);
  const bBefore = rangeMean(prefixes.bass, beforeStart, i);
  const bAfter = rangeMean(prefixes.bass, i, afterEnd);
  const specBefore = spectralVector(bandMean(snaps, beforeStart, i));
  const specAfter = spectralVector(bandMean(snaps, i, afterEnd));

  const energyChange = Math.min(100, Math.abs(eAfter - eBefore) * 1.2);
  const spectralChange = cosineDistance(specBefore, specAfter) * 100;
  const rhythmChange = Math.min(100, Math.abs(oAfter - oBefore) * 140);
  const bassChange = Math.min(100, Math.abs(bAfter - bBefore) * 160);
  const onsetChange = rhythmChange;
  const onBar = snaps[i]!.beatIndex % DEFAULT_BEATS_PER_BAR === 0 ? 70 : 15;
  const phraseStructureChange = onBar;

  return (
    energyChange * w.energyChange +
    spectralChange * w.spectralChange +
    rhythmChange * w.rhythmChange +
    bassChange * w.bassChange +
    onsetChange * w.onsetChange +
    phraseStructureChange * w.phraseStructureChange
  );
}

export function detectSectionBoundaries(
  phase1: MusicAnalysisResultPhase1,
  config: MusicStructureConfig,
  snaps?: BeatSnapshot[]
): SectionBoundaryCandidate[] {
  const snapshots = snaps ?? buildBeatSnapshots(phase1);
  if (snapshots.length < 8) return [];
  const window = 8;
  const prefixes = {
    energy: prefixSums(snapshots.map((s) => s.energy)),
    onset: prefixSums(snapshots.map((s) => s.onset)),
    bass: prefixSums(snapshots.map((s) => s.bass)),
  };
  const scores: number[] = snapshots.map((_, i) =>
    i < window || i > snapshots.length - window
      ? 0
      : boundaryScoreAt(i, snapshots, prefixes, window, config)
  );

  const raw: SectionBoundaryCandidate[] = [];
  for (let i = 1; i < scores.length - 1; i += 1) {
    const score = scores[i]!;
    if (score < config.sectionBoundaryThreshold) continue;
    if (score < scores[i - 1]! || score < scores[i + 1]!) continue;
    raw.push({
      time: snapshots[i]!.time,
      beatIndex: snapshots[i]!.beatIndex,
      barIndex: snapshots[i]!.barIndex,
      score,
    });
  }

  const minBeats = config.minimumSectionBars * DEFAULT_BEATS_PER_BAR;
  const kept: SectionBoundaryCandidate[] = [];
  let lastBeat = 0;
  for (const cand of raw) {
    if (cand.beatIndex - lastBeat < minBeats) continue;
    const remaining =
      snapshots[snapshots.length - 1]!.beatIndex - cand.beatIndex + 1;
    if (remaining < minBeats) continue;
    kept.push(cand);
    lastBeat = cand.beatIndex;
  }
  return kept;
}

function classifySection(input: {
  index: number;
  count: number;
  energyMean: number;
  energyPeak: number;
  energyDelta: number;
  rhythmicDensity: number;
  spectral: FrequencyBandEnergy;
  prevSpectral: FrequencyBandEnergy | null;
  boundaryScore: number;
}): { type: MusicSectionType; confidence: number } {
  if (input.count === 1) {
    const confidence = input.energyPeak > 75 && input.rhythmicDensity > 0.55 ? 0.62 : 0.42;
    return {
      type: confidence >= 0.6 ? "CHORUS" : "UNKNOWN",
      confidence,
    };
  }

  let type: MusicSectionType = "UNKNOWN";
  let rule = 0.35;
  const bassShare =
    input.spectral.bass /
    (input.spectral.bass +
      input.spectral.mid +
      input.spectral.high +
      input.spectral.highMid +
      1e-6);

  if (input.index === 0 && input.energyMean < 58) {
    type = "INTRO";
    rule = 0.74;
  } else if (
    input.index === input.count - 1 &&
    input.energyDelta < -8 &&
    input.energyMean < 52
  ) {
    type = "OUTRO";
    rule = 0.73;
  } else if (input.energyMean < 28 && input.rhythmicDensity < 0.28) {
    type = "BREAK";
    rule = 0.82;
  } else if (input.energyDelta > 18 && bassShare > 0.35 && input.energyPeak > 60) {
    type = "DROP";
    rule = 0.8;
  } else if (input.energyMean >= 68 && input.rhythmicDensity > 0.42) {
    type = input.index >= input.count - 1 && input.count >= 3 ? "FINAL_CHORUS" : "CHORUS";
    rule = input.energyMean > 78 ? 0.84 : 0.7;
  } else if (input.energyDelta > 10 && input.energyMean >= 45 && input.energyMean < 72) {
    type = "PRE_CHORUS";
    rule = 0.68;
  } else if (
    input.energyMean >= 32 &&
    input.energyMean < 66 &&
    Math.abs(input.energyDelta) < 14
  ) {
    type = "VERSE";
    rule = 0.7;
  } else if (
    input.prevSpectral &&
    cosineDistance(spectralVector(input.spectral), spectralVector(input.prevSpectral)) > 0.38
  ) {
    type = "BRIDGE";
    rule = 0.66;
  }

  const boundary = clamp01(input.boundaryScore / 80);
  const contrast = clamp01(Math.abs(input.energyDelta) / 30);
  const confidence = clamp01(0.4 * rule + 0.25 * boundary + 0.2 * contrast + 0.15);
  if (confidence < 0.6) {
    return { type: "UNKNOWN", confidence };
  }
  return { type, confidence };
}

export function detectSections(
  phase1: MusicAnalysisResultPhase1,
  config: MusicStructureConfig,
  snaps?: BeatSnapshot[]
): MusicSection[] {
  const snapshots = snaps ?? buildBeatSnapshots(phase1);
  const beats = ensureBeatGrid(phase1);
  const barSec = secondsPerBar(phase1, beats);
  const boundaries = detectSectionBoundaries(phase1, config, snapshots);
  const edges = [0, ...boundaries.map((b) => b.beatIndex), snapshots.length];
  const unique: number[] = [];
  for (const e of edges) {
    if (unique.length === 0 || e !== unique[unique.length - 1]) unique.push(e);
  }
  if (unique[unique.length - 1] !== snapshots.length) unique.push(snapshots.length);

  const sections: MusicSection[] = [];
  for (let s = 0; s < unique.length - 1; s += 1) {
    const start = unique[s]!;
    const end = unique[s + 1]!;
    if (end <= start) continue;
    const slice = snapshots.slice(start, end);
    const startSnap = slice[0]!;
    const endSnap = slice[slice.length - 1]!;
    const energies = slice.map((x) => x.energy);
    const energyMean = energies.reduce((a, b) => a + b, 0) / energies.length;
    const energyPeak = Math.max(...energies);
    const energyDelta = endSnap.energy - startSnap.energy;
    const rhythmicDensity =
      slice.reduce((a, b) => a + b.onset, 0) / Math.max(1, slice.length);
    const spectral = bandMean(snapshots, start, end);
    const endTime =
      s === unique.length - 2 ? phase1.duration : snapshots[end]!.time;
    const startBar = startSnap.barIndex;
    const endBar = Math.max(startBar, endSnap.barIndex);
    const barCount = Math.max(1, Math.round((endTime - startSnap.time) / barSec));
    const boundaryScore = boundaries.find((b) => b.beatIndex === start)?.score ?? (s === 0 ? 20 : 40);
    const classified = classifySection({
      index: s,
      count: unique.length - 1,
      energyMean,
      energyPeak,
      energyDelta,
      rhythmicDensity,
      spectral,
      prevSpectral: sections.length > 0 ? sections[sections.length - 1]!.spectralProfile : null,
      boundaryScore,
    });

    sections.push({
      id: `sec-${s}-${Math.round(startSnap.time * 1000)}`,
      type: classified.type,
      startTime: startSnap.time,
      endTime,
      startBar,
      endBar,
      barCount,
      energyMean,
      energyPeak,
      energyDelta,
      rhythmicDensity,
      spectralProfile: spectral,
      confidence: classified.confidence,
    });
  }

  if (sections.length === 0) {
    sections.push({
      id: "sec-0-0",
      type: "UNKNOWN",
      startTime: 0,
      endTime: phase1.duration,
      startBar: 0,
      endBar: 0,
      barCount: Math.max(1, Math.round(phase1.duration / Math.max(0.5, barSec))),
      energyMean: phase1.energyCurve.average,
      energyPeak: phase1.energyCurve.peak,
      energyDelta: 0,
      rhythmicDensity: 0,
      spectralProfile: { bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 },
      confidence: 0.3,
    });
  }
  return sections;
}
