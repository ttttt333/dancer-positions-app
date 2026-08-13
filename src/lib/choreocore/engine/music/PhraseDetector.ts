import type { MusicAnalysisResultPhase1 } from "../types";
import type {
  MusicPhrase,
  MusicPhraseType,
  MusicSection,
  MusicStructureConfig,
} from "../types/MusicTypes";
import { DEFAULT_BEATS_PER_BAR } from "../constants";
import {
  type BeatSnapshot,
  buildBeatSnapshots,
  cosineDistance,
  ensureBeatGrid,
  prefixSums,
  rangeMean,
  secondsPerBar,
} from "./structureMath";

function phraseType(
  energyStart: number,
  energyEnd: number,
  energyDelta: number,
  changeAtBoundary: number,
  similarToPrev: boolean
): { type: MusicPhraseType; confidence: number } {
  if (similarToPrev) {
    return { type: "REPETITION", confidence: 0.72 };
  }
  if (changeAtBoundary > 40 && Math.abs(energyDelta) > 12) {
    return { type: "TRANSITION", confidence: 0.7 };
  }
  if (energyDelta > 8) {
    return { type: "PREPARATION", confidence: 0.68 };
  }
  if (energyDelta < -8 && energyStart > 50) {
    return { type: "RELEASE", confidence: 0.68 };
  }
  if (Math.abs(energyDelta) < 10 && energyEnd > 40) {
    return { type: "DEVELOPMENT", confidence: 0.64 };
  }
  return { type: "UNKNOWN", confidence: 0.5 };
}

export function detectPhrases(
  phase1: MusicAnalysisResultPhase1,
  sections: MusicSection[],
  config: MusicStructureConfig,
  snaps?: BeatSnapshot[]
): MusicPhrase[] {
  const snapshots = snaps ?? buildBeatSnapshots(phase1);
  const beats = ensureBeatGrid(phase1);
  const barSec = secondsPerBar(phase1, beats);
  if (snapshots.length < 4) return [];

  const energyPrefix = prefixSums(snapshots.map((s) => s.energy));
  const onsetPrefix = prefixSums(snapshots.map((s) => s.onset));
  const highPrefix = prefixSums(snapshots.map((s) => s.high));
  const bassPrefix = prefixSums(snapshots.map((s) => s.bass));

  const barStarts: number[] = [];
  let lastBar = -1;
  for (let i = 0; i < snapshots.length; i += 1) {
    if (snapshots[i]!.barIndex !== lastBar) {
      barStarts.push(i);
      lastBar = snapshots[i]!.barIndex;
    }
  }

  const minBeats = config.minimumPhraseBars * DEFAULT_BEATS_PER_BAR;
  const maxBeats = config.maximumPhraseBars * DEFAULT_BEATS_PER_BAR;
  const cuts: number[] = [0];

  for (const idx of barStarts) {
    if (idx === 0) continue;
    const snap = snapshots[idx]!;
    const lastCut = cuts[cuts.length - 1]!;
    const beatsFromLast = snap.beatIndex - snapshots[lastCut]!.beatIndex;
    if (beatsFromLast < minBeats) continue;

    const window = 8;
    const eBefore = rangeMean(energyPrefix, Math.max(0, idx - window), idx);
    const eAfter = rangeMean(energyPrefix, idx, Math.min(snapshots.length, idx + window));
    const oBefore = rangeMean(onsetPrefix, Math.max(0, idx - window), idx);
    const oAfter = rangeMean(onsetPrefix, idx, Math.min(snapshots.length, idx + window));
    const specBefore = [
      rangeMean(highPrefix, Math.max(0, idx - window), idx),
      rangeMean(bassPrefix, Math.max(0, idx - window), idx),
    ];
    const specAfter = [
      rangeMean(highPrefix, idx, Math.min(snapshots.length, idx + window)),
      rangeMean(bassPrefix, idx, Math.min(snapshots.length, idx + window)),
    ];
    const musical =
      Math.abs(eAfter - eBefore) * 1.1 +
      Math.abs(oAfter - oBefore) * 80 +
      cosineDistance(specBefore, specAfter) * 40;
    const barsFromLast = beatsFromLast / DEFAULT_BEATS_PER_BAR;
    const gridBoost = barsFromLast % 8 === 0 ? 18 : barsFromLast % 4 === 0 ? 12 : 0;
    const score = musical + (musical > 6 ? gridBoost : gridBoost * 0.25);
    if (score >= 18) cuts.push(idx);
  }

  const lastSnapIdx = snapshots.length - 1;
  const lastCutIdx = cuts[cuts.length - 1]!;
  const tailBeats =
    snapshots[lastSnapIdx]!.beatIndex - snapshots[lastCutIdx]!.beatIndex;
  if (lastCutIdx !== lastSnapIdx) {
    if (tailBeats >= minBeats || cuts.length === 1) cuts.push(lastSnapIdx);
    else cuts[cuts.length - 1] = lastSnapIdx;
  }

  const expanded: number[] = [cuts[0]!];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const start = cuts[i]!;
    let end = cuts[i + 1]!;
    while (
      snapshots[Math.min(end, lastSnapIdx)]!.beatIndex -
        snapshots[start]!.beatIndex >
      maxBeats
    ) {
      const limitBeat = snapshots[start]!.beatIndex + maxBeats;
      let split = start;
      for (const idx of barStarts) {
        if (idx > start && idx < end && snapshots[idx]!.beatIndex <= limitBeat) {
          split = idx;
        }
      }
      if (split <= start) break;
      expanded.push(split);
      end = split;
      break;
    }
    expanded.push(cuts[i + 1]!);
  }
  const uniqueCuts: number[] = [];
  for (const c of expanded) {
    if (uniqueCuts.length === 0 || c !== uniqueCuts[uniqueCuts.length - 1]) {
      uniqueCuts.push(c);
    }
  }
  if (uniqueCuts[uniqueCuts.length - 1] !== lastSnapIdx) {
    uniqueCuts.push(lastSnapIdx);
  }

  const phrases: MusicPhrase[] = [];
  let prevEnergies: [number, number] | null = null;
  for (let p = 0; p < uniqueCuts.length - 1; p += 1) {
    const start = uniqueCuts[p]!;
    const end = uniqueCuts[p + 1]!;
    if (end <= start) continue;
    const startSnap = snapshots[start]!;
    const endSnap = snapshots[Math.max(start, end === lastSnapIdx ? end : end - 1)]!;
    const endTime = p === uniqueCuts.length - 2 ? phase1.duration : snapshots[end]!.time;
    const energyStart = startSnap.energy;
    const energyEnd = endSnap.energy;
    const energyDelta = energyEnd - energyStart;
    const bars = Math.max(1, Math.round((endTime - startSnap.time) / barSec));
    const sectionHit = sections.some(
      (sec) => Math.abs(sec.startTime - startSnap.time) < barSec * 0.6
    );
    const similarToPrev =
      prevEnergies !== null &&
      Math.abs(prevEnergies[0] - energyStart) < 8 &&
      Math.abs(prevEnergies[1] - energyEnd) < 8;
    const classified = phraseType(
      energyStart,
      energyEnd,
      energyDelta,
      sectionHit ? 50 : Math.abs(energyDelta) * 2,
      similarToPrev
    );
    phrases.push({
      id: `phr-${p}-${Math.round(startSnap.time * 1000)}`,
      type: classified.confidence >= 0.6 ? classified.type : "UNKNOWN",
      startTime: startSnap.time,
      endTime,
      startBar: startSnap.barIndex,
      endBar: endSnap.barIndex,
      barCount: bars,
      energyStart,
      energyEnd,
      energyDelta,
      confidence: classified.confidence,
    });
    prevEnergies = [energyStart, energyEnd];
  }

  if (phrases.length === 0 && snapshots.length > 0) {
    const first = snapshots[0]!;
    const last = snapshots[snapshots.length - 1]!;
    phrases.push({
      id: "phr-0-0",
      type: "UNKNOWN",
      startTime: 0,
      endTime: phase1.duration,
      startBar: first.barIndex,
      endBar: last.barIndex,
      barCount: Math.max(1, Math.round(phase1.duration / barSec)),
      energyStart: first.energy,
      energyEnd: last.energy,
      energyDelta: last.energy - first.energy,
      confidence: 0.4,
    });
  }
  return phrases;
}
