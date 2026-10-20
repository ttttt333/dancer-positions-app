import { beforeEach, describe, expect, it } from "vitest";
import {
  listStagePresets,
  saveStagePreset,
  stagePresetGuideSnapshot,
  stagePresetHasGuideFields,
} from "./stagePresets";

describe("stagePresets heso / curtains", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips heso marks and sleeve curtains", () => {
    const result = saveStagePreset("ホールA", {
      stageWidthMm: 10000,
      stageDepthMm: 8000,
      sideStageMm: 2000,
      backStageMm: 1500,
      centerFieldGuideIntervalMm: 1000,
      stageHesoVisible: true,
      stageCenterMarks: [
        {
          id: "m1",
          xPct: 40,
          yPct: 55,
          label: "ヘソ",
          rxPct: 2.5,
          shape: "circle",
        },
      ],
      stageSleeveCurtains: [
        {
          id: "c1",
          depthMm: 2500,
          label: "そで幕1",
          side: "both",
          insetMm: 450,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const listed = listStagePresets();
    expect(listed).toHaveLength(1);
    const item = listed[0]!;
    expect(stagePresetHasGuideFields(item)).toBe(true);
    expect(item.stageHesoVisible).toBe(true);
    expect(item.stageCenterMarks).toHaveLength(1);
    expect(item.stageCenterMarks?.[0]?.xPct).toBe(40);
    expect(item.stageSleeveCurtains).toHaveLength(1);
    expect(item.stageSleeveCurtains?.[0]?.depthMm).toBe(2500);
  });

  it("keeps legacy presets without guide fields", () => {
    localStorage.setItem(
      "choreogrid_stage_presets_v1",
      JSON.stringify([
        {
          id: "legacy",
          name: "旧",
          stageWidthMm: 9000,
          stageDepthMm: 7000,
          sideStageMm: null,
          backStageMm: null,
          centerFieldGuideIntervalMm: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ])
    );
    const item = listStagePresets()[0]!;
    expect(stagePresetHasGuideFields(item)).toBe(false);
    expect(item.stageCenterMarks).toBeUndefined();
    expect(item.stageSleeveCurtains).toBeUndefined();
  });

  it("stagePresetGuideSnapshot normalizes empty heso on", () => {
    const snap = stagePresetGuideSnapshot({
      stageHesoVisible: true,
      stageCenterMarks: [],
      stageSleeveCurtains: [],
    });
    expect(snap.stageHesoVisible).toBe(true);
    expect(snap.stageCenterMarks?.length).toBe(1);
    expect(snap.stageCenterMarks?.[0]?.label).toBe("ヘソ");
  });
});
