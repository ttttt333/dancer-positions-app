import { describe, expect, it } from "vitest";
import {
  buildFrontGridMarksFromInterval,
  inferFrontGridIntervalMm,
} from "./stageArchitectureGuides";
import {
  buildSleeveCurtainMarksFromCurtains,
  createDefaultSleeveCurtain,
  normalizeStageSleeveCurtains,
} from "./stageSleeveCurtains";

describe("stageArchitectureGuides", () => {
  it("buildFrontGridMarksFromInterval places lines from front", () => {
    const marks = buildFrontGridMarksFromInterval(2000, 10_000);
    expect(marks.map((m) => m.labelMm)).toEqual([2000, 4000, 6000, 8000]);
    expect(marks[0]?.yPct).toBe(80);
  });

  it("inferFrontGridIntervalMm uses gcd", () => {
    expect(inferFrontGridIntervalMm([2000, 4000, 6000])).toBe(2000);
  });
});

describe("stageSleeveCurtains", () => {
  it("normalizes legacy depth list into curtains", () => {
    const curtains = normalizeStageSleeveCurtains(undefined, [2000, 4000]);
    expect(curtains).toHaveLength(2);
    expect(curtains.map((c) => c.depthMm)).toEqual([2000, 4000]);
  });

  it("buildSleeveCurtainMarksFromCurtains extends to configured inset length", () => {
    const curtains = [
      { ...createDefaultSleeveCurtain(2000, "袖"), insetMm: 2000 },
    ];
    const marks = buildSleeveCurtainMarksFromCurtains(curtains, 10_000, 16_000);
    expect(marks).toHaveLength(1);
    // 2m / 16m = 12.5%（旧 18% 上限では切り捨てられなかったが、長い設定でも伸びる）
    expect(marks[0]!.insetPct).toBeCloseTo(12.5, 1);
    const long = buildSleeveCurtainMarksFromCurtains(
      [{ ...curtains[0]!, insetMm: 4000 }],
      10_000,
      16_000
    );
    expect(long[0]!.insetPct).toBeCloseTo(25, 1);
  });
});
