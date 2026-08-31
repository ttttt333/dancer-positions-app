import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import {
  applyShapePreviewDraft,
  classifyShapeMovementCost,
  draftShapePreview,
  resolveShapePreviewEsc,
  shapePreviewLabel,
  type ShapePreviewDraft,
} from "./stageShapePreviewSession";
import { generateShapePreview } from "./stageShapeGenerator";

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

function fiveScattered(): DancerSpot[] {
  return [
    spot("a", 12, 22, { colorIndex: 1, label: "A" }),
    spot("b", 80, 28, { colorIndex: 2, label: "B" }),
    spot("c", 40, 70, { colorIndex: 3, label: "C" }),
    spot("d", 18, 55, { colorIndex: 4, label: "D" }),
    spot("e", 72, 80, { colorIndex: 5, label: "E" }),
    spot("other", 90, 10, { colorIndex: 9, label: "keep" }),
  ];
}

const ids5 = ["a", "b", "c", "d", "e"];

describe("resolveShapePreviewEsc", () => {
  it("Shape Card中Esc: closes picker, does not cancel draft", () => {
    expect(
      resolveShapePreviewEsc({ pickerOpen: true, draftActive: true })
    ).toBe("close-picker");
    expect(
      resolveShapePreviewEsc({ pickerOpen: true, draftActive: false })
    ).toBe("close-picker");
  });

  it("Preview中Esc: cancels draft when picker is closed", () => {
    expect(
      resolveShapePreviewEsc({ pickerOpen: false, draftActive: true })
    ).toBe("cancel-draft");
  });
});

describe("shape preview session (no Project mutation until Apply)", () => {
  it("Preview中Shape変更: V → Circle replaces draft only", () => {
    const dancers = fiveScattered();
    const before = dancers.map((d) => ({ ...d }));
    const vee = draftShapePreview({
      dancers,
      selectedIds: ids5,
      presetId: "vee",
    });
    const circle = draftShapePreview({
      dancers,
      selectedIds: ids5,
      presetId: "circle",
    });
    expect(vee?.draft.presetId).toBe("vee");
    expect(circle?.draft.presetId).toBe("circle");
    expect(dancers).toEqual(before);
    expect(vee!.draft.positions).not.toEqual(circle!.draft.positions);
  });

  it("V → Circle → Triangle → Apply: only the last shape hits Project once", () => {
    const dancers = fiveScattered();
    const origin = dancers.map((d) => ({ ...d }));
    let projectMutations = 0;
    let project = dancers;
    let draft: ShapePreviewDraft | null = null;

    for (const presetId of ["vee", "circle", "triangle"] as const) {
      const next = draftShapePreview({
        dancers: origin,
        selectedIds: ids5,
        presetId,
      });
      draft = next!.draft;
      expect(project).toEqual(origin);
    }

    const expected = generateShapePreview({
      dancers: origin,
      selectedIds: ids5,
      presetId: "triangle",
    });
    expect(draft!.presetId).toBe("triangle");
    expect(draft!.movementCostPct).toBe(expected.movementCostPct);

    project = applyShapePreviewDraft(project, draft);
    projectMutations += 1;

    expect(projectMutations).toBe(1);
    expect(project.map((d) => d.id)).toEqual(origin.map((d) => d.id));
    expect(project[5]).toEqual(origin[5]);
    for (let i = 0; i < 5; i++) {
      expect(identityFields(project[i]!)).toEqual(identityFields(origin[i]!));
      const pos = expected.positions.get(origin[i]!.id)!;
      expect(project[i]!.xPct).toBe(pos.xPct);
      expect(project[i]!.yPct).toBe(pos.yPct);
    }
  });

  it("V → Circle → Cancel: Project unchanged", () => {
    const dancers = fiveScattered();
    const origin = dancers.map((d) => ({ ...d }));
    draftShapePreview({
      dancers,
      selectedIds: ids5,
      presetId: "vee",
    });
    draftShapePreview({
      dancers,
      selectedIds: ids5,
      presetId: "circle",
    });
    const cancelled: ShapePreviewDraft | null = null;
    expect(applyShapePreviewDraft(dancers, cancelled)).toEqual(origin);
    expect(dancers).toEqual(origin);
  });

  it("movementCost matches the current Shape", () => {
    const dancers = fiveScattered();
    const vee = draftShapePreview({
      dancers,
      selectedIds: ids5,
      presetId: "vee",
    })!.draft;
    const circle = draftShapePreview({
      dancers,
      selectedIds: ids5,
      presetId: "circle",
    })!.draft;
    expect(vee.movementCostPct).toBe(
      generateShapePreview({
        dancers,
        selectedIds: ids5,
        presetId: "vee",
      }).movementCostPct
    );
    expect(circle.movementCostPct).toBe(
      generateShapePreview({
        dancers,
        selectedIds: ids5,
        presetId: "circle",
      }).movementCostPct
    );
    expect(vee.movementCostPct).not.toBe(circle.movementCostPct);
    expect(classifyShapeMovementCost(vee.movementCostPct, 5)).toMatch(
      /小|中|大/
    );
  });

  it("identity and selection stay put across switch / apply", () => {
    const dancers = fiveScattered();
    const selected = [...ids5];
    const circle = draftShapePreview({
      dancers,
      selectedIds: selected,
      presetId: "circle",
    })!.draft;
    const next = applyShapePreviewDraft(dancers, circle);
    expect(selected).toEqual(ids5);
    expect(next.map((d) => d.id)).toEqual(dancers.map((d) => d.id));
    for (let i = 0; i < 5; i++) {
      expect(identityFields(next[i]!)).toEqual(identityFields(dancers[i]!));
    }
    expect(identityFields(next[5]!)).toEqual(identityFields(dancers[5]!));
  });

  it("labels current shape for the preview chrome", () => {
    expect(shapePreviewLabel("vee")).toBe("V字");
    expect(shapePreviewLabel("circle")).toBe("円形");
    expect(shapePreviewLabel("triangle")).toBe("三角形");
  });
});
