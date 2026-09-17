import { describe, expect, it } from "vitest";
import { dancersForLayoutPreset } from "./formationLayouts";
import {
  classicFrontHeavyTwoRows,
  classicFrontLightTwoRows,
  classicPyramidRowCounts,
  classicShimoteKamitePair,
  classicSuggestionEntries,
  classicTriple323,
} from "./formationClassicSuggestions";
import { midHeavyRowCounts } from "./formationLayoutPresetsGallery";

function rowCountsFrontToBack(spots: { xPct: number; yPct: number }[]): number[] {
  const rows = new Map<number, number>();
  for (const s of spots) {
    const key = Math.round(s.yPct);
    rows.set(key, (rows.get(key) ?? 0) + 1);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, c]) => c);
}

describe("classicPyramidRowCounts", () => {
  it("puts one person at the front tip and grows 2, 3, …", () => {
    expect(classicPyramidRowCounts(7)).toEqual([1, 2, 4]);
    expect(classicPyramidRowCounts(8)).toEqual([1, 2, 3, 2]);
  });
});

describe("classicSuggestionEntries (7 dancers)", () => {
  it("follows the classic order for 7 people", () => {
    const ids = classicSuggestionEntries(7).map((e) => e.id);
    expect(ids).toEqual([
      "classic_pyramid",
      "front_stair_from_2",
      "front_stair_from_3",
      "classic_rows_mid_heavy",
      "classic_rows_front_light",
      "classic_rows_front_heavy",
      "line",
      "vee",
      "inverse_vee",
      "diagonal_se",
      "diagonal_nw",
      "classic_cols_overlap",
      "classic_split_three",
      "classic_kamite_light",
      "classic_kamite_heavy",
    ]);
  });

  it("labels include row counts and 上手/下手 sizes", () => {
    const byId = Object.fromEntries(
      classicSuggestionEntries(7).map((e) => [e.id, e.label])
    );
    expect(byId.classic_pyramid).toContain("1-2-4");
    expect(byId.classic_rows_mid_heavy).toContain("2-3-2");
    expect(byId.classic_rows_front_light).toContain("3-4");
    expect(byId.classic_rows_front_heavy).toContain("4-3");
    expect(byId.classic_kamite_light).toBe("上手3・下手4");
    expect(byId.classic_kamite_heavy).toBe("上手4・下手3");
  });
});

describe("classic geometries for 7", () => {
  it("builds expected row / pair / triple counts", () => {
    expect(midHeavyRowCounts(7)).toEqual([2, 3, 2]);
    expect(classicFrontLightTwoRows(7)).toEqual([3, 4]);
    expect(classicFrontHeavyTwoRows(7)).toEqual([4, 3]);
    expect(classicTriple323(7)).toEqual([3, 1, 3]);
    expect(classicTriple323(8)).toEqual([3, 2, 3]);
    expect(classicShimoteKamitePair(7, true)).toEqual([4, 3]);
    expect(classicShimoteKamitePair(7, false)).toEqual([3, 4]);
  });

  it("classic_pyramid and mid-heavy presets place the expected front-to-back rows", () => {
    expect(rowCountsFrontToBack(dancersForLayoutPreset(7, "classic_pyramid"))).toEqual([
      1, 2, 4,
    ]);
    expect(
      rowCountsFrontToBack(dancersForLayoutPreset(7, "classic_rows_mid_heavy"))
    ).toEqual([2, 3, 2]);
    expect(
      rowCountsFrontToBack(dancersForLayoutPreset(7, "classic_rows_front_light"))
    ).toEqual([3, 4]);
    expect(
      rowCountsFrontToBack(dancersForLayoutPreset(7, "classic_rows_front_heavy"))
    ).toEqual([4, 3]);
  });

  it("上手少 puts fewer people on the right (上手)", () => {
    const spots = dancersForLayoutPreset(7, "classic_kamite_light");
    const left = spots.filter((s) => s.xPct < 50).length;
    const right = spots.filter((s) => s.xPct >= 50).length;
    expect(left).toBe(4);
    expect(right).toBe(3);
  });
});
