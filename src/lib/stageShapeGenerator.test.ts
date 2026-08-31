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
  STAGE_SHAPE_PRESETS,
  tryGenerateShapePreview,
  shapeSlotsOverlap,
} from "./stageShapeGenerator";
import { getEffectiveDancerPosition } from "./stageEffectivePosition";
import { safeShapeCardSlots, shapeCardDots } from "../components/StageFormationShapeCards";

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
  it("returns only coordinates for all FORMATION SHAPE presets", () => {
    for (const { id } of STAGE_SHAPE_PRESETS) {
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
  const counts = [3, 4, 5, 6, 7, 8, 9, 11] as const;

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
    for (const n of [3, 5, 7, 9, 11]) {
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

  it("falls back without 場ミリ when packed line slots would overlap", () => {
    const dancers = Array.from({ length: 11 }, (_, i) =>
      spot(`d${i}`, 10 + i * 7, 40)
    );
    expect(() =>
      generateShapePreview({
        dancers,
        selectedIds: dancers.map((d) => d.id),
        presetId: "line",
        layoutOpts: { dancerSpacingMm: 1500, stageWidthMm: 8000 },
      })
    ).toThrow(/overlap/);
    const result = generateShapePreview({
      dancers,
      selectedIds: dancers.map((d) => d.id),
      presetId: "line",
    });
    expect(result.positions.size).toBe(11);
  });

  it("11人・場ミリ・横一列: overlap したら ignoredSpacing でフォールバックする", () => {
    const dancers = Array.from({ length: 11 }, (_, i) =>
      spot(`d${i}`, 10 + i * 7, 40)
    );
    const outcome = tryGenerateShapePreview({
      dancers,
      selectedIds: dancers.map((d) => d.id),
      presetId: "line",
      layoutOpts: { dancerSpacingMm: 1500, stageWidthMm: 8000 },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.ignoredSpacing).toBe(true);
    expect(outcome.result.positions.size).toBe(11);
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

describe("shape cards use generator slot count", () => {
  it("5 / 8 / 11 people get that many slots and card dots", () => {
    for (const n of [5, 8, 11] as const) {
      for (const { id } of STAGE_SHAPE_PRESETS) {
        const slots = generateShapeSlots(n, id);
        expect(slots).toHaveLength(n);
        expect(shapeCardDots(slots)).toHaveLength(n);
      }
    }
  });

  it("does not throw when opening cards for 11 on a typical 場ミリ stage", () => {
    expect(() =>
      generateShapeSlots(11, "line", {
        dancerSpacingMm: 1500,
        stageWidthMm: 8000,
      })
    ).toThrow(/overlap/);
    for (const { id } of STAGE_SHAPE_PRESETS) {
      const slots = safeShapeCardSlots(11, id);
      expect(slots).toHaveLength(11);
      expect(shapeCardDots(slots)).toHaveLength(11);
    }
  });

  it("exposes 7 FORMATION SHAPE presets", () => {
    expect(STAGE_SHAPE_PRESETS.map((p) => p.label)).toEqual([
      "横一列",
      "縦一列",
      "V字",
      "W字",
      "円形",
      "三角形",
      "斜め",
    ]);
  });
});

const STEP8_COUNTS = [3, 4, 5, 6, 7, 8, 9, 11] as const;
const STEP8_PRESETS = ["w", "circle", "triangle", "diagonal"] as const;

function naiveOrderCost(
  dancers: DancerSpot[],
  slots: { xPct: number; yPct: number }[]
): number {
  let t = 0;
  for (let i = 0; i < dancers.length; i++) {
    const d = dancers[i]!;
    const s = slots[i]!;
    t += Math.hypot(d.xPct - s.xPct, d.yPct - s.yPct);
  }
  return t;
}

describe("STEP 8 W / circle / triangle / diagonal", () => {
  it.each(STEP8_PRESETS)(
    "%s: slot count, no overlap, in range for 3–11",
    (presetId) => {
      for (const n of STEP8_COUNTS) {
        const slots = generateShapeSlots(n, presetId);
        expect(slots).toHaveLength(n);
        expect(shapeSlotsOverlap(slots)).toBe(false);
        for (const s of slots) {
          expect(s.xPct).toBeGreaterThanOrEqual(DANCER_STAGE_POSITION_PCT_LO);
          expect(s.xPct).toBeLessThanOrEqual(DANCER_STAGE_POSITION_PCT_HI);
          expect(s.yPct).toBeGreaterThanOrEqual(DANCER_STAGE_POSITION_PCT_LO);
          expect(s.yPct).toBeLessThanOrEqual(DANCER_STAGE_POSITION_PCT_HI);
        }
      }
    }
  );

  it("W: two independent front valleys (audience side)", () => {
    for (const n of [3, 4, 5, 8, 11] as const) {
      const slots = generateShapeSlots(n, "w");
      const maxY = Math.max(...slots.map((s) => s.yPct));
      const front = slots.filter((s) => Math.abs(s.yPct - maxY) < 1.2);
      expect(front.length).toBeGreaterThanOrEqual(2);
      const xs = [...new Set(front.map((s) => s.xPct.toFixed(2)))];
      expect(xs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("circle: points sit on an ellipse around center", () => {
    const slots = generateShapeSlots(8, "circle");
    const cx = slots.reduce((s, p) => s + p.xPct, 0) / slots.length;
    const cy = slots.reduce((s, p) => s + p.yPct, 0) / slots.length;
    const rs = slots.map((s) =>
      Math.hypot((s.xPct - cx) / 28, (s.yPct - cy) / 24)
    );
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    for (const r of rs) {
      expect(Math.abs(r - mean)).toBeLessThan(0.08);
    }
  });

  it("triangle: one audience-side tip near center x", () => {
    for (const n of [3, 5, 8, 11] as const) {
      const slots = generateShapeSlots(n, "triangle");
      const maxY = Math.max(...slots.map((s) => s.yPct));
      const tip = slots.filter((s) => Math.abs(s.yPct - maxY) < 1.5);
      expect(tip.length).toBeGreaterThanOrEqual(1);
      expect(tip[0]!.xPct).toBeCloseTo(50, 0);
    }
  });

  it("diagonal: x and y increase together (left-back → right-front)", () => {
    const slots = [...generateShapeSlots(7, "diagonal")].sort(
      (a, b) => a.xPct - b.xPct
    );
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]!.xPct).toBeGreaterThan(slots[i - 1]!.xPct);
      expect(slots[i]!.yPct).toBeGreaterThan(slots[i - 1]!.yPct);
    }
  });

  it.each(STEP8_PRESETS)(
    "%s: identity stays, only x/y, unselected untouched",
    (presetId) => {
      for (const n of [3, 5, 8, 11] as const) {
        const selected = Array.from({ length: n }, (_, i) =>
          spot(`d${i}`, 12 + i * 6, 20 + (i % 3) * 12, {
            colorIndex: i,
            label: `L${i}`,
          })
        );
        const other = spot("other", 90, 90, { label: "keep", colorIndex: 9 });
        const dancers = [...selected, other];
        const result = generateShapePreview({
          dancers,
          selectedIds: selected.map((d) => d.id),
          presetId,
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
    }
  );

  it.each(STEP8_PRESETS)(
    "%s: min-cost assignment keeps people on nearby slots (not array order)",
    (presetId) => {
      for (const n of [5, 8, 11] as const) {
        const slots = generateShapeSlots(n, presetId);
        const dancers = slots
          .map((s, i) => spot(`p${i}`, s.xPct, s.yPct))
          .reverse();
        const result = generateShapePreview({
          dancers,
          selectedIds: dancers.map((d) => d.id),
          presetId,
        });
        expect(result.movementCostPct).toBeLessThan(0.001);
        expect(result.movementCostPct).toBeLessThan(
          naiveOrderCost(dancers, slots) - 1
        );
        for (const d of dancers) {
          const pos = result.positions.get(d.id)!;
          expect(pos.xPct).toBeCloseTo(d.xPct, 5);
          expect(pos.yPct).toBeCloseTo(d.yPct, 5);
        }
      }
    }
  );
});
