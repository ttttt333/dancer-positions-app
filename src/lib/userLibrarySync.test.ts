import { beforeEach, describe, expect, it } from "vitest";
import {
  FORMATION_BOX_STORAGE_KEY,
  listFormationBoxItems,
  mergeFormationBoxItems,
  type FormationBoxItem,
} from "./formationBox";
import {
  FORMATION_PRESET_FAVORITES_STORAGE_KEY,
  loadFormationPresetFavoriteIds,
  loadFormationPresetFavoritesState,
  mergeFormationPresetFavorites,
  saveFormationPresetFavoriteIds,
} from "./formationPresetFavorites";
import {
  listStagePresets,
  mergeStagePresetItems,
  STAGE_PRESETS_STORAGE_KEY,
  type StagePresetItem,
} from "./stagePresets";
import {
  applyRemoteUserLibraryPayload,
  buildLocalUserLibraryPayload,
  resetUserLibrarySyncForTests,
  type UserLibraryPayloadV1,
} from "./userLibrarySync";

function boxItem(
  partial: Partial<FormationBoxItem> & Pick<FormationBoxItem, "id" | "updatedAt">
): FormationBoxItem {
  return {
    id: partial.id,
    name: partial.name ?? "形",
    dancerCount: partial.dancerCount ?? 1,
    dancers: partial.dancers ?? [{ xPct: 50, yPct: 50 }],
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt,
  };
}

function stageItem(
  partial: Partial<StagePresetItem> & Pick<StagePresetItem, "id" | "updatedAt">
): StagePresetItem {
  return {
    id: partial.id,
    name: partial.name ?? "ステージ",
    stageWidthMm: partial.stageWidthMm ?? 10000,
    stageDepthMm: partial.stageDepthMm ?? 8000,
    sideStageMm: partial.sideStageMm ?? null,
    backStageMm: partial.backStageMm ?? null,
    centerFieldGuideIntervalMm: partial.centerFieldGuideIntervalMm ?? null,
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt,
  };
}

describe("user library merge", () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserLibrarySyncForTests();
  });

  it("merges formation box by id with newer updatedAt", () => {
    localStorage.setItem(
      FORMATION_BOX_STORAGE_KEY,
      JSON.stringify([boxItem({ id: "a", updatedAt: 10, name: "旧" })])
    );
    const result = mergeFormationBoxItems([
      boxItem({ id: "a", updatedAt: 20, name: "新" }),
      boxItem({ id: "b", updatedAt: 5, name: "追加" }),
    ]);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.changed).toBe(true);
    const list = listFormationBoxItems();
    expect(list.find((x) => x.id === "a")?.name).toBe("新");
    expect(list.find((x) => x.id === "b")?.name).toBe("追加");
  });

  it("does not overwrite newer local formation box items", () => {
    localStorage.setItem(
      FORMATION_BOX_STORAGE_KEY,
      JSON.stringify([boxItem({ id: "a", updatedAt: 50, name: "ローカル新" })])
    );
    const result = mergeFormationBoxItems([
      boxItem({ id: "a", updatedAt: 10, name: "リモート旧" }),
    ]);
    expect(result.changed).toBe(false);
    expect(listFormationBoxItems()[0]?.name).toBe("ローカル新");
  });

  it("merges stage presets by id with newer updatedAt", () => {
    localStorage.setItem(
      STAGE_PRESETS_STORAGE_KEY,
      JSON.stringify([stageItem({ id: "s1", updatedAt: 1, stageWidthMm: 9000 })])
    );
    const result = mergeStagePresetItems([
      stageItem({ id: "s1", updatedAt: 9, stageWidthMm: 12000 }),
      stageItem({ id: "s2", updatedAt: 2 }),
    ]);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
    const list = listStagePresets();
    expect(list.find((x) => x.id === "s1")?.stageWidthMm).toBe(12000);
    expect(list.some((x) => x.id === "s2")).toBe(true);
  });

  it("LWW favorites by updatedAt", () => {
    saveFormationPresetFavoriteIds(["pyramid"], 100);
    const older = mergeFormationPresetFavorites({
      ids: ["vee"],
      updatedAt: 50,
    });
    expect(older.changed).toBe(false);
    expect(loadFormationPresetFavoriteIds()).toEqual(["pyramid"]);

    const newer = mergeFormationPresetFavorites({
      ids: ["vee", "grid"],
      updatedAt: 200,
    });
    expect(newer.changed).toBe(true);
    expect(loadFormationPresetFavoriteIds()).toEqual(["vee", "grid"]);
    expect(loadFormationPresetFavoritesState().updatedAt).toBe(200);
  });

  it("unions favorites when updatedAt ties", () => {
    saveFormationPresetFavoriteIds(["pyramid"], 10);
    mergeFormationPresetFavorites({ ids: ["vee"], updatedAt: 10 });
    expect(new Set(loadFormationPresetFavoriteIds())).toEqual(
      new Set(["pyramid", "vee"])
    );
  });

  it("applyRemoteUserLibraryPayload merges all three libraries", () => {
    saveFormationPresetFavoriteIds(["pyramid"], 1);
    localStorage.setItem(
      FORMATION_BOX_STORAGE_KEY,
      JSON.stringify([boxItem({ id: "local", updatedAt: 1 })])
    );
    localStorage.setItem(
      STAGE_PRESETS_STORAGE_KEY,
      JSON.stringify([stageItem({ id: "sp-local", updatedAt: 1 })])
    );

    const remote: UserLibraryPayloadV1 = {
      v: 1,
      formationBox: [boxItem({ id: "remote", updatedAt: 2, name: "remote" })],
      stagePresets: [stageItem({ id: "sp-remote", updatedAt: 2 })],
      presetFavorites: { ids: ["vee"], updatedAt: 5 },
      clientUpdatedAt: 5,
    };
    const { mergedFromRemote } = applyRemoteUserLibraryPayload(remote);
    expect(mergedFromRemote).toBe(true);
    expect(listFormationBoxItems().map((x) => x.id).sort()).toEqual([
      "local",
      "remote",
    ]);
    expect(listStagePresets().map((x) => x.id).sort()).toEqual([
      "sp-local",
      "sp-remote",
    ]);
    expect(loadFormationPresetFavoriteIds()).toEqual(["vee"]);

    const payload = buildLocalUserLibraryPayload(99);
    expect(payload.v).toBe(1);
    expect(payload.formationBox.length).toBe(2);
    expect(payload.stagePresets.length).toBe(2);
    expect(payload.presetFavorites.ids).toEqual(["vee"]);
  });

  it("keeps legacy favorites array format readable", () => {
    localStorage.setItem(
      FORMATION_PRESET_FAVORITES_STORAGE_KEY,
      JSON.stringify(["pyramid", "vee"])
    );
    expect(loadFormationPresetFavoriteIds()).toEqual(["pyramid", "vee"]);
    expect(loadFormationPresetFavoritesState().updatedAt).toBe(0);
  });
});
