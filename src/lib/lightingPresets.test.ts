import { describe, expect, it, beforeEach } from "vitest";
import {
  listLightingPresets,
  materializeLightingPreset,
  replaceLightsFromPreset,
  saveLightingPreset,
  deleteLightingPreset,
  renameLightingPreset,
  LIGHTING_PRESETS_STORAGE_KEY,
  LIGHTING_SAMPLE_PRESET_IDS,
} from "./lightingPresets";
import { createDefaultStageLight } from "./stageLighting";

const SEED_FLAG = "choreogrid_lighting_presets_seeded_v2";

describe("lightingPresets", () => {
  beforeEach(() => {
    localStorage.removeItem(LIGHTING_PRESETS_STORAGE_KEY);
    localStorage.removeItem(SEED_FLAG);
  });

  it("saves and lists presets (with sample seed)", () => {
    const a = {
      ...createDefaultStageLight("sideSpot"),
      id: "a",
      cueId: "c1",
      color: "#ef4444",
    };
    const res = saveLightingPreset("赤サイド", [a]);
    expect(res.ok).toBe(true);
    const list = listLightingPresets();
    expect(list.some((x) => x.name === "赤サイド")).toBe(true);
    const saved = list.find((x) => x.name === "赤サイド")!;
    expect(saved.lights[0]!.color).toBe("#ef4444");
    expect(saved.lights[0]!).not.toHaveProperty("cueId");
    expect(
      LIGHTING_SAMPLE_PRESET_IDS.every((id) => list.some((x) => x.id === id))
    ).toBe(true);
  });

  it("seeds sample presets on first list", () => {
    const list = listLightingPresets();
    expect(list.length).toBe(LIGHTING_SAMPLE_PRESET_IDS.length);
    expect(list.some((x) => x.name === "基本照明（フル）")).toBe(true);
  });

  it("renames presets", () => {
    const res = saveLightingPreset("旧名", [
      createDefaultStageLight("pinSpot"),
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    listLightingPresets();
    const renamed = renameLightingPreset(res.item.id, "新名");
    expect(renamed.ok).toBe(true);
    expect(listLightingPresets().find((x) => x.id === res.item.id)?.name).toBe(
      "新名"
    );
  });

  it("replaceLightsFromPreset clears target cue then applies", () => {
    const presetRes = saveLightingPreset("p", [
      { ...createDefaultStageLight("pinSpot"), id: "x", cueId: "c1" },
    ]);
    expect(presetRes.ok).toBe(true);
    if (!presetRes.ok) return;
    const existing = [
      {
        ...createDefaultStageLight("sideSpot"),
        id: "old",
        cueId: "c2",
      },
      {
        ...createDefaultStageLight("backlight"),
        id: "g",
        cueId: null,
      },
    ];
    const next = replaceLightsFromPreset(existing, "c2", presetRes.item);
    expect(next.find((L) => L.id === "old")).toBeUndefined();
    expect(next.find((L) => L.id === "g")).toBeDefined();
    expect(next.filter((L) => L.cueId === "c2")).toHaveLength(1);
    expect(next.find((L) => L.cueId === "c2")!.kind).toBe("pinSpot");
  });

  it("materializeLightingPreset assigns new ids and cueId", () => {
    const res = saveLightingPreset("m", [
      createDefaultStageLight("footlight"),
      createDefaultStageLight("suspension"),
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const mats = materializeLightingPreset(res.item, "cue-z");
    expect(mats).toHaveLength(2);
    expect(mats.every((L) => L.cueId === "cue-z")).toBe(true);
    expect(new Set(mats.map((L) => L.id)).size).toBe(2);
  });

  it("deletes presets", () => {
    const res = saveLightingPreset("del", [createDefaultStageLight("pinSpot")]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    listLightingPresets();
    expect(deleteLightingPreset(res.item.id)).toBe(true);
    expect(
      listLightingPresets().find((x) => x.id === res.item.id)
    ).toBeUndefined();
  });
});
