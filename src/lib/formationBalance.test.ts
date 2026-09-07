import { describe, expect, it } from "vitest";
import {
  balancedPartition,
  balancedVerticalColumnSpots,
  balancedHorizontalLineSpots,
  letterShapeSpots,
  tripleVeeSpots,
} from "./formationBalance";
import { dancersForLayoutPreset } from "./formationLayouts";

function meanX(spots: { xPct: number }[]) {
  return spots.reduce((s, p) => s + p.xPct, 0) / spots.length;
}

function assertAudienceBalanced(spots: { xPct: number; yPct: number }[]) {
  expect(spots.length).toBeGreaterThan(0);
  expect(meanX(spots)).toBeCloseTo(50, 0);
  // 左右の人数差は最大1（x=50 はどちらでも可）
  const left = spots.filter((s) => s.xPct < 49.5).length;
  const right = spots.filter((s) => s.xPct > 50.5).length;
  expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
}

describe("formationBalance helpers", () => {
  it("balancedPartition keeps left-right symmetry", () => {
    expect(balancedPartition(10, 4)).toEqual([2, 3, 3, 2]);
    expect(balancedPartition(10, 3)).toEqual([3, 4, 3]);
    expect(balancedPartition(10, 7)).toEqual([1, 1, 2, 2, 2, 1, 1]);
    expect(balancedPartition(17, 4)).toEqual([4, 5, 4, 4]); // rem=1 → center-left first in order
  });

  it("vertical columns for N=10 are front-filled and centered", () => {
    for (const cols of [3, 4, 7]) {
      const pts = balancedVerticalColumnSpots(10, cols);
      expect(pts).toHaveLength(10);
      assertAudienceBalanced(pts);
      // 最前列（最大 y）は列数分揃うか中央寄せ
      const maxY = Math.max(...pts.map((p) => p.yPct));
      const front = pts.filter((p) => Math.abs(p.yPct - maxY) < 0.2);
      expect(front.length).toBeGreaterThanOrEqual(Math.min(cols, 10));
      expect(meanX(front)).toBeCloseTo(50, 0);
    }
  });

  it("horizontal lines center each incomplete row", () => {
    const pts = balancedHorizontalLineSpots(10, 4);
    expect(pts).toHaveLength(10);
    assertAudienceBalanced(pts);
  });

  it("W and M letter shapes stay centered for N=10 and 17", () => {
    for (const kind of ["W", "W_wide", "M", "M_deep"] as const) {
      for (const n of [10, 17]) {
        const pts = letterShapeSpots(n, kind);
        expect(pts).toHaveLength(n);
        expect(meanX(pts)).toBeCloseTo(50, 0);
      }
    }
  });

  it("triple vee is symmetric for N=10", () => {
    const pts = tripleVeeSpots(10);
    expect(pts).toHaveLength(10);
    assertAudienceBalanced(pts);
  });
});

describe("broken presets from screenshots (N=10)", () => {
  const ids = [
    "columns_3",
    "columns_4",
    "columns_7",
    "extra_parallel_3",
    "extra_parallel_4",
    "extra_three_lines",
    "extra_four_lines",
    "triple_vee",
    "split_lr_stagger",
    "w_shape",
    "m_shape",
  ] as const;

  it("all place exactly 10 and stay roughly centered", () => {
    for (const id of ids) {
      const spots = dancersForLayoutPreset(10, id);
      expect(spots).toHaveLength(10);
      expect(meanX(spots)).toBeCloseTo(50, 0);
    }
  });
});
