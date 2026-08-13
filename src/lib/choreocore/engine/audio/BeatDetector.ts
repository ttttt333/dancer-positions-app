import { DEFAULT_BEATS_PER_BAR, DEFAULT_ANALYSIS_CONFIG } from "../constants";
import type { BeatEvent, TempoAnalysis } from "../types";
import { barIndexFromBeatIndex, beatInBarFromIndex } from "./meter";

function autocorrelationAtLag(env: ArrayLike<number>, lag: number): number {
  const n = env.length;
  if (lag < 1 || lag >= n) return 0;
  let corr = 0;
  let count = 0;
  for (let i = 0; i < n - lag; i += 1) {
    corr += env[i]! * env[i + lag]!;
    count += 1;
  }
  return count === 0 ? 0 : corr / count;
}

function corrAtBpm(
  env: ArrayLike<number>,
  hopSec: number,
  bpm: number
): number {
  const lag = Math.round(60 / bpm / hopSec);
  return autocorrelationAtLag(env, lag);
}

function interpolateAt(
  values: ArrayLike<number>,
  hopSec: number,
  time: number
): number {
  if (values.length === 0 || hopSec <= 0) return 0;
  const idx = time / hopSec;
  const lo = Math.floor(idx);
  const hi = lo + 1;
  if (lo < 0) return values[0]!;
  if (hi >= values.length) return values[values.length - 1]!;
  const t = idx - lo;
  return values[lo]! * (1 - t) + values[hi]! * t;
}

function localMaxTime(
  values: ArrayLike<number>,
  hopSec: number,
  center: number,
  radius: number
): number {
  const start = Math.max(0, center - radius);
  const end = Math.min((values.length - 1) * hopSec, center + radius);
  let bestT = center;
  let bestV = -Infinity;
  const step = hopSec;
  for (let t = start; t <= end + 1e-12; t += step) {
    const v = interpolateAt(values, hopSec, t);
    if (v > bestV) {
      bestV = v;
      bestT = t;
    }
  }
  return bestT;
}

/**
 * Autocorrelation tempo on an onset envelope.
 * WHY: dance BPM must be stable and local — no external API, and we correct
 * the 60↔120 octave that a click track always produces.
 */
export function estimateTempo(
  onsetEnvelope: number[],
  sampleRate: number,
  hopSize: number,
  options?: { minBpm?: number; maxBpm?: number }
): TempoAnalysis {
  const minBpm = options?.minBpm ?? DEFAULT_ANALYSIS_CONFIG.minBpm;
  const maxBpm = options?.maxBpm ?? DEFAULT_ANALYSIS_CONFIG.maxBpm;
  if (onsetEnvelope.length < 8 || sampleRate <= 0 || hopSize <= 0) {
    return { bpm: 120, confidence: 0 };
  }
  const hopSec = hopSize / sampleRate;
  let bestBpm = 120;
  let bestCorr = -Infinity;
  const corrByBpm = new Map<number, number>();

  for (let bpm = minBpm; bpm <= maxBpm; bpm += 1) {
    const corr = corrAtBpm(onsetEnvelope, hopSec, bpm);
    corrByBpm.set(bpm, corr);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestBpm = bpm;
    }
  }

  if (bestCorr <= 1e-12) {
    return { bpm: 120, confidence: 0 };
  }

  let bpm = bestBpm;
  while (bpm * 2 <= maxBpm) {
    const doubled = bpm * 2;
    const c1 = corrByBpm.get(bpm) ?? 0;
    const c2 = corrByBpm.get(doubled) ?? 0;
    if (c2 >= c1 * 0.7) {
      bpm = doubled;
    } else {
      break;
    }
  }
  while (bpm > 170 && bpm / 2 >= minBpm) {
    const half = Math.round(bpm / 2);
    const cHalf = corrByBpm.get(half) ?? 0;
    const cCur = corrByBpm.get(bpm) ?? 0;
    if (cHalf >= cCur * 0.85) {
      bpm = half;
    } else {
      break;
    }
  }

  const chosenCorr = corrByBpm.get(bpm) ?? bestCorr;
  let corrSum = 0;
  let corrCount = 0;
  for (const corr of corrByBpm.values()) {
    corrSum += corr;
    corrCount += 1;
  }
  const meanCorr = corrCount === 0 ? 0 : corrSum / corrCount;
  const peakiness =
    chosenCorr <= 1e-12 ? 0 : (chosenCorr - meanCorr) / chosenCorr;
  return {
    bpm,
    confidence: Math.max(0, Math.min(1, peakiness)),
  };
}

/**
 * Place beats on the tempo grid, snapping to nearby onset peaks.
 * beatInBar is 0..beatsPerBar-1 (Phase 1: 0,1,2,3).
 */
export function detectBeats(
  onsetEnvelope: number[],
  tempo: TempoAnalysis,
  duration: number,
  hopSec?: number,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR
): BeatEvent[] {
  if (onsetEnvelope.length === 0 || duration <= 0) return [];
  const step =
    hopSec && hopSec > 0
      ? hopSec
      : duration / Math.max(1, onsetEnvelope.length);
  const period = 60 / Math.max(1, tempo.bpm);

  let bestPhase = 0;
  let bestScore = -Infinity;
  for (let phase = 0; phase < period; phase += step) {
    let score = 0;
    for (let t = phase; t < duration; t += period) {
      score += interpolateAt(onsetEnvelope, step, t);
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  const snapRadius = period * 0.2;
  const beats: BeatEvent[] = [];
  let index = 0;
  for (let t = bestPhase; t < duration - step * 0.5; t += period) {
    const snapped = localMaxTime(onsetEnvelope, step, t, snapRadius);
    beats.push({
      time: snapped,
      index,
      strength: interpolateAt(onsetEnvelope, step, snapped),
      beatInBar: beatInBarFromIndex(index, beatsPerBar),
      barIndex: barIndexFromBeatIndex(index, beatsPerBar),
    });
    index += 1;
  }
  return beats;
}
