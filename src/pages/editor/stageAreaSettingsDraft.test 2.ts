import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clampGridSpacingCm,
  clampGuideIntervalToWidth,
  emptyStageAreaSettingsDraft,
  parseGridSpacingInput,
  parseMeterCmDraftToMm,
  projectToStageAreaDraft,
  stageAreaDraftHasMainFloor,
  stageAreaDraftToProjectPatch,
} from "./stageAreaSettingsDraft";
import { createEmptyProject } from "../../lib/projectDefaults";

describe("stageAreaSettingsDraft", () => {
  it("parseMeterCmDraftToMm converts m/cm to mm", () => {
    expect(parseMeterCmDraftToMm({ m: "12", cm: "34" })).toBe(12340);
    expect(parseMeterCmDraftToMm({ m: "", cm: "" })).toBeNull();
  });

  it("clampGuideIntervalToWidth respects half stage width", () => {
    expect(clampGuideIntervalToWidth(10000, 8000)).toBe(5000);
    expect(clampGuideIntervalToWidth(null, 500)).toBe(500);
  });

  it("clampGridSpacingCm bounds 1–100", () => {
    expect(clampGridSpacingCm(0)).toBe(1);
    expect(clampGridSpacingCm(150)).toBe(100);
    expect(clampGridSpacingCm(5.4)).toBe(5);
  });

  it("parseGridSpacingInput normalizes full-width digits", () => {
    expect(parseGridSpacingInput("１２")).toBe(12);
    expect(parseGridSpacingInput("3cm")).toBe(3);
  });

  it("projectToStageAreaDraft round-trips empty project defaults", () => {
    const p = createEmptyProject();
    const draft = projectToStageAreaDraft(p);
    expect(draft.audienceEdge).toBe("bottom");
    expect(draft.dancerLabelPosition).toBe("inside");
    expect(stageAreaDraftHasMainFloor(draft)).toBe(false);
  });

  it("stageAreaDraftToProjectPatch applies dimensions", () => {
    const draft = {
      ...emptyStageAreaSettingsDraft(),
      width: { m: "10", cm: "0" },
      depth: { m: "8", cm: "0" },
      gridWidthCm: 2,
      gridDepthCm: 3,
      stageGridLinesVerticalEnabled: true,
      stageGridLinesHorizontalEnabled: false,
    };
    expect(stageAreaDraftHasMainFloor(draft)).toBe(true);
    const patch = stageAreaDraftToProjectPatch(draft);
    expect(patch.stageWidthMm).toBe(10000);
    expect(patch.stageDepthMm).toBe(8000);
    expect(patch.stageGridSpacingWidthMm).toBe(20);
    expect(patch.stageGridSpacingDepthMm).toBe(30);
  });
});
