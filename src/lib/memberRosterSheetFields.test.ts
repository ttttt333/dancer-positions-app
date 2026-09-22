import { describe, expect, it } from "vitest";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import {
  memberRosterHeightSelectOptions,
  memberRosterSelectOptions,
  memberRosterSkillOptions,
  MEMBER_ROSTER_GRADE_OPTIONS,
  enrichDancerSpotsFromCrew,
  patchMemberRosterDancerInProject,
  removeMemberRosterDancerFromFormation,
  resolveMemberRosterFields,
} from "./memberRosterSheetFields";

function spot(partial: Partial<DancerSpot> & { id: string }): DancerSpot {
  return {
    label: partial.label ?? partial.id,
    xPct: 50,
    yPct: 50,
    colorIndex: 0,
    ...partial,
  };
}

describe("memberRosterSelectOptions", () => {
  it("keeps custom current values in the list", () => {
    expect(memberRosterSelectOptions(MEMBER_ROSTER_GRADE_OPTIONS, "特待")).toEqual([
      "特待",
      ...MEMBER_ROSTER_GRADE_OPTIONS,
    ]);
  });
});

describe("memberRosterSkillOptions", () => {
  it("builds 1..N for roster size", () => {
    expect(memberRosterSkillOptions(20)).toEqual(
      Array.from({ length: 20 }, (_, i) => String(i + 1))
    );
    expect(memberRosterSkillOptions(1)).toEqual(["1"]);
    expect(memberRosterSkillOptions(0)).toEqual(["1"]);
  });
});

describe("memberRosterHeightSelectOptions", () => {
  it("includes out-of-range custom heights", () => {
    expect(memberRosterHeightSelectOptions(132)).toContain(132);
  });
});

describe("patchMemberRosterDancerInProject", () => {
  it("updates dancer and linked crew member together", () => {
    const project = {
      activeFormationId: "f1",
      formations: [
        {
          id: "f1",
          name: "A",
          dancers: [spot({ id: "d1", crewMemberId: "m1", label: "あこ" })],
        },
      ],
      crews: [
        {
          id: "c1",
          name: "名簿",
          members: [{ id: "m1", label: "あこ", colorIndex: 0 }],
        },
      ],
      cues: [],
    } as unknown as ChoreographyProjectJson;

    const next = patchMemberRosterDancerInProject(project, "f1", "d1", {
      gradeLabel: "高2",
      heightCm: 162,
      skillRankLabel: "A",
      colorIndex: 3,
    });
    const d = next.formations[0]!.dancers[0]!;
    const m = next.crews[0]!.members[0]!;
    expect(d.gradeLabel).toBe("高2");
    expect(d.heightCm).toBe(162);
    expect(d.skillRankLabel).toBe("A");
    expect(d.colorIndex).toBe(3);
    expect(m.gradeLabel).toBe("高2");
    expect(m.heightCm).toBe(162);
    expect(m.skillRankLabel).toBe("A");
    expect(m.colorIndex).toBe(3);
  });
});

describe("removeMemberRosterDancerFromFormation", () => {
  it("removes only the stage spot", () => {
    const project = {
      formations: [
        {
          id: "f1",
          name: "A",
          dancers: [spot({ id: "d1" }), spot({ id: "d2" })],
          confirmedDancerCount: 2,
        },
      ],
      crews: [],
      cues: [],
    } as unknown as ChoreographyProjectJson;
    const next = removeMemberRosterDancerFromFormation(project, "f1", "d1");
    expect(next.formations[0]!.dancers.map((d) => d.id)).toEqual(["d2"]);
    expect(next.formations[0]!.confirmedDancerCount).toBe(1);
  });

  it("also removes duplicate spots for the same crew member", () => {
    const project = {
      formations: [
        {
          id: "f1",
          name: "A",
          dancers: [
            spot({ id: "d1", crewMemberId: "m1" }),
            spot({ id: "d1b", crewMemberId: "m1" }),
            spot({ id: "d2" }),
          ],
        },
      ],
      crews: [],
      cues: [],
    } as unknown as ChoreographyProjectJson;
    const next = removeMemberRosterDancerFromFormation(project, "f1", "d1");
    expect(next.formations[0]!.dancers.map((d) => d.id)).toEqual(["d2"]);
  });
});

describe("enrichDancerSpotsFromCrew", () => {
  it("fills empty skill from linked roster member", () => {
    const dancers = [spot({ id: "d1", crewMemberId: "m1" })];
    const crews = [
      {
        id: "c1",
        name: "名簿",
        members: [
          { id: "m1", label: "あこ", colorIndex: 0, skillRankLabel: "2" },
        ],
      },
    ];
    expect(enrichDancerSpotsFromCrew(dancers, crews)[0]!.skillRankLabel).toBe(
      "2"
    );
  });
});

describe("resolveMemberRosterFields", () => {
  it("prefers linked crew values", () => {
    const dancer = spot({
      id: "d1",
      crewMemberId: "m1",
      heightCm: 150,
      gradeLabel: "中1",
    });
    const project = {
      crews: [
        {
          id: "c1",
          name: "名簿",
          members: [
            {
              id: "m1",
              label: "あこ",
              colorIndex: 0,
              heightCm: 165,
              gradeLabel: "高1",
              skillRankLabel: "2",
            },
          ],
        },
      ],
      formations: [],
      cues: [],
    } as unknown as ChoreographyProjectJson;
    expect(resolveMemberRosterFields(dancer, project)).toEqual({
      heightCm: 165,
      gradeLabel: "高1",
      skillRankLabel: "2",
    });
  });
});
