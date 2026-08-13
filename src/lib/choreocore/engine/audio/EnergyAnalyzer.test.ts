/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  calculateEnergyCurve,
  detectEnergyInflections,
  detectEnergyPeaks,
  energyCurveFromValues,
} from "./EnergyAnalyzer";
import { makeFeatureFrame } from "./testBuffers";

describe("EnergyAnalyzer", () => {
  it("TEST 03: high-energy frames score above low-energy frames", () => {
    const low = [
      makeFeatureFrame(0, { rms: 0.02, onsetStrength: 0.02, bassEnergy: 0.01 }),
      makeFeatureFrame(0.1, { rms: 0.03, onsetStrength: 0.02, bassEnergy: 0.01 }),
    ];
    const high = [
      makeFeatureFrame(0, { rms: 0.6, onsetStrength: 0.7, bassEnergy: 0.5 }),
      makeFeatureFrame(0.1, { rms: 0.7, onsetStrength: 0.8, bassEnergy: 0.6 }),
    ];
    const lowCurve = calculateEnergyCurve([...low, ...high]);
    expect(lowCurve.points[0]!.value).toBeLessThan(lowCurve.points[3]!.value);
  });

  it("TEST 04: normalized energy stays in 0–100", () => {
    const frames = [0.01, 0.2, 0.05, 0.9, 0.4, 0.15, 0.7].map((rms, i) =>
      makeFeatureFrame(i * 0.1, {
        rms,
        spectralFlux: rms * 0.5,
        bassEnergy: rms * 0.3,
        onsetStrength: rms,
      })
    );
    const curve = calculateEnergyCurve(frames);
    for (const p of curve.points) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });

  it("TEST 05: delta is current minus previous", () => {
    const curve = energyCurveFromValues([10, 20, 40]);
    expect(curve.points[0]!.delta).toBe(0);
    expect(curve.points[1]!.delta).toBe(10);
    expect(curve.points[2]!.delta).toBe(20);
  });

  it("TEST 06: acceleration follows delta changes", () => {
    const curve = energyCurveFromValues([10, 30, 40]);
    expect(curve.points[1]!.delta).toBe(20);
    expect(curve.points[2]!.delta).toBe(10);
    expect(curve.points[1]!.acceleration).toBe(20);
    expect(curve.points[2]!.acceleration).toBe(-10);
  });

  it("TEST 1: energy increases when RMS goes from low to high", () => {
    const frames = [
      makeFeatureFrame(0, { rms: 0.02 }),
      makeFeatureFrame(0.1, { rms: 0.04 }),
      makeFeatureFrame(0.2, { rms: 0.08 }),
      makeFeatureFrame(0.3, { rms: 0.2 }),
      makeFeatureFrame(0.4, { rms: 0.45 }),
    ];
    const curve = calculateEnergyCurve(frames);
    expect(curve.points[0]!.value).toBeLessThan(
      curve.points[curve.points.length - 1]!.value
    );
    expect(curve.peak).toBeGreaterThan(curve.average);
  });

  it("keeps ENERGY_RISE / ENERGY_DROP helpers for Phase 2", () => {
    expect(
      detectEnergyInflections(
        energyCurveFromValues([40, 42, 45, 55, 70, 85])
      ).some((e) => e.type === "ENERGY_RISE")
    ).toBe(true);
    expect(
      detectEnergyInflections(
        energyCurveFromValues([90, 85, 70, 50, 30])
      ).some((e) => e.type === "ENERGY_DROP")
    ).toBe(true);
  });

  it("exposes energy peaks without creating cues", () => {
    const curve = energyCurveFromValues([10, 20, 80, 20, 15, 90, 20]);
    const peaks = detectEnergyPeaks(curve, 4);
    expect(peaks.length).toBeGreaterThanOrEqual(1);
    expect(peaks.every((p) => p.peakStrength > 0)).toBe(true);
  });
});
