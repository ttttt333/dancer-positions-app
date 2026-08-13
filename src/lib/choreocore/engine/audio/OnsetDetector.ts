import { DEFAULT_ANALYSIS_CONFIG } from "../constants";
import type { AudioFeatureFrame, HitEvent } from "../types";
import { clamp01 } from "./signalMath";

/**
 * Map spectral flux novelty onto 0–1.
 * WHY: Hit detection must ignore tiny flux jitter; only local surprise
 * relative to a running average should fire.
 */
export function calculateOnsetStrength(
  spectralFlux: number,
  previousValue: number,
  localAverage: number
): number {
  if (spectralFlux <= 0) return 0;
  const avg = Math.max(localAverage, 1e-12);
  const novelty = Math.max(0, spectralFlux - previousValue);
  const relative = spectralFlux / avg;
  return clamp01(0.55 * clamp01(relative / 3) + 0.45 * clamp01(novelty / (avg * 2)));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) {
    const d = v - avg;
    s += d * d;
  }
  return Math.sqrt(s / values.length);
}

export type DetectOnsetsOptions = {
  minimumHitInterval?: number;
};

/**
 * Peak-pick onsetStrength into HitEvents.
 * Phase 1 labels are MUSICAL_HIT only — kick/snare/drop wait for Phase 2.
 */
export function detectOnsets(
  frames: AudioFeatureFrame[],
  options: DetectOnsetsOptions = {}
): HitEvent[] {
  if (frames.length < 3) return [];
  const strengths = frames.map((f) => f.onsetStrength);
  const avg = mean(strengths);
  const sd = stdDev(strengths, avg);
  const threshold = Math.max(0.35, avg + 1.25 * sd);
  const minGapSec =
    options.minimumHitInterval ?? DEFAULT_ANALYSIS_CONFIG.minimumHitInterval;

  const hits: HitEvent[] = [];
  let lastTime = -Infinity;

  for (let i = 1; i < frames.length - 1; i += 1) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    const next = frames[i + 1]!;
    if (cur.onsetStrength < threshold) continue;
    if (cur.onsetStrength < prev.onsetStrength) continue;
    if (cur.onsetStrength < next.onsetStrength) continue;
    if (cur.time - lastTime < minGapSec) continue;

    hits.push({
      id: `hit-${i}-${Math.round(cur.time * 1000)}`,
      time: cur.time,
      strength: cur.onsetStrength,
      type: "MUSICAL_HIT",
      confidence: clamp01(
        (cur.onsetStrength - threshold) / Math.max(0.2, 1 - threshold) + 0.45
      ),
    });
    lastTime = cur.time;
  }

  return hits;
}
