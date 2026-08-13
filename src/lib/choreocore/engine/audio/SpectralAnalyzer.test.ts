/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { calculateRms } from "./rms";
import {
  calculateFrequencyBandEnergy,
} from "./FrequencyBandAnalyzer";
import {
  calculateSpectralCentroid,
  calculateSpectralFlux,
  computeMagnitudeSpectrum,
} from "./SpectralAnalyzer";

describe("SpectralAnalyzer", () => {
  it("TEST 07: identical spectra yield flux 0", () => {
    const spec = new Float32Array([0.1, 0.4, 0.2, 0.05]);
    expect(calculateSpectralFlux(spec, spec)).toBe(0);
  });

  it("TEST 08: a spectral rise yields positive flux", () => {
    const prev = new Float32Array([0.1, 0.1, 0.1, 0.1]);
    const curr = new Float32Array([0.1, 0.8, 0.6, 0.2]);
    expect(calculateSpectralFlux(curr, prev)).toBeGreaterThan(0);
  });

  it("TEST 09: sine energy lands in the matching frequency band", () => {
    const sampleRate = 22050;
    const n = 2048;
    const bassFrame = new Float32Array(n);
    const midFrame = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      bassFrame[i] = Math.sin((2 * Math.PI * 80 * i) / sampleRate);
      midFrame[i] = Math.sin((2 * Math.PI * 1000 * i) / sampleRate);
    }
    const bassBands = calculateFrequencyBandEnergy(
      computeMagnitudeSpectrum(bassFrame),
      sampleRate
    );
    const midBands = calculateFrequencyBandEnergy(
      computeMagnitudeSpectrum(midFrame),
      sampleRate
    );
    expect(bassBands.bass).toBeGreaterThan(bassBands.mid);
    expect(bassBands.bass).toBeGreaterThan(bassBands.high);
    expect(midBands.mid).toBeGreaterThan(midBands.bass);
    expect(midBands.mid).toBeGreaterThan(midBands.high);
  });

  it("places a 440 Hz sine centroid near 440 Hz", () => {
    const sampleRate = 22050;
    const n = 2048;
    const frame = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      frame[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }
    const centroid = calculateSpectralCentroid(
      computeMagnitudeSpectrum(frame),
      sampleRate
    );
    expect(centroid).toBeGreaterThan(300);
    expect(centroid).toBeLessThan(700);
  });
});

describe("RMS", () => {
  it("TEST 01: silence is 0", () => {
    expect(calculateRms(new Float32Array(2048))).toBe(0);
  });

  it("TEST 02: constant signal matches the theoretical RMS", () => {
    const samples = new Float32Array(2048);
    samples.fill(0.5);
    expect(calculateRms(samples)).toBeCloseTo(0.5, 8);
  });
});
