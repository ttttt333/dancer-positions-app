import { describe, expect, it } from "vitest";
import { alternatingRowCounts, dancersForLayoutPreset } from "./formationLayouts";

describe("alternating_rows（交互列・窓あき）", () => {
  it("82 人は前から 11,10,11,10,11,10,11,8", () => {
    expect(alternatingRowCounts(82)).toEqual([11, 10, 11, 10, 11, 10, 11, 8]);
  });

  it("行人数の合計が人数と一致し、交互に W と W-1 になる", () => {
    for (let n = 4; n <= 200; n++) {
      const counts = alternatingRowCounts(n);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
      const w = counts[0]!;
      counts.slice(0, -1).forEach((c, i) => {
        expect(c).toBe(i % 2 === 0 ? w : w - 1);
      });
    }
  });

  it("W-1 の行は W の行のちょうど間に並ぶ", () => {
    const spots = dancersForLayoutPreset(82, "alternating_rows");
    expect(spots).toHaveLength(82);
    const front = spots.slice(0, 11).map((d) => d.xPct);
    const second = spots.slice(11, 21).map((d) => d.xPct);
    second.forEach((x, j) => {
      expect(x).toBeCloseTo((front[j]! + front[j + 1]!) / 2, 6);
    });
  });
});
