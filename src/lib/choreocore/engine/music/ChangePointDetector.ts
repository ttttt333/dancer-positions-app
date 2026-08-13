import type { HitEvent, MusicAnalysisResultPhase1 } from "../types";
import type {
  ChangePoint,
  ChangePointType,
  EventCluster,
  MusicPhrase,
  MusicSection,
  MusicStructureConfig,
} from "../types/MusicTypes";
import {
  CHANGE_POINT_PRIORITY,
} from "./structureConfig";
import {
  type BeatSnapshot,
  buildBeatSnapshots,
  cosineDistance,
  diminishingCombine,
  ensureBeatGrid,
  prefixSums,
  rangeMean,
  snapToBeatGrid,
} from "./structureMath";

function makePoint(
  type: ChangePointType,
  rawTime: number,
  phase1: MusicAnalysisResultPhase1,
  config: MusicStructureConfig,
  extra: {
    strength: number;
    confidence: number;
    sourceEventIds: string[];
    energyBefore: number;
    energyAfter: number;
  }
): ChangePoint {
  const beats = ensureBeatGrid(phase1);
  const snap = snapToBeatGrid(rawTime, beats, config);
  const deltaEnergy = extra.energyAfter - extra.energyBefore;
  return {
    id: `cp-${type}-${Math.round(rawTime * 1000)}`,
    time: snap.time,
    rawTime: snap.rawTime,
    beatTime: snap.beatTime,
    barTime: snap.barTime,
    barIndex: snap.barIndex,
    beatIndex: snap.beatIndex,
    type,
    strength: extra.strength,
    confidence: extra.confidence,
    sourceEventIds: extra.sourceEventIds,
    energyBefore: extra.energyBefore,
    energyAfter: extra.energyAfter,
    deltaEnergy,
    priority: CHANGE_POINT_PRIORITY[type],
  };
}

function energyAround(snaps: BeatSnapshot[], i: number, look: number): {
  before: number;
  after: number;
} {
  const lo = Math.max(0, i - look);
  const hi = Math.min(snaps.length, i + look);
  let before = 0;
  let after = 0;
  const nBefore = Math.max(1, i - lo);
  const nAfter = Math.max(1, hi - i);
  for (let j = lo; j < i; j += 1) before += snaps[j]!.energy;
  for (let j = i; j < hi; j += 1) after += snaps[j]!.energy;
  return { before: before / nBefore, after: after / nAfter };
}

function detectEnergyChanges(
  phase1: MusicAnalysisResultPhase1,
  snaps: BeatSnapshot[],
  config: MusicStructureConfig
): ChangePoint[] {
  const points: ChangePoint[] = [];
  const range = Math.max(20, phase1.energyCurve.dynamicRange);
  const look = 6;
  const rel: number[] = snaps.map(() => 0);
  const beforeArr: number[] = snaps.map(() => 0);
  const afterArr: number[] = snaps.map(() => 0);
  for (let i = look; i < snaps.length - look; i += 1) {
    const { before, after } = energyAround(snaps, i, look);
    beforeArr[i] = before;
    afterArr[i] = after;
    rel[i] = ((after - before) / range) * 100;
  }
  let last = -999;
  for (let i = look + 1; i < snaps.length - look - 1; i += 1) {
    const value = rel[i]!;
    if (Math.abs(value) < 12) continue;
    if (Math.abs(value) < Math.abs(rel[i - 1]!) || Math.abs(value) < Math.abs(rel[i + 1]!)) {
      continue;
    }
    if (i - last < 4) continue;
    let at = i;
    for (let j = i - 2; j <= i + 2; j += 1) {
      if (j < 0 || j >= snaps.length) continue;
      if (snaps[j]!.beatIndex % 4 !== 0) continue;
      if (Math.abs(rel[j]!) >= Math.abs(value) * 0.85) {
        at = j;
        break;
      }
    }
    if (value >= 12) {
      const major = value >= config.majorEnergyRiseThreshold;
      points.push(
        makePoint("ENERGY_RISE", snaps[at]!.time, phase1, config, {
          strength: Math.min(100, Math.abs(value)),
          confidence: major ? 0.86 : 0.68,
          sourceEventIds: [`energy-${at}`],
          energyBefore: beforeArr[at]!,
          energyAfter: afterArr[at]!,
        })
      );
      last = at;
    } else if (value <= -12) {
      const major = -value >= config.majorEnergyDropThreshold;
      points.push(
        makePoint("ENERGY_DROP", snaps[at]!.time, phase1, config, {
          strength: Math.min(100, Math.abs(value)),
          confidence: major ? 0.86 : 0.68,
          sourceEventIds: [`energy-${at}`],
          energyBefore: beforeArr[at]!,
          energyAfter: afterArr[at]!,
        })
      );
      last = at;
    }
  }
  return points;
}

function detectDensityShifts(
  phase1: MusicAnalysisResultPhase1,
  snaps: BeatSnapshot[],
  config: MusicStructureConfig,
  kind: "onset" | "bass"
): ChangePoint[] {
  const period =
    snaps.length >= 2 ? Math.max(0.05, snaps[1]!.time - snaps[0]!.time) : 0.5;
  const win = Math.max(2, Math.round(config.drumDensityWindow / period));
  const values = snaps.map((s) => (kind === "onset" ? s.onset : s.bass));
  const prefix = prefixSums(values);
  const peak = Math.max(...values, 1e-6);
  const points: ChangePoint[] = [];
  let last = -999;
  for (let i = win; i < snaps.length - win; i += 1) {
    const before = rangeMean(prefix, i - win, i) / peak;
    const after = rangeMean(prefix, i, i + win) / peak;
    const delta = after - before;
    if (i - last < win) continue;
    const { before: eB, after: eA } = energyAround(snaps, i, win);
    if (kind === "onset") {
      if (before < 0.28 && after > 0.55 && delta > 0.3) {
        points.push(
          makePoint("DRUM_ENTRY", snaps[i]!.time, phase1, config, {
            strength: Math.min(100, delta * 120),
            confidence: 0.8,
            sourceEventIds: [`onset-${i}`],
            energyBefore: eB,
            energyAfter: eA,
          })
        );
        last = i;
      } else if (before > 0.55 && after < 0.28 && delta < -0.3) {
        points.push(
          makePoint("DRUM_BREAK", snaps[i]!.time, phase1, config, {
            strength: Math.min(100, -delta * 120),
            confidence: 0.8,
            sourceEventIds: [`onset-${i}`],
            energyBefore: eB,
            energyAfter: eA,
          })
        );
        last = i;
      }
    } else if (delta >= config.bassRiseThreshold && after > before * 1.4) {
      points.push(
        makePoint("BASS_ENTRY", snaps[i]!.time, phase1, config, {
          strength: Math.min(100, delta * 140),
          confidence: 0.78,
          sourceEventIds: [`bass-${i}`],
          energyBefore: eB,
          energyAfter: eA,
        })
      );
      last = i;
    }
  }
  return points;
}

function detectSilence(
  phase1: MusicAnalysisResultPhase1,
  snaps: BeatSnapshot[],
  config: MusicStructureConfig
): ChangePoint[] {
  const points: ChangePoint[] = [];
  const period =
    snaps.length >= 2 ? Math.max(0.05, snaps[1]!.time - snaps[0]!.time) : 0.5;
  const need = Math.max(2, Math.round(config.silenceMinimumDuration / period));
  let run = 0;
  let runStart = 0;
  for (let i = 0; i < snaps.length; i += 1) {
    if (snaps[i]!.energy < config.silenceThreshold) {
      if (run === 0) runStart = i;
      run += 1;
    } else {
      if (run >= need) {
        const s = snaps[runStart]!;
        points.push(
          makePoint("SILENCE", s.time, phase1, config, {
            strength: 70,
            confidence: 0.84,
            sourceEventIds: [`silence-${runStart}`],
            energyBefore: runStart > 0 ? snaps[runStart - 1]!.energy : s.energy,
            energyAfter: s.energy,
          })
        );
      }
      run = 0;
    }
  }
  if (run >= need) {
    const s = snaps[runStart]!;
    points.push(
      makePoint("SILENCE", s.time, phase1, config, {
        strength: 70,
        confidence: 0.84,
        sourceEventIds: [`silence-${runStart}`],
        energyBefore: runStart > 0 ? snaps[runStart - 1]!.energy : s.energy,
        energyAfter: s.energy,
      })
    );
  }
  return points;
}

function detectSpectralChanges(
  phase1: MusicAnalysisResultPhase1,
  snaps: BeatSnapshot[],
  config: MusicStructureConfig
): ChangePoint[] {
  const points: ChangePoint[] = [];
  const win = 8;
  let last = -999;
  for (let i = win; i < snaps.length - win; i += 1) {
    const before: number[] = [0, 0, 0, 0, 0];
    const after: number[] = [0, 0, 0, 0, 0];
    for (let j = i - win; j < i; j += 1) {
      const s = snaps[j]!;
      before[0] += s.bass;
      before[1] += s.lowMid;
      before[2] += s.mid;
      before[3] += s.highMid;
      before[4] += s.high;
    }
    for (let j = i; j < i + win; j += 1) {
      const s = snaps[j]!;
      after[0] += s.bass;
      after[1] += s.lowMid;
      after[2] += s.mid;
      after[3] += s.highMid;
      after[4] += s.high;
    }
    for (let k = 0; k < 5; k += 1) {
      before[k]! /= win;
      after[k]! /= win;
    }
    const dist = cosineDistance(before, after);
    if (dist < config.spectralChangeThreshold) continue;
    if (i - last < win) continue;
    const { before: eB, after: eA } = energyAround(snaps, i, win);
    points.push(
      makePoint("SPECTRAL_CHANGE", snaps[i]!.time, phase1, config, {
        strength: Math.min(100, dist * 100),
        confidence: 0.74,
        sourceEventIds: [`spec-${i}`],
        energyBefore: eB,
        energyAfter: eA,
      })
    );
    last = i;
  }
  return points;
}

export function clusterChangePoints(
  points: ChangePoint[],
  config: MusicStructureConfig
): EventCluster[] {
  const sorted = [...points].sort((a, b) => a.time - b.time || a.type.localeCompare(b.type));
  const clusters: EventCluster[] = [];
  let current: ChangePoint[] = [];

  const flush = (): void => {
    if (current.length === 0) return;
    const time =
      current.reduce((s, p) => s + p.time, 0) / current.length;
    const dominant = [...current].sort((a, b) => b.priority - a.priority)[0]!;
    const totalStrength = diminishingCombine(current.map((p) => p.strength));
    const confidence =
      current.reduce((s, p) => s + p.confidence, 0) / current.length;
    const types = new Set(current.map((p) => p.type));
    const energyRise = current.find((p) => p.type === "ENERGY_RISE");
    const isMajor =
      (types.has("SECTION_CHANGE") &&
        Math.abs(energyRise?.deltaEnergy ?? 0) >= 12) ||
      (types.has("HIT") && types.has("ENERGY_RISE")) ||
      (types.has("BASS_ENTRY") && types.has("ENERGY_RISE")) ||
      (types.has("SECTION_CHANGE") && types.has("HIT"));
    clusters.push({
      id: `cl-${Math.round(time * 1000)}-${clusters.length}`,
      time,
      changePoints: current,
      dominantType: dominant.type,
      totalStrength,
      confidence,
      isMajor,
    });
    current = [];
  };

  for (const point of sorted) {
    if (
      current.length === 0 ||
      Math.abs(point.time - current[0]!.time) <= config.eventClusterWindowSeconds
    ) {
      current.push(point);
    } else {
      flush();
      current.push(point);
    }
  }
  flush();
  return clusters;
}

export function detectChangePoints(
  phase1: MusicAnalysisResultPhase1,
  sections: MusicSection[],
  phrases: MusicPhrase[],
  hits: HitEvent[],
  config: MusicStructureConfig,
  snaps?: BeatSnapshot[]
): { changePoints: ChangePoint[]; eventClusters: EventCluster[] } {
  const snapshots = snaps ?? buildBeatSnapshots(phase1);
  const points: ChangePoint[] = [];

  for (let i = 1; i < sections.length; i += 1) {
    const sec = sections[i]!;
    const prev = sections[i - 1]!;
    points.push(
      makePoint("SECTION_CHANGE", sec.startTime, phase1, config, {
        strength: Math.min(100, 40 + Math.abs(sec.energyMean - prev.energyMean)),
        confidence: Math.max(sec.confidence, 0.7),
        sourceEventIds: [sec.id, prev.id],
        energyBefore: prev.energyMean,
        energyAfter: sec.energyMean,
      })
    );
  }

  for (let i = 1; i < phrases.length; i += 1) {
    const phr = phrases[i]!;
    const prev = phrases[i - 1]!;
    points.push(
      makePoint("PHRASE_CHANGE", phr.startTime, phase1, config, {
        strength: 40 + Math.min(40, Math.abs(phr.energyDelta)),
        confidence: phr.confidence,
        sourceEventIds: [phr.id, prev.id],
        energyBefore: prev.energyEnd,
        energyAfter: phr.energyStart,
      })
    );
  }

  for (const hit of hits) {
    if (hit.strength < 0.45) continue;
    const eB = energyAround(
      snapshots,
      Math.max(
        0,
        snapshots.findIndex((s) => s.time >= hit.time)
      ),
      4
    );
    points.push(
      makePoint("HIT", hit.time, phase1, config, {
        strength: hit.strength * 100,
        confidence: hit.confidence,
        sourceEventIds: [hit.id],
        energyBefore: eB.before,
        energyAfter: eB.after,
      })
    );
  }

  points.push(...detectEnergyChanges(phase1, snapshots, config));
  points.push(...detectDensityShifts(phase1, snapshots, config, "onset"));
  points.push(...detectDensityShifts(phase1, snapshots, config, "bass"));
  points.push(...detectSilence(phase1, snapshots, config));
  points.push(...detectSpectralChanges(phase1, snapshots, config));

  points.sort((a, b) => a.time - b.time || a.type.localeCompare(b.type));
  const eventClusters = clusterChangePoints(points, config);
  return { changePoints: points, eventClusters };
}
