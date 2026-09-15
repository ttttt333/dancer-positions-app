import { describe, expect, it } from "vitest";
import type { Crew } from "../types/choreography";
import { createEmptyProject } from "./projectDefaults";
import { appendCrewAndPlaceOnStage } from "./rosterPlaceOnStage";

describe("appendCrewAndPlaceOnStage", () => {
  it("adds crew members onto the active formation and ensures a cue", () => {
    const crew: Crew = {
      id: "c1",
      name: "Class",
      members: [
        { id: "m1", label: "A", colorIndex: 0 },
        { id: "m2", label: "B", colorIndex: 1 },
        { id: "m3", label: "C", colorIndex: 2 },
      ],
    };
    const next = appendCrewAndPlaceOnStage(createEmptyProject(), crew, "rows_3");
    expect(next.crews).toHaveLength(1);
    expect(next.cues.length).toBeGreaterThanOrEqual(1);
    const f = next.formations.find((x) => x.id === next.activeFormationId);
    expect(f?.dancers).toHaveLength(3);
    expect(f?.dancers.map((d) => d.crewMemberId).sort()).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
    expect(f?.dancers.every((d) => Number.isFinite(d.xPct) && Number.isFinite(d.yPct))).toBe(
      true
    );
  });

  it("does not duplicate members already on stage", () => {
    const base = createEmptyProject();
    base.formations[0]!.dancers = [
      {
        id: "d1",
        label: "A",
        markerBadge: "",
        xPct: 40,
        yPct: 50,
        colorIndex: 0,
        crewMemberId: "m1",
      },
    ];
    base.crews = [
      {
        id: "c0",
        name: "old",
        members: [{ id: "m1", label: "A", colorIndex: 0 }],
      },
    ];
    const crew: Crew = {
      id: "c1",
      name: "Class",
      members: [
        { id: "m1", label: "A", colorIndex: 0 },
        { id: "m2", label: "B", colorIndex: 1 },
      ],
    };
    const next = appendCrewAndPlaceOnStage(base, crew, "line");
    const f = next.formations[0]!;
    expect(f.dancers).toHaveLength(2);
    expect(f.dancers.filter((d) => d.crewMemberId === "m1")).toHaveLength(1);
  });
});
