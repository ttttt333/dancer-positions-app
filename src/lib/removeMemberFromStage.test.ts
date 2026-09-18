import { describe, expect, it } from "vitest";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import {
  forkFormationForCueIfShared,
  removeMembersFromStage,
  shouldConfirmMemberDeleteScope,
} from "./removeMemberFromStage";

function spot(partial: Partial<DancerSpot> & { id: string }): DancerSpot {
  return {
    label: partial.label ?? partial.id,
    xPct: 50,
    yPct: 50,
    colorIndex: 0,
    ...partial,
  };
}

function baseProject(
  overrides: Partial<ChoreographyProjectJson> = {}
): ChoreographyProjectJson {
  return {
    activeFormationId: "f1",
    formations: [
      {
        id: "f1",
        name: "A",
        dancers: [
          spot({ id: "d1", crewMemberId: "m1", label: "あこ" }),
          spot({ id: "d2", label: "べつ" }),
        ],
      },
      {
        id: "f2",
        name: "B",
        dancers: [
          spot({ id: "d1", crewMemberId: "m1", label: "あこ" }),
          spot({ id: "d3", label: "うめ" }),
        ],
      },
    ],
    crews: [
      {
        id: "c1",
        name: "名簿",
        members: [{ id: "m1", label: "あこ", colorIndex: 0 }],
      },
    ],
    cues: [
      { id: "c1", formationId: "f1", tStartSec: 0, tEndSec: 4, label: "1" },
      { id: "c2", formationId: "f2", tStartSec: 4, tEndSec: 8, label: "2" },
    ],
    ...overrides,
  } as ChoreographyProjectJson;
}

describe("shouldConfirmMemberDeleteScope", () => {
  it("asks only when there are 2+ cues", () => {
    expect(shouldConfirmMemberDeleteScope(baseProject())).toBe(true);
    expect(
      shouldConfirmMemberDeleteScope(
        baseProject({
          cues: [
            {
              id: "c1",
              formationId: "f1",
              tStartSec: 0,
              tEndSec: 4,
              label: "1",
            },
          ],
        })
      )
    ).toBe(false);
  });
});

describe("removeMembersFromStage", () => {
  it("cue scope removes only from the current formation", () => {
    const next = removeMembersFromStage(baseProject(), {
      formationId: "f1",
      cueId: "c1",
      dancerIds: ["d1"],
      scope: "cue",
    });
    expect(next.formations[0]!.dancers.map((d) => d.id)).toEqual(["d2"]);
    expect(next.formations[1]!.dancers.map((d) => d.id)).toEqual(["d1", "d3"]);
    expect(next.crews[0]!.members).toHaveLength(1);
  });

  it("all scope removes from every formation and the roster", () => {
    const next = removeMembersFromStage(baseProject(), {
      formationId: "f1",
      cueId: "c1",
      dancerIds: ["d1"],
      scope: "all",
    });
    expect(next.formations[0]!.dancers.map((d) => d.id)).toEqual(["d2"]);
    expect(next.formations[1]!.dancers.map((d) => d.id)).toEqual(["d3"]);
    expect(next.crews[0]!.members).toHaveLength(0);
  });

  it("forks a shared formation for cue-only deletes", () => {
    const shared = baseProject({
      formations: [
        {
          id: "fShared",
          name: "共有",
          dancers: [
            spot({ id: "d1", crewMemberId: "m1", label: "あこ" }),
            spot({ id: "d2", label: "べつ" }),
          ],
        },
      ],
      cues: [
        {
          id: "c1",
          formationId: "fShared",
          tStartSec: 0,
          tEndSec: 4,
          label: "1",
        },
        {
          id: "c2",
          formationId: "fShared",
          tStartSec: 4,
          tEndSec: 8,
          label: "2",
        },
      ],
      activeFormationId: "fShared",
    });
    const forked = forkFormationForCueIfShared(shared, "c1", "fShared");
    expect(forked.formationId).not.toBe("fShared");
    expect(forked.project.cues.find((c) => c.id === "c1")!.formationId).toBe(
      forked.formationId
    );
    expect(forked.project.cues.find((c) => c.id === "c2")!.formationId).toBe(
      "fShared"
    );

    const next = removeMembersFromStage(shared, {
      formationId: "fShared",
      cueId: "c1",
      dancerIds: ["d1"],
      scope: "cue",
    });
    const c1Fid = next.cues.find((c) => c.id === "c1")!.formationId;
    const c2Fid = next.cues.find((c) => c.id === "c2")!.formationId;
    expect(c1Fid).not.toBe(c2Fid);
    expect(
      next.formations.find((f) => f.id === c1Fid)!.dancers.map((d) => d.id)
    ).toEqual(["d2"]);
    expect(
      next.formations.find((f) => f.id === c2Fid)!.dancers.map((d) => d.id)
    ).toEqual(["d1", "d2"]);
  });
});
