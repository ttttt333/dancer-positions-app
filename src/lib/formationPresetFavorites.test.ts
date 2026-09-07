import { describe, expect, it, beforeEach } from "vitest";
import {
  FORMATION_PRESET_FAVORITES_STORAGE_KEY,
  filterPresetItemsByFavorites,
  loadFormationPresetFavoriteIds,
  saveFormationPresetFavoriteIds,
  toggleFormationPresetFavoriteId,
} from "./formationPresetFavorites";

describe("formationPresetFavorites", () => {
  beforeEach(() => {
    localStorage.removeItem(FORMATION_PRESET_FAVORITES_STORAGE_KEY);
  });

  it("persists favorite ids", () => {
    saveFormationPresetFavoriteIds(["pyramid", "vee"]);
    expect(loadFormationPresetFavoriteIds()).toEqual(["pyramid", "vee"]);
  });

  it("toggles ids", () => {
    expect(toggleFormationPresetFavoriteId(["pyramid"], "vee")).toEqual([
      "pyramid",
      "vee",
    ]);
    expect(toggleFormationPresetFavoriteId(["pyramid", "vee"], "pyramid")).toEqual([
      "vee",
    ]);
  });

  it("filters categories when favoritesOnly", () => {
    const cats = [
      {
        label: "A",
        items: [
          { id: "pyramid" as const, label: "ピラミッド" },
          { id: "vee" as const, label: "V字" },
        ],
      },
      {
        label: "B",
        items: [{ id: "grid" as const, label: "グリッド" }],
      },
    ];
    const fav = new Set(["vee"]);
    const filtered = filterPresetItemsByFavorites(cats, fav, true);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.items.map((i) => i.id)).toEqual(["vee"]);
    expect(filterPresetItemsByFavorites(cats, fav, false)).toEqual(cats);
  });
});
