import { describe, expect, it } from "vitest";
import {
  computeWavePeaksFromChannelData,
  isWavePeaksResolutionStale,
  refinePeaksForTimeline,
  resolveWavePeakBinCount,
  upsampleWavePeaks,
  WAVE_PEAK_BIN_COUNT,
  WAVE_PEAK_BIN_MAX,
} from "./computeWavePeaksFromChannelData";

describe("computeWavePeaksFromChannelData", () => {
  it("returns normalized peaks with fixed bin count", () => {
    const ch = new Float32Array(WAVE_PEAK_BIN_COUNT * 10);
    for (let i = 0; i < ch.length; i++) {
      ch[i] = i % 20 === 0 ? 1 : 0.01;
    }
    const peaks = computeWavePeaksFromChannelData(ch);
    expect(peaks).toHaveLength(WAVE_PEAK_BIN_COUNT);
    expect(Math.max(...peaks)).toBeCloseTo(1, 5);
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(0);
  });

  it("scales bin count with duration", () => {
    expect(resolveWavePeakBinCount(30)).toBe(WAVE_PEAK_BIN_COUNT);
    expect(resolveWavePeakBinCount(180)).toBe(23040);
    expect(resolveWavePeakBinCount(600)).toBe(WAVE_PEAK_BIN_MAX);
  });

  it("upsamples legacy low-resolution peaks with max envelope", () => {
    const legacy = Array.from({ length: 400 }, (_, i) => i / 400);
    const target = resolveWavePeakBinCount(120);
    const upsampled = upsampleWavePeaks(legacy, target);
    expect(upsampled).toHaveLength(target);
    expect(refinePeaksForTimeline(legacy, 120)).toHaveLength(target);
  });

  it("detects stale cached peaks", () => {
    const legacy400 = Array.from({ length: 400 }, () => 0.5);
    expect(isWavePeaksResolutionStale(legacy400, 180)).toBe(true);
    expect(isWavePeaksResolutionStale(new Array(32768).fill(0.5), 180)).toBe(false);
  });
});
