import { describe, expect, it, beforeEach } from "vitest";
import {
  listLightingPresets,
  materializeLightingPreset,
  replaceLightsFromPreset,
  saveLightingPreset,
  deleteLightingPreset,
  LIGHTING_PRESETS_STORAGE_KEY,
} from "./lightingPresets";
import { createDefaultStageLight } from "./stageLighting";

describe("lightingPresets", () => {
  beforeEach(() => {
    localStorage.removeItem(LIGHTING_PRESETS_STORAGE_KEY);
  });

  it("saves and lists presets", () => {
    const a = {
      ...createDefaultStageLight("sideSpot"),
      id: "a",
      cueId: "c1",
      color: "#ef4444",
    };
    const res = saveLightingPreset("赤サイド", [a]);
    expect(res.ok).toBe(true);
    const list = listLightingPresets();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("赤サイド");
    expect(list[0]!.lights[0]!.color).toBe("#ef4444");
    expect(list[0]!.lights[0]!).not.toHaveProperty("cueId");
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
    expect(deleteLightingPreset(res.item.id)).toBe(true);
    expect(listLightingPresets()).toHaveLength(0);
  });
});
