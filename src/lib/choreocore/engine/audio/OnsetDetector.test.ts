/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { calculateOnsetStrength, detectOnsets } from "./OnsetDetector";
import { makeFeatureFrame } from "./testBuffers";

describe("OnsetDetector", () => {
  it("TEST 10: a large spectral change yields high onsetStrength", () => {
    const onset = calculateOnsetStrength(1.8, 0.02, 0.05);
    expect(onset).toBeGreaterThan(0.5);
  });

  it("TEST 11: a constant spectrum yields low onsetStrength", () => {
    const onset = calculateOnsetStrength(0.02, 0.02, 0.02);
    expect(onset).toBeLessThan(0.35);
  });

  it("TEST 15: hits closer than the minimum interval are dropped", () => {
    const frames = [];
    for (let i = 0; i < 30; i += 1) {
      frames.push(
        makeFeatureFrame(i * 0.05, { rms: 0.05, onsetStrength: 0.08 })
      );
    }
    frames[10] = makeFeatureFrame(0.5, { rms: 0.3, onsetStrength: 0.95 });
    frames[12] = makeFeatureFrame(0.6, { rms: 0.3, onsetStrength: 0.96 });
    frames[20] = makeFeatureFrame(1.0, { rms: 0.3, onsetStrength: 0.97 });
    const hits = detectOnsets(frames, { minimumHitInterval: 0.15 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < hits.length; i += 1) {
      expect(hits[i]!.time - hits[i - 1]!.time).toBeGreaterThanOrEqual(0.15);
    }
    expect(hits.some((h) => Math.abs(h.time - 0.6) < 1e-9)).toBe(false);
    expect(hits.every((h) => h.type === "MUSICAL_HIT")).toBe(true);
  });

  it("emits a MUSICAL_HIT for a local onset peak", () => {
    const frames = [];
    for (let i = 0; i < 20; i += 1) {
      frames.push(
        makeFeatureFrame(i * 0.05, { rms: 0.02, onsetStrength: 0.08 })
      );
    }
    frames[12] = makeFeatureFrame(12 * 0.05, {
      rms: 0.25,
      onsetStrength: 0.96,
    });
    frames[11] = makeFeatureFrame(11 * 0.05, { onsetStrength: 0.2 });
    frames[13] = makeFeatureFrame(13 * 0.05, { onsetStrength: 0.22 });
    const hits = detectOnsets(frames);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]!.type).toBe("MUSICAL_HIT");
  });
});
