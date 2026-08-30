import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import {
  applyShapePositionsToDancers,
  generateShapePreview,
  generateShapeSlots,
} from "./stageShapeGenerator";
import { getEffectiveDancerPosition } from "./stageEffectivePosition";

function spot(
  id: string,
  xPct: number,
  yPct: number,
  extra: Partial<DancerSpot> = {}
): DancerSpot {
  return {
    id,
    label: id,
    xPct,
    yPct,
    colorIndex: 0,
    crewMemberId: `crew-${id}`,
    ...extra,
  };
}

describe("generateShapeSlots", () => {
  it("returns only coordinates for line / vertical / vee", () => {
    for (const id of ["line", "line_vertical", "vee"] as const) {
      const slots = generateShapeSlots(5, id);
      expect(slots).toHaveLength(5);
      for (const s of slots) {
        expect(Number.isFinite(s.xPct)).toBe(true);
        expect(Number.isFinite(s.yPct)).toBe(true);
      }
    }
  });

  it("puts a line on one y and a vertical line on one x", () => {
    const line = generateShapeSlots(4, "line");
    expect(new Set(line.map((s) => s.yPct)).size).toBe(1);
    const vert = generateShapeSlots(4, "line_vertical");
    expect(new Set(vert.map((s) => s.xPct)).size).toBe(1);
  });
});

describe("generateShapePreview", () => {
  it("keeps ids and does not touch unselected dancers", () => {
    const dancers = [
      spot("a", 10, 20),
      spot("b", 80, 25),
      spot("c", 50, 70),
      spot("other", 90, 90, { label: "keep", colorIndex: 3 }),
    ];
    const result = generateShapePreview({
      dancers,
      selectedIds: ["a", "b", "c"],
      presetId: "vee",
    });
    expect([...result.positions.keys()].sort()).toEqual(["a", "b", "c"]);
    expect(result.positions.has("other")).toBe(false);

    const next = applyShapePositionsToDancers(dancers, result.positions);
    expect(next.map((d) => d.id)).toEqual(["a", "b", "c", "other"]);
    expect(next[3]).toEqual(dancers[3]);
    for (const d of next.slice(0, 3)) {
      expect(d.label).toBe(d.id);
      expect(d.crewMemberId).toBe(`crew-${d.id}`);
      expect(d.colorIndex).toBe(0);
    }
  });

  it("assigns nearest slots instead of array order", () => {
    const dancers = [
      spot("left", 20, 40),
      spot("right", 80, 40),
      spot("center", 50, 70),
    ];
    const result = generateShapePreview({
      dancers,
      selectedIds: ["left", "right", "center"],
      presetId: "line",
    });
    const left = result.positions.get("left")!;
    const right = result.positions.get("right")!;
    expect(left.xPct).toBeLessThan(right.xPct);
    expect(result.movementCostPct).toBeGreaterThan(0);
    expect(dancers[0]).toEqual(spot("left", 20, 40));
  });
});

describe("getEffectiveDancerPosition", () => {
  it("prefers shape preview over persisted coordinates", () => {
    const d = spot("a", 10, 20);
    const preview = new Map([["a", { xPct: 40, yPct: 50 }]]);
    expect(getEffectiveDancerPosition(d, { shapePreviewById: preview })).toEqual({
      xPct: 40,
      yPct: 50,
    });
    expect(getEffectiveDancerPosition(d, {})).toEqual({ xPct: 10, yPct: 20 });
  });

  it("prefers shape preview over group rotate draft", () => {
    const d = spot("a", 10, 20);
    expect(
      getEffectiveDancerPosition(d, {
        shapePreviewById: new Map([["a", { xPct: 40, yPct: 50 }]]),
        groupPosDraft: new Map([["a", { xPct: 70, yPct: 80 }]]),
      })
    ).toEqual({ xPct: 40, yPct: 50 });
  });
});

describe("existing vee slots (used as-is)", () => {
  it("keeps odd-n left-heavy arms and a shared tip", () => {
    const slots = generateShapeSlots(7, "vee");
    expect(slots).toHaveLength(7);
    const leftArm = slots.filter((s) => s.xPct < 49.5);
    const rightArm = slots.filter((s) => s.xPct > 50.5);
    const tip = slots.filter((s) => Math.abs(s.xPct - 50) < 0.6);
    expect(leftArm.length).toBeGreaterThan(rightArm.length);
    expect(tip.length).toBeGreaterThanOrEqual(2);
  });
});
