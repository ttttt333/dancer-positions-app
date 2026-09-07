import { describe, expect, it } from "vitest";
import { dancersForLayoutPreset, PRESET_CATEGORIES, LAYOUT_PRESET_OPTIONS } from "./formationLayouts";
import {
  allocateByWeights,
  COMPOSITE_LAYOUT_PRESET_OPTIONS,
} from "./formationLayoutPresetsComposite";

describe("composite formation presets", () => {
  it("allocateByWeights sums to n", () => {
    for (const n of [11, 23, 32, 45]) {
      const parts = allocateByWeights(n, [2, 1.2, 2], 1);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(n);
      expect(parts.every((p) => p >= 1)).toBe(true);
    }
  });

  it("places exactly n dancers for each composite preset", () => {
    for (const { id } of COMPOSITE_LAYOUT_PRESET_OPTIONS) {
      for (const n of [12, 23, 32, 45]) {
        const spots = dancersForLayoutPreset(n, id);
        expect(spots, `${id}@${n}`).toHaveLength(n);
      }
    }
  });

  it("registers all composite ids in categories without gaps", () => {
    const all = new Set(LAYOUT_PRESET_OPTIONS.map((o) => o.id));
    const inCat = PRESET_CATEGORIES.flatMap((c) => c.ids);
    for (const { id } of COMPOSITE_LAYOUT_PRESET_OPTIONS) {
      expect(all.has(id)).toBe(true);
      expect(inCat).toContain(id);
    }
    expect(inCat.filter((id, i) => inCat.indexOf(id) !== i)).toEqual([]);
  });
});
