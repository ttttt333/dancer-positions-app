import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import {
  generateDepthSwapPreview,
  inspectFormationDepthSwap,
} from "./stageDepthPreview";
import {
  applyShapePositionsToDancers,
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

describe("inspectFormationDepthSwap", () => {
  it("reports vertical columns for a 3-column grid", () => {
    const dancers = [
      spot("a1", 20, 10),
      spot("b1", 50, 10),
      spot("c1", 80, 10),
      spot("a2", 20, 40),
      spot("b2", 50, 40),
      spot("c2", 80, 40),
    ];
    const ids = dancers.map((d) => d.id);
    const info = inspectFormationDepthSwap(dancers, ids);
    expect(info.axis).toBe("vertical-columns");
    expect(info.unit).toBe("列");
    expect(info.axisHint).toBe("3列として判定");
    expect(info.groupCount).toBe(3);
    expect(info.groupLines).toEqual(["① 2人", "② 2人", "③ 2人"]);
    expect(info.pairs.map((p) => ({ colA: p.colA, colB: p.colB }))).toEqual([
      { colA: 0, colB: 1 },
      { colA: 0, colB: 2 },
      { colA: 1, colB: 2 },
    ]);
    expect(info.pairs.every((p) => p.noChange)).toBe(true);
    expect(info.pairs.every((p) => p.movementLabel === "なし")).toBe(true);
  });

  it("reports depth rows for a wedge", () => {
    const dancers = [
      spot("backL", 45, 18),
      spot("backR", 55, 18),
      spot("m1", 35, 45),
      spot("m2", 50, 45),
      spot("m3", 65, 45),
      spot("f1", 25, 78),
      spot("f2", 50, 82),
      spot("f3", 75, 78),
    ];
    const info = inspectFormationDepthSwap(
      dancers,
      dancers.map((d) => d.id)
    );
    expect(info.axis).toBe("depth-rows");
    expect(info.unit).toBe("段");
    expect(info.groupCount).toBeGreaterThanOrEqual(2);
    expect(info.axisHint).toContain("段として判定");
    expect(info.groupLines[0]?.startsWith("①")).toBe(true);
  });

  it("keeps V5 as 3 groups in ①②③ form even if axis is columns", () => {
    const dancers = generateShapeSlots(5, "vee").map((s, i) =>
      spot(`v${i}`, s.xPct, s.yPct)
    );
    const info = inspectFormationDepthSwap(
      dancers,
      dancers.map((d) => d.id)
    );
    expect(info.groupCount).toBe(3);
    expect(info.groupLines).toEqual(["① 2人", "② 2人", "③ 1人"]);
    expect(info.axisHint).toBe("3列として判定");
    expect(info.pairs.some((p) => !p.noChange)).toBe(true);
    expect(info.pairs.map((p) => `${p.markA}⇄${p.markB}`)).toEqual([
      "①⇄②",
      "①⇄③",
      "②⇄③",
    ]);
  });

  it("marks an offset 3-column grid as a real move", () => {
    const dancers = [
      spot("l1", 25, 28),
      spot("c1", 50, 35),
      spot("r1", 75, 42),
      spot("l2", 25, 58),
      spot("c2", 50, 65),
      spot("r2", 75, 72),
    ];
    const info = inspectFormationDepthSwap(
      dancers,
      dancers.map((d) => d.id)
    );
    expect(info.axisHint).toBe("3列として判定");
    expect(info.pairs[0]?.noChange).toBe(false);
    expect(info.pairs[0]?.movementLabel).not.toBe("なし");
  });
});

describe("generateDepthSwapPreview", () => {
  it("changes only yPct and keeps identity / unselected / array order", () => {
    const dancers = [
      spot("a", 30, 10, { label: "A", colorIndex: 2 }),
      spot("b", 30, 30, { label: "B", colorIndex: 3 }),
      spot("c", 30, 50, { label: "C", colorIndex: 4 }),
      spot("d", 70, 12, { label: "D", colorIndex: 5 }),
      spot("e", 70, 32, { label: "E", colorIndex: 6 }),
      spot("f", 70, 52, { label: "F", colorIndex: 7 }),
      spot("other", 90, 90, { label: "keep", colorIndex: 1 }),
    ];
    const selectedIds = ["a", "b", "c", "d", "e", "f"];
    const byId = generateDepthSwapPreview(dancers, selectedIds, 0, 1);
    expect(byId.size).toBeGreaterThan(0);
    expect(byId.has("other")).toBe(false);

    for (const [id, pos] of byId) {
      const prev = dancers.find((d) => d.id === id)!;
      expect(pos.xPct).toBe(prev.xPct);
      expect(pos.yPct).not.toBe(prev.yPct);
    }

    const next = applyShapePositionsToDancers(dancers, byId);
    expect(next.map((d) => d.id)).toEqual(dancers.map((d) => d.id));
    expect(next[6]).toEqual(dancers[6]);
    for (let i = 0; i < 6; i++) {
      const before = dancers[i]!;
      const after = next[i]!;
      expect(after.label).toBe(before.label);
      expect(after.crewMemberId).toBe(before.crewMemberId);
      expect(after.colorIndex).toBe(before.colorIndex);
      expect(after.xPct).toBe(before.xPct);
    }
  });
});

describe("getEffectiveDancerPosition depth overlay", () => {
  it("uses depth preview when there is no shape preview", () => {
    const d = spot("a", 10, 20);
    expect(
      getEffectiveDancerPosition(d, {
        depthPreviewById: new Map([["a", { xPct: 10, yPct: 70 }]]),
      })
    ).toEqual({ xPct: 10, yPct: 70 });
  });
});
