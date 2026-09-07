import { describe, expect, it } from "vitest";
import { dancersForLayoutPreset } from "./formationLayouts";

function rowsFrontToBack(spots: { xPct: number; yPct: number }[]) {
  const ys = [...new Set(spots.map((s) => Number(s.yPct.toFixed(2))))].sort(
    (a, b) => b - a
  );
  return ys.map((y) => {
    const row = spots
      .filter((s) => Number(s.yPct.toFixed(2)) === y)
      .sort((a, b) => a.xPct - b.xPct);
    return row;
  });
}

describe("grid front-filled layout", () => {
  it("fills complete front rows first; incomplete row is at the back and centered", () => {
    // 17 → cols≈4 → [4,4,4,5]? chooseGridCols(17): round(sqrt(17))=4, 17%4=1 lonely
    // → try cols-1=3: 17%3=2 ok → [3,3,3,3,3,2]
    // or cols+1=5: 17%5=2 → [5,5,5,2]
    const spots = dancersForLayoutPreset(17, "grid");
    expect(spots).toHaveLength(17);
    const rows = rowsFrontToBack(spots);
    // 最前列はフル幅（最奥より人数が多い or 等しい）
    expect(rows[0]!.length).toBeGreaterThanOrEqual(rows[rows.length - 1]!.length);
    // 最奥が不完全なら中央揃え（左右対称）
    const back = rows[rows.length - 1]!;
    const mid = (back[0]!.xPct + back[back.length - 1]!.xPct) / 2;
    expect(mid).toBeCloseTo(50, 0);
  });

  it("does not leave a lonely incomplete row on the audience side", () => {
    for (const n of [7, 10, 11, 13, 17, 19]) {
      const spots = dancersForLayoutPreset(n, "grid");
      const rows = rowsFrontToBack(spots);
      const front = rows[0]!;
      const back = rows[rows.length - 1]!;
      // 客席側が欠ける（前列だけ少ない）並びではない
      if (rows.length >= 2) {
        expect(front.length).toBeGreaterThanOrEqual(back.length);
      }
    }
  });

  it("grid_tight / grid_wide share front-fill semantics", () => {
    for (const id of ["grid_tight", "grid_wide"] as const) {
      const spots = dancersForLayoutPreset(14, id);
      const rows = rowsFrontToBack(spots);
      expect(rows[0]!.length).toBeGreaterThanOrEqual(
        rows[rows.length - 1]!.length
      );
    }
  });
});
