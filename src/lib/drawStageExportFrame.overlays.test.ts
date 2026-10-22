import { describe, expect, it } from "vitest";
import { resolveExportCenterMarks } from "./drawStageExportFrame";
import type { StageExportAppearance } from "./stageExportAppearance";

function baseAppearance(
  patch: Partial<StageExportAppearance> = {}
): StageExportAppearance {
  return {
    rotDeg: 0,
    Wmm: 10_000,
    Dmm: 8_000,
    Smm: 2_000,
    Bmm: 1_000,
    showShell: true,
    dancerLabelBelow: false,
    stageGridLinesVertical: false,
    stageGridLinesHorizontal: false,
    stepXPct: null,
    stepYPct: null,
    centerFieldGuideIntervalMm: null,
    ...patch,
  };
}

describe("resolveExportCenterMarks", () => {
  it("returns empty when heso is off", () => {
    expect(
      resolveExportCenterMarks(
        baseAppearance({
          stageHesoVisible: false,
          stageCenterMarks: [{ id: "a", xPct: 50, yPct: 50 }],
        })
      )
    ).toEqual([]);
  });

  it("uses stageCenterMarks when visible", () => {
    const marks = resolveExportCenterMarks(
      baseAppearance({
        stageHesoVisible: true,
        stageCenterMarks: [{ id: "a", xPct: 40, yPct: 60 }],
      })
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]?.id).toBe("a");
  });

  it("falls back to center heso when marks empty", () => {
    const marks = resolveExportCenterMarks(
      baseAppearance({
        stageHesoVisible: true,
        stageCenterMarks: [],
      })
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]?.xPct).toBe(50);
    expect(marks[0]?.yPct).toBe(50);
  });
});
