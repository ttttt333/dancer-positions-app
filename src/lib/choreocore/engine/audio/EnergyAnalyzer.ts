import { DEFAULT_ANALYSIS_CONFIG } from "../constants";
import type { AudioAnalysisConfig } from "../types/AnalysisTypes";
import type {
  AudioFeatureFrame,
  EnergyCurve,
  EnergyInflection,
  EnergyPeak,
  EnergyPoint,
} from "../types";
import type { EnergyWeights } from "../types/AnalysisTypes";
import { clamp01, movingAverage, percentileNormalize01 } from "./signalMath";

const EPS = 1e-12;

function normalizeWeights(weights: EnergyWeights): EnergyWeights {
  const sum =
    weights.rms +
    weights.spectralFlux +
    weights.bass +
    weights.onset +
    weights.high +
    weights.lowMidMid;
  if (sum <= EPS) return weights;
  return {
    rms: weights.rms / sum,
    spectralFlux: weights.spectralFlux / sum,
    bass: weights.bass / sum,
    onset: weights.onset / sum,
    high: weights.high / sum,
    lowMidMid: weights.lowMidMid / sum,
  };
}

function maxFeature(
  frames: AudioFeatureFrame[],
  read: (frame: AudioFeatureFrame) => number
): number {
  let max = 0;
  for (const frame of frames) {
    const v = read(frame);
    if (v > max) max = v;
  }
  return max;
}

function unit(value: number, peak: number): number {
  if (peak <= EPS) return 0;
  return clamp01(value / peak);
}

/**
 * Combine RMS / flux / bass / onset / highs into a 0–100 curve.
 * WHY: formation energy rules need loudness AND rhythmic / spectral motion,
 * not recording gain alone. Percentile scale keeps one crash from flattening
 * the rest of the song.
 */
export function calculateEnergyCurve(
  frames: AudioFeatureFrame[],
  config?: Pick<AudioAnalysisConfig, "smoothingWindow" | "energyWeights">
): EnergyCurve {
  if (frames.length === 0) {
    return { points: [], average: 0, peak: 0, dynamicRange: 0 };
  }

  const weights = normalizeWeights(
    config?.energyWeights ?? DEFAULT_ANALYSIS_CONFIG.energyWeights
  );
  const requestedWindow =
    config?.smoothingWindow ?? DEFAULT_ANALYSIS_CONFIG.smoothingWindow;
  const n = frames.length;

  const peakRms = maxFeature(frames, (f) => f.rms);
  const peakFlux = maxFeature(frames, (f) => f.spectralFlux);
  const peakBass = maxFeature(frames, (f) => f.bassEnergy);
  const peakOnset = maxFeature(frames, (f) => f.onsetStrength);
  const peakHigh = maxFeature(frames, (f) => f.highEnergy);
  const peakBody = maxFeature(frames, (f) => f.lowMidEnergy + f.midEnergy);

  const raw = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const frame = frames[i]!;
    raw[i] =
      weights.rms * unit(frame.rms, peakRms) +
      weights.spectralFlux * unit(frame.spectralFlux, peakFlux) +
      weights.bass * unit(frame.bassEnergy, peakBass) +
      weights.onset * unit(frame.onsetStrength, peakOnset) +
      weights.high * unit(frame.highEnergy, peakHigh) +
      weights.lowMidMid * unit(frame.lowMidEnergy + frame.midEnergy, peakBody);
  }

  const normalized = percentileNormalize01(raw);
  const effectiveWindow =
    n < 8 ? 1 : Math.min(requestedWindow, Math.max(1, Math.floor(n / 4)));
  const smoothed =
    effectiveWindow <= 1 ? normalized : movingAverage(normalized, effectiveWindow);

  const points: EnergyPoint[] = [];
  let prevValue = 0;
  let prevDelta = 0;
  let sum = 0;
  let peak = 0;
  let min = Infinity;

  for (let i = 0; i < n; i += 1) {
    const value = smoothed[i]! * 100;
    const delta = i === 0 ? 0 : value - prevValue;
    const acceleration = i === 0 ? 0 : delta - prevDelta;
    points.push({
      time: frames[i]!.time,
      value,
      delta,
      acceleration,
    });
    sum += value;
    if (value > peak) peak = value;
    if (value < min) min = value;
    prevValue = value;
    prevDelta = delta;
  }

  return {
    points,
    average: sum / n,
    peak,
    dynamicRange: peak - min,
  };
}

export type EnergyInflectionOptions = {
  riseThreshold?: number;
  dropThreshold?: number;
  window?: number;
};

/**
 * Detect sustained energy rises/drops on the 0–100 curve.
 * Kept for Phase 2 ChangePointDetector — Phase 1 pipeline does not emit cues.
 */
export function detectEnergyInflections(
  curve: EnergyCurve,
  options: EnergyInflectionOptions = {}
): EnergyInflection[] {
  const window = Math.max(1, options.window ?? 3);
  const riseThreshold = options.riseThreshold ?? 12;
  const dropThreshold = options.dropThreshold ?? 12;
  const points = curve.points;
  if (points.length <= window) return [];

  const raw: EnergyInflection[] = [];
  for (let i = window; i < points.length; i += 1) {
    const from = points[i - window]!;
    const to = points[i]!;
    const delta = to.value - from.value;
    if (delta >= riseThreshold) {
      raw.push({
        time: to.time,
        type: "ENERGY_RISE",
        strength: Math.min(100, delta),
        confidence: clamp01(delta / 40),
      });
    } else if (delta <= -dropThreshold) {
      raw.push({
        time: to.time,
        type: "ENERGY_DROP",
        strength: Math.min(100, -delta),
        confidence: clamp01(-delta / 40),
      });
    }
  }

  return collapseAdjacentInflections(raw);
}

function collapseAdjacentInflections(
  events: EnergyInflection[]
): EnergyInflection[] {
  if (events.length === 0) return [];
  const collapsed: EnergyInflection[] = [];
  let current = events[0]!;
  for (let i = 1; i < events.length; i += 1) {
    const next = events[i]!;
    if (next.type === current.type) {
      current = next.strength >= current.strength ? next : current;
    } else {
      collapsed.push(current);
      current = next;
    }
  }
  collapsed.push(current);
  return collapsed;
}

/**
 * Local maxima on the energy curve. Cue generation is Phase 2.
 */
export function detectEnergyPeaks(
  curve: EnergyCurve,
  minProminence = 4
): EnergyPeak[] {
  const points = curve.points;
  if (points.length < 3) return [];
  const peaks: EnergyPeak[] = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    if (cur.value < prev.value || cur.value < next.value) continue;
    const prominence = cur.value - 0.5 * (prev.value + next.value);
    if (prominence < minProminence) continue;
    peaks.push({ time: cur.time, peakStrength: prominence });
  }
  return peaks;
}

/** Build a curve from already-normalized 0–100 energy values. */
export function energyCurveFromValues(
  values: number[],
  hopSec = 0.25
): EnergyCurve {
  const points: EnergyPoint[] = [];
  let prevValue = 0;
  let prevDelta = 0;
  let sum = 0;
  let peak = 0;
  let min = Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]!;
    const delta = i === 0 ? 0 : value - prevValue;
    const acceleration = i === 0 ? 0 : delta - prevDelta;
    points.push({ time: i * hopSec, value, delta, acceleration });
    sum += value;
    if (value > peak) peak = value;
    if (value < min) min = value;
    prevValue = value;
    prevDelta = delta;
  }
  return {
    points,
    average: points.length === 0 ? 0 : sum / points.length,
    peak,
    dynamicRange: points.length === 0 ? 0 : peak - min,
  };
}
