import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import {
  getViewRosterEntries,
  resolveStageViewerDisplayLabel,
} from "./viewRoster";
import type { DancerSpot } from "../types/choreography";

function dancer(partial: Partial<DancerSpot> & Pick<DancerSpot, "id">): DancerSpot {
  return {
    label: "1",
    xPct: 50,
    yPct: 50,
    colorIndex: 0,
    ...partial,
  };
}

describe("resolveStageViewerDisplayLabel", () => {
  it("prefers name below circle over inner number", () => {
    const d = dancer({
      id: "d1",
      label: "たけし",
      markerBadge: "3",
    });
    expect(
      resolveStageViewerDisplayLabel(d, 0, { dancerLabelBelow: true })
    ).toBe("たけし");
  });

  it("uses below numeric label when no person name", () => {
    const d = dancer({ id: "d1", label: "5", markerBadge: "5" });
    expect(
      resolveStageViewerDisplayLabel(d, 0, { dancerLabelBelow: true })
    ).toBe("5");
  });

  it("falls back to inner badge when below label is empty", () => {
    const d = dancer({ id: "d1", label: "", markerBadge: "7" });
    expect(
      resolveStageViewerDisplayLabel(d, 0, { dancerLabelBelow: true })
    ).toBe("7");
  });

  it("falls back to formation index when no below or badge", () => {
    const d = dancer({ id: "d1", label: "", markerBadge: undefined });
    expect(
      resolveStageViewerDisplayLabel(d, 2, { dancerLabelBelow: true })
    ).toBe("3");
  });
});

describe("getViewRosterEntries", () => {
  it("does not duplicate crew name and inner number for linked dancer", () => {
    const project = createEmptyProject();
    project.dancerLabelPosition = "below";
    project.crews = [
      {
        id: "c1",
        label: "A",
        members: [{ id: "m1", label: "たけし" }],
      },
    ];
    project.formations[0]!.dancers = [
      dancer({
        id: "d1",
        label: "たけし",
        markerBadge: "1",
        crewMemberId: "m1",
      }),
    ];

    const entries = getViewRosterEntries(project);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "m1", label: "たけし" });
  });

  it("uses stage display for linked dancer instead of separate crew name", () => {
    const project = createEmptyProject();
    project.dancerLabelPosition = "below";
    project.formations[0]!.dancers = [
      dancer({ id: "d1", label: "1", markerBadge: "1", crewMemberId: "m1" }),
      dancer({ id: "d2", label: "よしの", markerBadge: "2", crewMemberId: "m2" }),
    ];

    project.crews = [
      {
        id: "c1",
        label: "A",
        members: [
          { id: "m1", label: "たけし" },
          { id: "m2", label: "よしの" },
        ],
      },
    ];

    const entries = getViewRosterEntries(project);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.label).sort()).toEqual(["1", "よしの"]);
  });

  it("uses inner number when only marker badge is visible on stage", () => {
    const project = createEmptyProject();
    project.dancerLabelPosition = "below";
    project.formations[0]!.dancers = [
      dancer({ id: "d1", label: "", markerBadge: "4" }),
    ];

    const entries = getViewRosterEntries(project);
    expect(entries).toEqual([
      expect.objectContaining({ label: "4", source: "dancer" }),
    ]);
  });
});
