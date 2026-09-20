import { describe, expect, it } from "vitest";
import { dancersForLayoutPreset } from "./formationLayouts";
import {
  classicEvenRowCounts,
  classicEqualRowsPresetId,
  classicFrontHeavyTwoRows,
  classicFrontLightTwoRows,
  classicFrontStairFirstRowsUntilBackFewer,
  classicFrontStairRowCounts,
  classicMaxEqualRowSuggestions,
  classicPyramidRowCounts,
  classicShimoteKamitePair,
  classicSuggestionEntries,
  classicTriple323,
  classicTwoRowFrontProgression,
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

describe("classic equal horizontal rows", () => {
  it("scales max row suggestions with dancer count", () => {
    expect(classicMaxEqualRowSuggestions(3)).toBe(3);
    expect(classicMaxEqualRowSuggestions(7)).toBe(4);
    expect(classicMaxEqualRowSuggestions(16)).toBe(8);
    expect(classicMaxEqualRowSuggestions(30)).toBe(12);
  });

  it("maps row counts to existing preset ids", () => {
    expect(classicEqualRowsPresetId(1)).toBe("line");
    expect(classicEqualRowsPresetId(2)).toBe("two_rows_equal");
    expect(classicEqualRowsPresetId(4)).toBe("rows_4");
  });

  it("distributes people evenly front-light on remainder", () => {
    expect(classicEvenRowCounts(7, 3)).toEqual([2, 2, 3]);
    expect(classicEvenRowCounts(8, 4)).toEqual([2, 2, 2, 2]);
  });
});

describe("classicSuggestionEntries (7 dancers)", () => {
  it("follows the classic order for 7 people", () => {
    const ids = classicSuggestionEntries(7).map((e) => e.id);
    expect(ids).toEqual([
      "classic_pyramid",
      "front_stair_from_2",
      "front_stair_from_3",
      "front_stair_from_4",
      "classic_rows_mid_heavy",
      "classic_two_rows_1",
      "classic_two_rows_2",
      "classic_two_rows_3",
      "classic_two_rows_4",
      "line",
      "two_rows_equal",
      "rows_3",
      "rows_4",
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
    expect(byId.classic_two_rows_3).toContain("3-4");
    expect(byId.classic_two_rows_4).toContain("4-3");
    expect(byId.front_stair_from_2).toContain("2-3-2");
    expect(byId.front_stair_from_4).toContain("4-3");
    expect(byId.line).toBe("横1列");
    expect(byId.two_rows_equal).toContain("横2列");
    expect(byId.rows_3).toContain("横3列");
    expect(byId.rows_4).toContain("横4列");
    expect(byId.classic_kamite_light).toBe("上手3・下手4");
    expect(byId.classic_kamite_heavy).toBe("上手4・下手3");
  });
});

describe("classic progressive front suggestions", () => {
  it("grows 2-row front count until back is fewer than front", () => {
    expect(classicTwoRowFrontProgression(7)).toEqual([
      [1, 6],
      [2, 5],
      [3, 4],
      [4, 3],
    ]);
    expect(classicTwoRowFrontProgression(10)).toEqual([
      [1, 9],
      [2, 8],
      [3, 7],
      [4, 6],
      [5, 5],
      [6, 4],
    ]);
  });

  it("grows front_stair first row until 2nd row is fewer", () => {
    expect(classicFrontStairFirstRowsUntilBackFewer(7)).toEqual([2, 3, 4]);
    expect(classicFrontStairFirstRowsUntilBackFewer(15)).toEqual([
      2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(classicFrontStairRowCounts(15, 8)).toEqual([8, 7]);
  });

  it("keeps suggesting stair variants when the cast is large", () => {
    const stairs = classicSuggestionEntries(20)
      .map((e) => e.id)
      .filter((id) => id.startsWith("front_stair_from_"));
    expect(stairs[0]).toBe("front_stair_from_2");
    expect(stairs.at(-1)).toBe("front_stair_from_11");
    const twoRows = classicSuggestionEntries(20)
      .map((e) => e.id)
      .filter((id) => id.startsWith("classic_two_rows_"));
    expect(twoRows[0]).toBe("classic_two_rows_1");
    expect(twoRows.at(-1)).toBe("classic_two_rows_11");
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
