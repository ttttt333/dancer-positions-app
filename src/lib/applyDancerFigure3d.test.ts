import { describe, expect, it } from "vitest";
import {
  applyDancerFigure3d,
  withDancerFigure3d,
} from "./applyDancerFigure3d";
import type { ChoreographyProjectJson } from "../types/choreography";

function spot(
  id: string,
  opts?: { figure3d?: "dog" | "cat"; crewMemberId?: string }
) {
  return {
    id,
    label: id,
    xPct: 50,
    yPct: 50,
    colorIndex: 0,
    ...opts,
  };
}

describe("withDancerFigure3d", () => {
  it("omits field for human", () => {
    const s = withDancerFigure3d(spot("a", { figure3d: "dog" }), "human");
    expect(s.figure3d).toBeUndefined();
  });
});

describe("applyDancerFigure3d", () => {
  const base = {
    formations: [
      { id: "f1", name: "1", dancers: [spot("d1"), spot("d2")] },
      { id: "f2", name: "2", dancers: [spot("d1"), spot("d2")] },
    ],
    activeFormationId: "f1",
    crews: [],
    cues: [],
  } as unknown as ChoreographyProjectJson;

  it("applies to every formation when scope is all", () => {
    const next = applyDancerFigure3d(base, {
      dancerIds: ["d1"],
      formationId: "f1",
      figure3d: "dog",
      scope: "all",
    });
    expect(next.formations[0]!.dancers[0]!.figure3d).toBe("dog");
    expect(next.formations[1]!.dancers[0]!.figure3d).toBe("dog");
    expect(next.formations[0]!.dancers[1]!.figure3d).toBeUndefined();
  });

  it("applies only to one formation when scope is cue", () => {
    const next = applyDancerFigure3d(base, {
      dancerIds: ["d1"],
      formationId: "f1",
      figure3d: "cat",
      scope: "cue",
    });
    expect(next.formations[0]!.dancers[0]!.figure3d).toBe("cat");
    expect(next.formations[1]!.dancers[0]!.figure3d).toBeUndefined();
  });

  it("matches via crewMemberId across cues when scope is all", () => {
    const project = {
      formations: [
        {
          id: "f1",
          name: "1",
          dancers: [spot("a", { crewMemberId: "m1" })],
        },
        {
          id: "f2",
          name: "2",
          dancers: [spot("b", { crewMemberId: "m1" })],
        },
      ],
      activeFormationId: "f1",
      crews: [],
      cues: [],
    } as unknown as ChoreographyProjectJson;

    const next = applyDancerFigure3d(project, {
      dancerIds: ["a"],
      formationId: "f1",
      figure3d: "cat",
      scope: "all",
    });

    expect(next.formations[0]!.dancers[0]!.figure3d).toBe("cat");
    expect(next.formations[1]!.dancers[0]!.figure3d).toBe("cat");
  });
});
