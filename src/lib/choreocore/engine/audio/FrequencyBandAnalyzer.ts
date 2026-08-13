import type { FrequencyBandEnergy } from "../types/AudioTypes";

/**
 * Fixed Hz bands used for texture (bass vs treble).
 * WHY: dance energy later cares about kick-range vs cymbal-range, not MFCCs.
 */
export const FREQUENCY_BANDS_HZ = {
  bass: { low: 20, high: 120 },
  lowMid: { low: 120, high: 400 },
  mid: { low: 400, high: 2000 },
  highMid: { low: 2000, high: 6000 },
  high: { low: 6000, high: 16000 },
} as const;

function bandRms(
  spectrum: ArrayLike<number>,
  sampleRate: number,
  lowHz: number,
  highHz: number
): number {
  const bins = spectrum.length;
  if (bins < 2 || sampleRate <= 0) return 0;
  const hzPerBin = sampleRate / (2 * (bins - 1));
  const lo = Math.max(0, Math.floor(lowHz / hzPerBin));
  const hi = Math.min(bins - 1, Math.ceil(highHz / hzPerBin));
  if (hi < lo) return 0;
  let sumSq = 0;
  let count = 0;
  for (let i = lo; i <= hi; i += 1) {
    const m = spectrum[i]!;
    sumSq += m * m;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.sqrt(sumSq / count);
}

export function calculateFrequencyBandEnergy(
  spectrum: ArrayLike<number>,
  sampleRate: number
): FrequencyBandEnergy {
  const nyquist = sampleRate / 2;
  return {
    bass: bandRms(
      spectrum,
      sampleRate,
      FREQUENCY_BANDS_HZ.bass.low,
      Math.min(FREQUENCY_BANDS_HZ.bass.high, nyquist)
    ),
    lowMid: bandRms(
      spectrum,
      sampleRate,
      FREQUENCY_BANDS_HZ.lowMid.low,
      Math.min(FREQUENCY_BANDS_HZ.lowMid.high, nyquist)
    ),
    mid: bandRms(
      spectrum,
      sampleRate,
      FREQUENCY_BANDS_HZ.mid.low,
      Math.min(FREQUENCY_BANDS_HZ.mid.high, nyquist)
    ),
    highMid: bandRms(
      spectrum,
      sampleRate,
      FREQUENCY_BANDS_HZ.highMid.low,
      Math.min(FREQUENCY_BANDS_HZ.highMid.high, nyquist)
    ),
    high: bandRms(
      spectrum,
      sampleRate,
      FREQUENCY_BANDS_HZ.high.low,
      Math.min(FREQUENCY_BANDS_HZ.high.high, nyquist)
    ),
  };
}

/** Frame-field names used by AudioFeatureFrame. */
export function analyzeFrequencyBands(
  spectrum: ArrayLike<number>,
  sampleRate: number
): {
  bassEnergy: number;
  lowMidEnergy: number;
  midEnergy: number;
  highMidEnergy: number;
  highEnergy: number;
} {
  const bands = calculateFrequencyBandEnergy(spectrum, sampleRate);
  return {
    bassEnergy: bands.bass,
    lowMidEnergy: bands.lowMid,
    midEnergy: bands.mid,
    highMidEnergy: bands.highMid,
    highEnergy: bands.high,
  };
}
