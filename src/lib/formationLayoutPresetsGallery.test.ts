import { describe, expect, it } from "vitest";
import { dancersForLayoutPreset } from "./formationLayouts";
import {
  backWideTaperCounts,
  midHeavyRowCounts,
  trapezoidTwoRowCounts,
} from "./formationLayoutPresetsGallery";

function rowCountsFrontToBack(spots: { yPct: number }[]) {
  const ys = [...new Set(spots.map((s) => s.yPct))].sort((a, b) => b - a);
  return ys.map((y) => spots.filter((s) => s.yPct === y).length);
}

describe("gallery formation recipes", () => {
  it("backWideTaperCounts makes 2-4-5 for n=11", () => {
    expect(backWideTaperCounts(11, 3)).toEqual([2, 4, 5]);
  });

  it("midHeavyRowCounts makes 3-5-3 for n=11", () => {
    expect(midHeavyRowCounts(11)).toEqual([3, 5, 3]);
  });

  it("trapezoidTwoRowCounts is back-heavy for n=11", () => {
    expect(trapezoidTwoRowCounts(11)).toEqual([4, 7]);
  });

  it("gallery presets place exactly n dancers", () => {
    const ids = [
      "gallery_twin_peaks",
      "gallery_twin_peaks_wide",
      "gallery_twin_pyramids",
      "gallery_back_taper_3",
      "gallery_back_taper_4",
      "gallery_mid_heavy_3",
      "gallery_trapezoid_2",
      "gallery_trapezoid_arc",
      "gallery_slant_block",
      "gallery_u_square",
      "gallery_pointed_col_up",
      "gallery_pointed_col_down",
      "gallery_flat_pyramid",
      "gallery_dense_m_base",
      "gallery_w_layered",
      "gallery_front_pair_back_wide",
    ] as const;
    for (const id of ids) {
      for (const n of [8, 11, 14]) {
        const spots = dancersForLayoutPreset(n, id);
        expect(spots, id).toHaveLength(n);
      }
    }
  });

  it("gallery_back_taper_3 and mid_heavy match recipes at n=11", () => {
    expect(
      rowCountsFrontToBack(dancersForLayoutPreset(11, "gallery_back_taper_3"))
    ).toEqual([2, 4, 5]);
    expect(
      rowCountsFrontToBack(dancersForLayoutPreset(11, "gallery_mid_heavy_3"))
    ).toEqual([3, 5, 3]);
    expect(
      rowCountsFrontToBack(dancersForLayoutPreset(11, "waist_stair_from_4"))
    ).toEqual([4, 3, 4]);
  });
});
