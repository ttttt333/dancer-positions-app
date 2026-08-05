import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import {
  analyzeFreePlanExcessFromList,
  FREE_CLOUD_PROJECT_LIMIT,
  FREE_MAX_CUES,
  FREE_MAX_DANCERS,
  maxDancersInProject,
  trimProjectToFreeLimits,
} from "./freePlanCompliance";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";

function dancer(i: number): DancerSpot {
  return {
    id: `d${i}`,
    label: `D${i}`,
    xPct: i,
    yPct: i,
    colorIndex: 0,
  };
}

describe("freePlanCompliance", () => {
  it("keeps newest projects within free project limit", () => {
    const report = analyzeFreePlanExcessFromList([
      {
        id: 1,
        name: "old",
        updated_at: "2020-01-01T00:00:00.000Z",
        cueCount: 0,
        dancerCount: 0,
      },
      {
        id: 2,
        name: "mid",
        updated_at: "2021-01-01T00:00:00.000Z",
        cueCount: 0,
        dancerCount: 0,
      },
      {
        id: 3,
        name: "new",
        updated_at: "2022-01-01T00:00:00.000Z",
        cueCount: 0,
        dancerCount: 0,
      },
      {
        id: 4,
        name: "newest",
        updated_at: "2023-01-01T00:00:00.000Z",
        cueCount: 0,
        dancerCount: 0,
      },
    ]);
    expect(report.projectsToKeep).toHaveLength(FREE_CLOUD_PROJECT_LIMIT);
    expect(report.projectsToDelete.map((p) => p.id)).toEqual([1]);
    expect(report.hasExcess).toBe(true);
  });

  it("trims cues and dancers to free limits", () => {
    const base = createEmptyProject();
    const f = base.formations[0]!;
    const project: ChoreographyProjectJson = {
      ...base,
      formations: [
        {
          ...f,
          dancers: Array.from({ length: FREE_MAX_DANCERS + 3 }, (_, i) =>
            dancer(i)
          ),
        },
      ],
      cues: Array.from({ length: FREE_MAX_CUES + 2 }, (_, i) => ({
        id: `c${i}`,
        formationId: f.id,
        tStartSec: i,
        tEndSec: i + 1,
      })),
    };

    expect(maxDancersInProject(project)).toBe(FREE_MAX_DANCERS + 3);
    const result = trimProjectToFreeLimits(project);
    expect(result.cuesRemoved).toBe(2);
    expect(result.dancersRemoved).toBe(3);
    expect(result.project.cues).toHaveLength(FREE_MAX_CUES);
    expect(result.project.formations[0]?.dancers).toHaveLength(FREE_MAX_DANCERS);
    expect(result.changed).toBe(true);
  });
});
