import { describe, expect, it } from "vitest";
import { computeWavePeaksFromChannelData, WAVE_PEAK_BIN_COUNT } from "./computeWavePeaksFromChannelData";

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
});
