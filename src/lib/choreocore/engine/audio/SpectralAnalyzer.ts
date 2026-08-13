import { AudioAnalysisError } from "../types/AudioError";
import { isPowerOfTwo } from "./signalMath";
import { fftRadix2, hannWindow } from "./fft";

const hannCache = new Map<number, Float64Array>();

export function getHannWindow(length: number): Float64Array {
  const cached = hannCache.get(length);
  if (cached) return cached;
  const w = hannWindow(length);
  hannCache.set(length, w);
  return w;
}

export type SpectrumLike = ArrayLike<number>;

/**
 * WHY: spectral centroid tracks brightness (hats vs. kick-heavy texture)
 * without claiming a musical instrument identity we cannot prove.
 */
export function calculateSpectralCentroid(
  spectrum: SpectrumLike,
  sampleRate: number
): number {
  const n = spectrum.length;
  if (n === 0 || sampleRate <= 0) return 0;
  const binHz = sampleRate / (2 * (n - 1) || 1);
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    const mag = spectrum[i]!;
    weighted += mag * i * binHz;
    total += mag;
  }
  if (total <= 1e-12) return 0;
  return weighted / total;
}

/** @deprecated use calculateSpectralCentroid */
export const spectralCentroidHz = calculateSpectralCentroid;

/**
 * WHY: positive spectral flux is a stable onset cue across genres —
 * amplitude-only peaks miss snare hits that sit in a busy mix.
 */
export function calculateSpectralFlux(
  currentSpectrum: SpectrumLike,
  previousSpectrum: SpectrumLike
): number {
  const n = Math.min(currentSpectrum.length, previousSpectrum.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const diff = currentSpectrum[i]! - previousSpectrum[i]!;
    if (diff > 0) sum += diff;
  }
  return sum;
}

/** @deprecated use calculateSpectralFlux */
export function spectralFlux(
  current: SpectrumLike,
  previous: SpectrumLike | null
): number {
  if (!previous) return 0;
  return calculateSpectralFlux(current, previous);
}

export type FftScratch = {
  window: Float64Array;
  re: Float64Array;
  im: Float64Array;
  mag: Float64Array;
};

export function createFftScratch(frameSize: number): FftScratch {
  if (!isPowerOfTwo(frameSize)) {
    throw new AudioAnalysisError(
      "FFT_INVALID",
      `FFT frameSize must be a power of two, got ${frameSize}`
    );
  }
  return {
    window: getHannWindow(frameSize),
    re: new Float64Array(frameSize),
    im: new Float64Array(frameSize),
    mag: new Float64Array(frameSize / 2 + 1),
  };
}

/** Real-input FFT → one-sided magnitude (DC..Nyquist), writing into scratch.mag. */
export function computeMagnitudeSpectrumInto(
  frame: Float32Array,
  scratch: FftScratch
): Float64Array {
  const n = frame.length;
  if (n !== scratch.window.length || n !== scratch.re.length) {
    throw new AudioAnalysisError(
      "FFT_INVALID",
      "computeMagnitudeSpectrumInto: frame/scratch length mismatch"
    );
  }
  const { window, re, im, mag } = scratch;
  for (let i = 0; i < n; i += 1) {
    re[i] = frame[i]! * window[i]!;
    im[i] = 0;
  }
  fftRadix2(re, im);
  const half = n / 2 + 1;
  const scale = 1 / n;
  for (let i = 0; i < half; i += 1) {
    mag[i] = Math.hypot(re[i]!, im[i]!) * scale;
  }
  return mag;
}

/** Real-input FFT → one-sided magnitude (DC..Nyquist). */
export function computeMagnitudeSpectrum(
  frame: Float32Array,
  window?: Float64Array
): Float64Array {
  const scratch = createFftScratch(frame.length);
  if (window) {
    if (window.length !== frame.length) {
      throw new AudioAnalysisError(
        "FFT_INVALID",
        "computeMagnitudeSpectrum: frame/window length mismatch"
      );
    }
    scratch.window = window;
  }
  const mag = computeMagnitudeSpectrumInto(frame, scratch);
  return Float64Array.from(mag);
}
