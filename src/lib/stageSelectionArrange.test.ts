import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import {
  applyPositionSort,
  formatPositionSortPreview,
  permuteSlotsByHeightAsc,
} from "./stageSelectionArrange";

function spot(
  id: string,
  xPct: number,
  yPct: number,
  extra: Partial<DancerSpot> = {}
): DancerSpot {
  return { id, label: id, xPct, yPct, colorIndex: 0, ...extra };
}

describe("applyPositionSort", () => {
  it("all + height + asc matches the old slot permute", () => {
    const dancers = [
      spot("tall", 20, 40, { heightCm: 180 }),
      spot("short", 80, 40, { heightCm: 150 }),
      spot("mid", 50, 40, { heightCm: 165 }),
    ];
    const ids = dancers.map((d) => d.id);
    const next = applyPositionSort(dancers, ids, {
      axis: "height",
      scope: "all",
      direction: "asc",
    });
    const legacy = permuteSlotsByHeightAsc(dancers, ids);
    expect(next.map((d) => [d.id, d.xPct])).toEqual(legacy.map((d) => [d.id, d.xPct]));
  });

  it("row sorts each depth row independently without mixing rows", () => {
    const dancers = [
      spot("backTall", 20, 20, { heightCm: 180 }),
      spot("backShort", 80, 20, { heightCm: 150 }),
      spot("frontTall", 20, 80, { heightCm: 178 }),
      spot("frontShort", 80, 80, { heightCm: 148 }),
    ];
    const next = applyPositionSort(
      dancers,
      dancers.map((d) => d.id),
      { axis: "height", scope: "row", direction: "asc" }
    );
    const byId = Object.fromEntries(next.map((d) => [d.id, d]));
    expect(byId.backShort!.xPct).toBeLessThan(byId.backTall!.xPct);
    expect(byId.frontShort!.xPct).toBeLessThan(byId.frontTall!.xPct);
    expect(byId.backShort!.yPct).toBeLessThan(50);
    expect(byId.frontShort!.yPct).toBeGreaterThan(50);
  });

  it("col sorts each vertical column independently", () => {
    const dancers = [
      spot("leftHigh", 25, 20, { gradeLabel: "中3" }),
      spot("leftLow", 25, 80, { gradeLabel: "小1" }),
      spot("rightHigh", 75, 20, { gradeLabel: "高2" }),
      spot("rightLow", 75, 80, { gradeLabel: "小2" }),
    ];
    const next = applyPositionSort(
      dancers,
      dancers.map((d) => d.id),
      { axis: "grade", scope: "col", direction: "asc" }
    );
    const byId = Object.fromEntries(next.map((d) => [d.id, d]));
    expect(byId.leftLow!.yPct).toBeLessThan(byId.leftHigh!.yPct);
    expect(byId.rightLow!.yPct).toBeLessThan(byId.rightHigh!.yPct);
    expect(byId.leftLow!.xPct).toBeLessThan(50);
    expect(byId.rightLow!.xPct).toBeGreaterThan(50);
  });

  it("builds the preview sentence from axis, direction, and scope", () => {
    expect(
      formatPositionSortPreview({
        axis: "grade",
        scope: "col",
        direction: "asc",
      })
    ).toBe("学年が低学年から、縦一列で並べ替えます");
  });
});
