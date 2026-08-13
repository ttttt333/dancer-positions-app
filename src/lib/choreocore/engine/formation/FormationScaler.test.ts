/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { spreadForCue, stageToUnit, unitToStage, validateStageConfig } from "./FormationScaler";
import { FormationGenerationError } from "../types/FormationTypes";
import { DEFAULT_STAGE } from "./formationFixtures";

describe("FormationScaler", () => {
  it("maps unit coordinates onto the usable stage", () => {
    const p = unitToStage({ x: 0, y: 0, visualWeight: 1, role: "CENTER", groupId: 0 }, DEFAULT_STAGE);
    expect(p.x).toBeCloseTo(500, 5);
    expect(p.y).toBeCloseTo(300, 5);
    const back = stageToUnit(p, DEFAULT_STAGE);
    expect(back.x).toBeCloseTo(0, 5);
    expect(back.y).toBeCloseTo(0, 5);
  });

  it("EXPAND MAX uses more spread than CONTRACT MAX", () => {
    expect(spreadForCue("EXPAND", "MAX")).toBeGreaterThan(spreadForCue("CONTRACT", "MAX"));
  });

  it("rejects an unusable stage", () => {
    expect(() => validateStageConfig({ ...DEFAULT_STAGE, safeMargin: 800 })).toThrow(
      FormationGenerationError
    );
  });
});
