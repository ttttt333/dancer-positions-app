import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import { resolveStageEditMode } from "./stageEditMode";
import {
  alignSelectedDancers,
  distributeSelectedDancers,
} from "./stageSelectionTransform";
import {
  applyStageTidyAction,
  draftTidyPreview,
  isStageTidyAvailable,
  STAGE_TIDY_ACTIONS,
  tidyActionLabel,
} from "./stageTidyActions";
import { applyShapePositionsToDancers } from "./stageShapeGenerator";
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

describe("isStageTidyAvailable", () => {
  it("shows 整える for FORMATION and GROUP, not DANCER", () => {
    expect(isStageTidyAvailable("formation")).toBe(true);
    expect(isStageTidyAvailable("group")).toBe(true);
    expect(isStageTidyAvailable("dancer")).toBe(false);
    expect(isStageTidyAvailable("none")).toBe(false);
  });

  it("follows edit-mode: 1人は DANCER、一部は GROUP、全員は FORMATION", () => {
    const formation = ["a", "b", "c", "d", "e"];
    expect(isStageTidyAvailable(resolveStageEditMode(["a"], formation))).toBe(
      false
    );
    expect(
      isStageTidyAvailable(resolveStageEditMode(["a", "b"], formation))
    ).toBe(true);
    expect(
      isStageTidyAvailable(resolveStageEditMode(formation, formation))
    ).toBe(true);
  });
});

describe("STAGE_TIDY_ACTIONS", () => {
  it("exposes the 6 choreographer-facing operations", () => {
    expect(STAGE_TIDY_ACTIONS.map((a) => a.label)).toEqual([
      "横にそろえる",
      "縦にそろえる",
      "等間隔（横）",
      "等間隔（縦）",
      "中央（左右）",
      "中央（上下）",
    ]);
  });

  it("reuses align centerY/X and distribute x/y", () => {
    expect(STAGE_TIDY_ACTIONS.find((a) => a.id === "align-row")).toMatchObject({
      kind: "align",
      edge: "centerY",
    });
    expect(STAGE_TIDY_ACTIONS.find((a) => a.id === "align-col")).toMatchObject({
      kind: "align",
      edge: "centerX",
    });
    expect(STAGE_TIDY_ACTIONS.find((a) => a.id === "distribute-x")).toMatchObject({
      kind: "distribute",
      axis: "x",
    });
    expect(STAGE_TIDY_ACTIONS.find((a) => a.id === "distribute-y")).toMatchObject({
      kind: "distribute",
      axis: "y",
    });
    expect(STAGE_TIDY_ACTIONS.find((a) => a.id === "center-x")).toMatchObject({
      kind: "align",
      edge: "centerX",
    });
    expect(STAGE_TIDY_ACTIONS.find((a) => a.id === "center-y")).toMatchObject({
      kind: "align",
      edge: "centerY",
    });
  });
});

describe("applyStageTidyAction", () => {
  const dancers = [
    spot("a", 20, 30, { colorIndex: 1, label: "A" }),
    spot("b", 55, 80, { colorIndex: 2, label: "B" }),
    spot("c", 40, 50, { colorIndex: 3, label: "C" }),
    spot("other", 90, 10, { colorIndex: 9, label: "keep" }),
  ];
  const ids = ["a", "b", "c"];

  it.each(STAGE_TIDY_ACTIONS.map((a) => a.id))(
    "%s: keeps order, identity, and unselected",
    (actionId) => {
      const next = applyStageTidyAction(dancers, ids, actionId);
      expect(next.map((d) => d.id)).toEqual(dancers.map((d) => d.id));
      expect(identityFields(next[3]!)).toEqual(identityFields(dancers[3]!));
      expect(next[3]).toEqual(dancers[3]);
      for (let i = 0; i < 3; i++) {
        expect(identityFields(next[i]!)).toEqual(identityFields(dancers[i]!));
      }
    }
  );

  it("横にそろえる / 中央（上下）: Y only via align centerY", () => {
    const expected = alignSelectedDancers(dancers, ids, "centerY");
    expect(applyStageTidyAction(dancers, ids, "align-row")).toEqual(expected);
    expect(applyStageTidyAction(dancers, ids, "center-y")).toEqual(expected);
    const next = expected;
    expect(next[0]!.xPct).toBe(20);
    expect(next[1]!.xPct).toBe(55);
    expect(next[2]!.xPct).toBe(40);
    expect(next[0]!.yPct).toBe(next[1]!.yPct);
    expect(next[1]!.yPct).toBe(next[2]!.yPct);
  });

  it("縦にそろえる / 中央（左右）: X only via align centerX", () => {
    const expected = alignSelectedDancers(dancers, ids, "centerX");
    expect(applyStageTidyAction(dancers, ids, "align-col")).toEqual(expected);
    expect(applyStageTidyAction(dancers, ids, "center-x")).toEqual(expected);
    const next = expected;
    expect(next[0]!.yPct).toBe(30);
    expect(next[1]!.yPct).toBe(80);
    expect(next[2]!.yPct).toBe(50);
    expect(next[0]!.xPct).toBe(next[1]!.xPct);
    expect(next[1]!.xPct).toBe(next[2]!.xPct);
  });

  it("等間隔（横）: X via distribute, Y unchanged", () => {
    const four = [
      spot("l", 10, 40),
      spot("m1", 18, 70),
      spot("m2", 80, 20),
      spot("r", 90, 55),
      spot("other", 5, 5),
    ];
    const ids4 = ["l", "m1", "m2", "r"];
    const expected = distributeSelectedDancers(four, ids4, "x");
    expect(applyStageTidyAction(four, ids4, "distribute-x")).toEqual(expected);
    expect(expected[1]!.yPct).toBe(70);
    expect(expected[2]!.yPct).toBe(20);
    expect(expected[4]).toEqual(four[4]);
  });

  it("等間隔（縦）: Y via distribute, X unchanged", () => {
    const three = [
      spot("t", 20, 10),
      spot("m", 80, 22),
      spot("b", 40, 70),
      spot("other", 5, 5),
    ];
    const ids3 = ["t", "m", "b"];
    const expected = distributeSelectedDancers(three, ids3, "y");
    expect(applyStageTidyAction(three, ids3, "distribute-y")).toEqual(expected);
    expect(expected[1]!.xPct).toBe(80);
    expect(expected[3]).toEqual(three[3]);
  });

  it("is a no-op for a single dancer (DANCER has no 整える)", () => {
    const one = [spot("a", 20, 30), spot("b", 80, 70)];
    expect(applyStageTidyAction(one, ["a"], "align-row")).toEqual(one);
    expect(applyStageTidyAction(one, ["a"], "distribute-x")).toEqual(one);
  });

  it("GROUP: only the selected subset moves; others stay put", () => {
    const eleven = Array.from({ length: 11 }, (_, i) =>
      spot(`d${i}`, 10 + i * 7, 20 + (i % 4) * 12, {
        colorIndex: i,
        label: `L${i}`,
      })
    );
    const ids = ["d0", "d2", "d4", "d6", "d8"];
    const next = applyStageTidyAction(eleven, ids, "align-row");
    expect(next.map((d) => d.id)).toEqual(eleven.map((d) => d.id));
    for (let i = 0; i < 11; i++) {
      if (ids.includes(`d${i}`)) continue;
      expect(next[i]).toEqual(eleven[i]);
    }
    const ys = ids.map((id) => next.find((d) => d.id === id)!.yPct);
    expect(new Set(ys).size).toBe(1);
    for (const id of ids) {
      const before = eleven.find((d) => d.id === id)!;
      const after = next.find((d) => d.id === id)!;
      expect(after.xPct).toBe(before.xPct);
      expect(identityFields(after)).toEqual(identityFields(before));
    }
  });
});

describe("draftTidyPreview", () => {
  it("does not change persist dancers and only returns moved ids", () => {
    const dancers = [
      spot("a", 20, 30),
      spot("b", 55, 80),
      spot("c", 40, 50),
      spot("other", 90, 10),
    ];
    const ids = ["a", "b", "c"];
    const draft = draftTidyPreview(dancers, ids, "align-row");
    expect(draft).not.toBeNull();
    expect(draft!.label).toBe(tidyActionLabel("align-row"));
    expect(dancers[0]!.yPct).toBe(30);
    expect(draft!.positions.has("other")).toBe(false);
    expect(draft!.positions.size).toBeGreaterThan(0);

    const applied = applyShapePositionsToDancers(dancers, draft!.positions);
    expect(applied.map((d) => d.id)).toEqual(dancers.map((d) => d.id));
    expect(applied[3]).toEqual(dancers[3]);
    expect(applied[0]!.yPct).toBe(applied[1]!.yPct);
    expect(applied[0]!.xPct).toBe(20);
  });

  it("returns null when the selection is already tidy", () => {
    const dancers = [
      spot("a", 20, 50),
      spot("b", 40, 50),
      spot("c", 70, 50),
    ];
    expect(draftTidyPreview(dancers, ["a", "b", "c"], "align-row")).toBeNull();
  });

  it("shows the draft position through getEffectiveDancerPosition", () => {
    const dancers = [spot("a", 20, 30), spot("b", 55, 80)];
    const draft = draftTidyPreview(dancers, ["a", "b"], "align-row");
    expect(draft).not.toBeNull();
    const a = getEffectiveDancerPosition(dancers[0]!, {
      tidyPreviewById: draft!.positions,
    });
    const b = getEffectiveDancerPosition(dancers[1]!, {
      tidyPreviewById: draft!.positions,
    });
    expect(a.yPct).toBe(b.yPct);
    expect(a.xPct).toBe(20);
    expect(b.xPct).toBe(55);
  });
});
