import { describe, expect, it } from "vitest";
import {
  applyStagePresetToAreaDraft,
  emptyStageAreaSettingsDraft,
  stagePresetPayloadFromAreaDraft,
} from "./stageAreaSettingsDraft";
import type { StagePresetItem } from "../../lib/stagePresets";

describe("stage area preset ↔ draft", () => {
  it("payload includes heso and sleeves from draft", () => {
    const draft = emptyStageAreaSettingsDraft();
    draft.width = { m: "10", cm: "0" };
    draft.depth = { m: "8", cm: "0" };
    draft.stageHesoVisible = true;
    draft.stageCenterMarks = [
      {
        id: "h1",
        xPct: 50,
        yPct: 50,
        label: "ヘソ",
        rxPct: 2.5,
        shape: "circle",
      },
    ];
    draft.stageSleeves = [
      {
        id: "s1",
        label: "そで幕",
        depth: { m: "2", cm: "0" },
        side: "both",
        inset: { m: "0", cm: "45" },
        wingExtentMm: null,
      },
    ];
    const payload = stagePresetPayloadFromAreaDraft(draft);
    expect(payload.stageWidthMm).toBe(10000);
    expect(payload.stageHesoVisible).toBe(true);
    expect(payload.stageCenterMarks).toHaveLength(1);
    expect(payload.stageSleeveCurtains).toHaveLength(1);
    expect(payload.stageSleeveCurtains?.[0]?.depthMm).toBe(2000);
  });

  it("apply restores heso and sleeves for new presets", () => {
    const base = emptyStageAreaSettingsDraft();
    base.stageHesoVisible = false;
    base.stageSleeves = [];
    const item: StagePresetItem = {
      id: "p1",
      name: "会場",
      stageWidthMm: 12000,
      stageDepthMm: 9000,
      sideStageMm: 1500,
      backStageMm: null,
      centerFieldGuideIntervalMm: 1000,
      stageHesoVisible: true,
      stageCenterMarks: [
        {
          id: "m1",
          xPct: 30,
          yPct: 70,
          label: "ヘソ",
          rxPct: 3,
          shape: "circle",
        },
      ],
      stageSleeveCurtains: [
        { id: "c1", depthMm: 3000, label: "幕", side: "left", insetMm: 200 },
      ],
      createdAt: 1,
      updatedAt: 1,
    };
    const next = applyStagePresetToAreaDraft(base, item);
    expect(next.width.m).toBe("12");
    expect(next.stageHesoVisible).toBe(true);
    expect(next.stageCenterMarks[0]?.xPct).toBe(30);
    expect(next.stageSleeves).toHaveLength(1);
    expect(next.stageSleeves[0]?.side).toBe("left");
  });

  it("apply leaves guides alone for legacy presets", () => {
    const base = emptyStageAreaSettingsDraft();
    base.stageHesoVisible = true;
    base.stageCenterMarks = [
      {
        id: "keep",
        xPct: 10,
        yPct: 20,
        label: "既存",
        rxPct: 2,
        shape: "circle",
      },
    ];
    const legacy: StagePresetItem = {
      id: "old",
      name: "旧",
      stageWidthMm: 8000,
      stageDepthMm: 6000,
      sideStageMm: null,
      backStageMm: null,
      centerFieldGuideIntervalMm: null,
      createdAt: 1,
      updatedAt: 1,
    };
    const next = applyStagePresetToAreaDraft(base, legacy);
    expect(next.width.m).toBe("8");
    expect(next.stageHesoVisible).toBe(true);
    expect(next.stageCenterMarks[0]?.id).toBe("keep");
  });
});
