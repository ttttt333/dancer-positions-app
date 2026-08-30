import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "./dancerSpacing";
import {
  applyShapePositionsToDancers,
  generateShapePreview,
  generateShapeSlots,
  shapeSlotsOverlap,
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

function identityFields(d: DancerSpot) {
  const { xPct: _x, yPct: _y, ...rest } = d;
  return rest;
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

describe("FORMATION SHAPE vee slots", () => {
  const counts = [3, 4, 5, 6, 7, 8, 9] as const;

  it.each(counts)("n=%i: slot count, no overlap, in range", (n) => {
    const slots = generateShapeSlots(n, "vee");
    expect(slots).toHaveLength(n);
    expect(shapeSlotsOverlap(slots)).toBe(false);
    for (const s of slots) {
      expect(s.xPct).toBeGreaterThanOrEqual(DANCER_STAGE_POSITION_PCT_LO);
      expect(s.xPct).toBeLessThanOrEqual(DANCER_STAGE_POSITION_PCT_HI);
      expect(s.yPct).toBeGreaterThanOrEqual(DANCER_STAGE_POSITION_PCT_LO);
      expect(s.yPct).toBeLessThanOrEqual(DANCER_STAGE_POSITION_PCT_HI);
    }
  });

  it("odd n has one independent center tip at the audience side", () => {
    for (const n of [3, 5, 7, 9]) {
      const slots = generateShapeSlots(n, "vee");
      const maxY = Math.max(...slots.map((s) => s.yPct));
      const front = slots.filter((s) => Math.abs(s.yPct - maxY) < 0.2);
      expect(front).toHaveLength(1);
      expect(front[0]!.xPct).toBeCloseTo(50, 5);
      const left = slots.filter((s) => s.xPct < 49.5);
      const right = slots.filter((s) => s.xPct > 50.5);
      expect(left).toHaveLength(right.length);
    }
  });

  it("even n has two independent front slots, not a stacked tip", () => {
    for (const n of [4, 6, 8]) {
      const slots = generateShapeSlots(n, "vee");
      const maxY = Math.max(...slots.map((s) => s.yPct));
      const front = slots.filter((s) => Math.abs(s.yPct - maxY) < 0.2);
      expect(front).toHaveLength(2);
      expect(front[0]!.xPct).not.toBeCloseTo(front[1]!.xPct, 1);
      expect(slots.filter((s) => Math.abs(s.xPct - 50) < 0.4)).toHaveLength(0);
    }
  });

  it.each(counts)(
    "n=%i: identity stays, only x/y change, unselected untouched",
    (n) => {
      const selected = Array.from({ length: n }, (_, i) =>
        spot(`d${i}`, 12 + i * 8, 20 + (i % 3) * 10, {
          colorIndex: i,
          label: `L${i}`,
        })
      );
      const other = spot("other", 90, 90, { label: "keep", colorIndex: 9 });
      const dancers = [...selected, other];
      const result = generateShapePreview({
        dancers,
        selectedIds: selected.map((d) => d.id),
        presetId: "vee",
      });
      expect(result.positions.size).toBe(n);
      expect(result.positions.has("other")).toBe(false);

      const next = applyShapePositionsToDancers(dancers, result.positions);
      expect(next.map((d) => d.id)).toEqual(dancers.map((d) => d.id));
      expect(next[n]).toEqual(other);
      for (let i = 0; i < n; i++) {
        expect(identityFields(next[i]!)).toEqual(identityFields(selected[i]!));
        const pos = result.positions.get(selected[i]!.id)!;
        expect(next[i]!.xPct).toBe(pos.xPct);
        expect(next[i]!.yPct).toBe(pos.yPct);
      }
    }
  );

  it.each(counts)(
    "n=%i: min-cost assignment keeps people on nearby slots (not array order)",
    (n) => {
      const slots = generateShapeSlots(n, "vee");
      const dancers = slots
        .map((s, i) => spot(`p${i}`, s.xPct, s.yPct))
        .reverse();
      const result = generateShapePreview({
        dancers,
        selectedIds: dancers.map((d) => d.id),
        presetId: "vee",
      });
      expect(result.movementCostPct).toBeLessThan(0.001);
      for (const d of dancers) {
        const pos = result.positions.get(d.id)!;
        expect(pos.xPct).toBeCloseTo(d.xPct, 5);
        expect(pos.yPct).toBeCloseTo(d.yPct, 5);
      }
    }
  );
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

  it("maps a 3-person vee by current position, not array order", () => {
    const dancers = [
      spot("right", 80, 40),
      spot("left", 20, 40),
      spot("tip", 50, 70),
    ];
    const result = generateShapePreview({
      dancers,
      selectedIds: ["right", "left", "tip"],
      presetId: "vee",
    });
    const left = result.positions.get("left")!;
    const right = result.positions.get("right")!;
    const tip = result.positions.get("tip")!;
    expect(left.xPct).toBeLessThan(right.xPct);
    expect(tip.yPct).toBeGreaterThan(left.yPct);
    expect(tip.xPct).toBeCloseTo(50, 5);
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
