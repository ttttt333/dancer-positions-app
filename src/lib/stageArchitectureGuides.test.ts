import { describe, expect, it } from "vitest";
import {
  buildFrontGridMarksFromInterval,
  inferFrontGridIntervalMm,
} from "./stageArchitectureGuides";
import {
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

  it("createDefaultSleeveCurtain has both sides", () => {
    const c = createDefaultSleeveCurtain(1500, "袖A");
    expect(c.side).toBe("both");
    expect(c.depthMm).toBe(1500);
    expect(c.label).toBe("袖A");
  });
});
