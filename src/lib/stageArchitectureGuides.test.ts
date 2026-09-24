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

  it("buildSleeveCurtainMarksFromCurtains extends into side space", () => {
    const curtains = [
      { ...createDefaultSleeveCurtain(2000, "袖"), insetMm: 3000 },
    ];
    // main 16m + side 2m → 3m inset = 18.75% of main width, overflow 12.5%
    const marks = buildSleeveCurtainMarksFromCurtains(
      curtains,
      10_000,
      16_000,
      2000
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]!.insetPct).toBeCloseTo(18.75, 1);
    expect(marks[0]!.sideOverflowPct).toBeCloseTo(12.5, 1);
  });
});
