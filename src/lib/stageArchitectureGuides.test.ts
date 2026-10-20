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

  it("marks use stage edge as origin for inset and wing", () => {
    const curtains = [
      {
        ...createDefaultSleeveCurtain(2000, "袖"),
        insetMm: 1000,
        wingExtentMm: 500,
      },
    ];
    const marks = buildSleeveCurtainMarksFromCurtains(
      curtains,
      10_000,
      16_000,
      2000
    );
    expect(marks).toHaveLength(1);
    // 1m onto stage / 16m
    expect(marks[0]!.insetPct).toBeCloseTo(6.25, 1);
    // 0.5m into wing / 16m
    expect(marks[0]!.wingPct).toBeCloseTo(3.125, 1);
  });

  it("defaults wing to full side when wingExtentMm omitted", () => {
    const curtains = [
      { ...createDefaultSleeveCurtain(2000, "袖"), insetMm: 0 },
    ];
    const marks = buildSleeveCurtainMarksFromCurtains(
      curtains,
      10_000,
      16_000,
      2000
    );
    expect(marks[0]!.insetMm).toBe(0);
    expect(marks[0]!.wingExtentMm).toBe(2000);
    expect(marks[0]!.wingPct).toBeCloseTo(12.5, 1);
  });
});
