import { clamp01 } from "./signalMath";

/**
 * RMS of a frame, clamped to 0–1.
 * WHY: Web Audio samples are nominally [-1, 1]; clamping keeps energy
 * comparable across synthetic tests and decoded files without a second pass.
 */
export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i]!;
    sumSq += v * v;
  }
  return clamp01(Math.sqrt(sumSq / samples.length));
}
