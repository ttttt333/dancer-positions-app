import { describe, expect, it } from "vitest";
import {
  selectChangePointsForCueCount,
  suggestedCueCountForDuration,
  clampTargetCueCount,
} from "./selectChangePoints";
import type { ChangePoint } from "./types";

function makePoints(n: number): ChangePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    eight_index: i + 1,
    time: (i + 1) * 4,
    score: (i % 5) * 0.2,
    tier:
      i % 7 === 0 ? "major" : i % 3 === 0 ? "medium" : ("minor" as const),
  }));
}

describe("selectChangePointsForCueCount", () => {
  it("returns targetCueCount-1 points spaced across the song", () => {
    const points = makePoints(60);
    const selected = selectChangePointsForCueCount(points, 12, 240);
    expect(selected).toHaveLength(11);
    for (let i = 1; i < selected.length; i++) {
      expect(selected[i]!.time).toBeGreaterThan(selected[i - 1]!.time);
    }
  });

  it("prefers major tiers when thinning", () => {
    const points: ChangePoint[] = [
      { eight_index: 1, time: 10, score: 0.2, tier: "minor" },
      { eight_index: 2, time: 40, score: 0.9, tier: "major" },
      { eight_index: 3, time: 70, score: 0.2, tier: "minor" },
      { eight_index: 4, time: 100, score: 0.8, tier: "major" },
      { eight_index: 5, time: 130, score: 0.1, tier: "minor" },
    ];
    const selected = selectChangePointsForCueCount(points, 3, 150);
    expect(selected).toHaveLength(2);
    expect(selected.every((p) => p.tier === "major")).toBe(true);
  });

  it("clamps and suggests sensible defaults", () => {
    expect(clampTargetCueCount(1)).toBe(3);
    expect(clampTargetCueCount(100)).toBe(40);
    expect(suggestedCueCountForDuration(180)).toBeGreaterThanOrEqual(6);
    expect(suggestedCueCountForDuration(180)).toBeLessThanOrEqual(20);
  });
});
