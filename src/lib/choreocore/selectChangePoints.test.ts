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

  it("prefers section boundaries when provided", () => {
    const points = makePoints(40);
    const selected = selectChangePointsForCueCount(points, 6, 180, [
      { startSec: 30, endSec: 60, avgEnergy: 0.4, label: "Aメロ" },
      { startSec: 60, endSec: 90, avgEnergy: 0.8, label: "サビ" },
      { startSec: 90, endSec: 120, avgEnergy: 0.45, label: "Bメロ" },
      { startSec: 120, endSec: 160, avgEnergy: 0.75, label: "サビ" },
    ]);
    expect(selected.length).toBe(5);
    const times = selected.map((p) => p.time);
    expect(times.some((t) => Math.abs(t - 60) < 1 || Math.abs(t - 30) < 1)).toBe(
      true
    );
  });

  it("clamps and suggests sensible defaults", () => {
    expect(clampTargetCueCount(1)).toBe(3);
    expect(clampTargetCueCount(100)).toBe(40);
    expect(suggestedCueCountForDuration(180)).toBeGreaterThanOrEqual(6);
    expect(suggestedCueCountForDuration(180)).toBeLessThanOrEqual(20);
  });
});
