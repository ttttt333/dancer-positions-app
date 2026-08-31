import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import { rotateDancerRingOneStep } from "./stageSelectionArrange";
import { getEffectiveDancerPosition } from "./stageEffectivePosition";
import {
  applyPositionRotationDraft,
  draftPositionRotation,
  positionRotationLabel,
} from "./stagePositionRotation";

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

describe("rotateDancerRingOneStep identity", () => {
  const dancers = [
    spot("a", 20, 40, { colorIndex: 1, label: "A" }),
    spot("b", 80, 40, { colorIndex: 2, label: "B" }),
    spot("c", 50, 70, { colorIndex: 3, label: "C" }),
    spot("other", 90, 10, { colorIndex: 9, label: "keep" }),
  ];
  const ids = ["a", "b", "c"];

  it("does not reorder dancers[] and only changes x/y of the selection", () => {
    const next = rotateDancerRingOneStep(dancers, ids, "cw");
    expect(next.map((d) => d.id)).toEqual(dancers.map((d) => d.id));
    expect(next[3]).toEqual(dancers[3]);
    for (let i = 0; i < 3; i++) {
      expect(identityFields(next[i]!)).toEqual(identityFields(dancers[i]!));
    }
    const moved = next
      .slice(0, 3)
      .some((d, i) => d.xPct !== dancers[i]!.xPct || d.yPct !== dancers[i]!.yPct);
    expect(moved).toBe(true);
  });

  it("keeps the same coordinate set: people move, slots stay", () => {
    const next = rotateDancerRingOneStep(dancers, ids, "cw");
    const beforeSlots = dancers
      .slice(0, 3)
      .map((d) => `${d.xPct},${d.yPct}`)
      .sort();
    const afterSlots = next
      .slice(0, 3)
      .map((d) => `${d.xPct},${d.yPct}`)
      .sort();
    expect(afterSlots).toEqual(beforeSlots);
    expect(next[0]!.xPct).not.toBe(dancers[0]!.xPct);
  });
});

describe("draftPositionRotation", () => {
  const dancers = [
    spot("a", 20, 40, { colorIndex: 1, label: "A" }),
    spot("b", 80, 40, { colorIndex: 2, label: "B" }),
    spot("c", 50, 70, { colorIndex: 3, label: "C" }),
    spot("other", 90, 10, { colorIndex: 9, label: "keep" }),
  ];
  const ids = ["a", "b", "c"];

  it("Preview switch cw → ccw does not mutate Project", () => {
    const origin = dancers.map((d) => ({ ...d }));
    const cw = draftPositionRotation(dancers, ids, "cw");
    const ccw = draftPositionRotation(dancers, ids, "ccw");
    expect(cw?.direction).toBe("cw");
    expect(ccw?.direction).toBe("ccw");
    expect(dancers).toEqual(origin);
    expect(cw!.positions).not.toEqual(ccw!.positions);
  });

  it("Apply once writes only the last direction; identity stays", () => {
    const origin = dancers.map((d) => ({ ...d }));
    draftPositionRotation(origin, ids, "cw");
    const last = draftPositionRotation(origin, ids, "ccw");
    const project = applyPositionRotationDraft(origin, last);
    expect(project.map((d) => d.id)).toEqual(origin.map((d) => d.id));
    expect(project[3]).toEqual(origin[3]);
    for (let i = 0; i < 3; i++) {
      expect(identityFields(project[i]!)).toEqual(identityFields(origin[i]!));
      const pos = last!.positions.get(origin[i]!.id);
      if (pos) {
        expect(project[i]!.xPct).toBe(pos.xPct);
        expect(project[i]!.yPct).toBe(pos.yPct);
      }
    }
  });

  it("Cancel leaves Project unchanged", () => {
    const origin = dancers.map((d) => ({ ...d }));
    draftPositionRotation(dancers, ids, "cw");
    expect(applyPositionRotationDraft(dancers, null)).toEqual(origin);
  });

  it("labels directions for the preview chrome", () => {
    expect(positionRotationLabel("cw")).toBe("右回り 1人");
    expect(positionRotationLabel("ccw")).toBe("左回り 1人");
  });

  it("rotation overlay is used for effective position until Apply", () => {
    const dancers = [
      spot("a", 20, 40),
      spot("b", 80, 40),
      spot("c", 50, 70),
    ];
    const draft = draftPositionRotation(dancers, ["a", "b", "c"], "cw")!;
    const a = getEffectiveDancerPosition(dancers[0]!, {
      rotationPreviewById: draft.positions,
    });
    expect(a.xPct).toBe(draft.positions.get("a")!.xPct);
    expect(dancers[0]!.xPct).toBe(20);
  });
});
