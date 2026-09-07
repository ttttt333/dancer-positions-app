import { describe, expect, it } from "vitest";
import {
  dancersForLayoutPreset,
  waistBarbellRowCounts,
} from "./formationLayouts";

describe("waistBarbellRowCounts", () => {
  it("makes 4-3-4 for 11 with preferred wing 4", () => {
    expect(waistBarbellRowCounts(11, 4)).toEqual([4, 3, 4]);
  });

  it("keeps barbell shape across dancer counts", () => {
    expect(waistBarbellRowCounts(8, 4)).toEqual([3, 2, 3]);
    expect(waistBarbellRowCounts(9, 4)).toEqual([3, 3, 3]);
    expect(waistBarbellRowCounts(10, 4)).toEqual([4, 2, 4]);
    expect(waistBarbellRowCounts(12, 4)).toEqual([5, 2, 5]);
    expect(waistBarbellRowCounts(13, 4)).toEqual([5, 3, 5]);
    expect(waistBarbellRowCounts(15, 4)).toEqual([6, 3, 6]);
    expect(waistBarbellRowCounts(17, 4)).toEqual([6, 5, 6]);
  });

  it("never leaves an empty middle row when n>=3", () => {
    for (const wing of [3, 4, 5]) {
      for (let n = 3; n <= 24; n++) {
        const rows = waistBarbellRowCounts(n, wing);
        expect(rows.reduce((a, b) => a + b, 0)).toBe(n);
        expect(rows.every((c) => c >= 1)).toBe(true);
      }
    }
  });
});

describe("waist_stair_from_4 preset", () => {
  it("places 11 dancers in 4-3-4 front to back", () => {
    const spots = dancersForLayoutPreset(11, "waist_stair_from_4");
    expect(spots).toHaveLength(11);
    const ys = [...new Set(spots.map((s) => s.yPct))].sort((a, b) => b - a);
    expect(ys).toHaveLength(3);
    expect(ys.map((y) => spots.filter((s) => s.yPct === y).length)).toEqual([
      4, 3, 4,
    ]);
  });

  it("keeps existing front_stair_from_4 as growing stairs for 11", () => {
    const spots = dancersForLayoutPreset(11, "front_stair_from_4");
    const ys = [...new Set(spots.map((s) => s.yPct))].sort((a, b) => b - a);
    expect(ys.map((y) => spots.filter((s) => s.yPct === y).length)).toEqual([
      4, 5, 2,
    ]);
  });
});
