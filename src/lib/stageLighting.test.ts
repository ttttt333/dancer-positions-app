import { describe, expect, it } from "vitest";
import {
  activeStageLightsAtTime,
  createDefaultStageLight,
  normalizeDepthMmList,
  yPctFromFrontMm,
} from "./stageLighting";
import {
  buildFrontGridMarks,
  buildSleeveCurtainMarks,
} from "./stageArchitectureGuides";

describe("stageLighting / architecture guides", () => {
  it("maps front distance to yPct (front = 100)", () => {
    expect(yPctFromFrontMm(0, 10000)).toBe(100);
    expect(yPctFromFrontMm(5000, 10000)).toBe(50);
    expect(yPctFromFrontMm(10000, 10000)).toBe(0);
  });

  it("normalizes depth lists", () => {
    expect(normalizeDepthMmList([2000, 2000, 4000, -1])).toEqual([2000, 4000]);
  });

  it("builds front and sleeve marks", () => {
    expect(buildFrontGridMarks([2000, 4000], 10000).map((m) => m.yPct)).toEqual([
      80, 60,
    ]);
    expect(buildSleeveCurtainMarks([2000], 8000)[0]?.kind).toBe("sleeve");
  });

  it("filters lights by time window", () => {
    const a = {
      ...createDefaultStageLight("sideSpot"),
      id: "a",
      tStartSec: 10,
      tEndSec: 20,
    };
    const b = {
      ...createDefaultStageLight("footlight"),
      id: "b",
      tStartSec: null,
      tEndSec: null,
    };
    expect(activeStageLightsAtTime([a, b], 5).map((L) => L.id)).toEqual(["b"]);
    expect(activeStageLightsAtTime([a, b], 15).map((L) => L.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
