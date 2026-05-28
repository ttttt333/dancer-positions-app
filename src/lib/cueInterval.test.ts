import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { splitSharedCueFormations } from "./cueInterval";

describe("splitSharedCueFormations", () => {
  it("assigns unique formations when multiple cues share one formationId", () => {
    const base = createEmptyProject();
    const sharedFid = base.activeFormationId;
    const cue1 = {
      id: "cue-1",
      tStartSec: 0,
      tEndSec: 5,
      formationId: sharedFid,
    };
    const cue2 = {
      id: "cue-2",
      tStartSec: 5,
      tEndSec: 10,
      formationId: sharedFid,
    };
    const project = {
      ...base,
      formations: [
        {
          ...base.formations[0]!,
          id: sharedFid,
          dancers: [
            {
              id: "d1",
              label: "1",
              xPct: 50,
              yPct: 50,
              colorIndex: 0,
            },
          ],
        },
      ],
      cues: [cue1, cue2],
    };

    const next = splitSharedCueFormations(project);
    expect(next.cues[0]!.formationId).toBe(sharedFid);
    expect(next.cues[1]!.formationId).not.toBe(sharedFid);
    expect(next.cues[0]!.formationId).not.toBe(next.cues[1]!.formationId);
    expect(next.formations.length).toBe(2);
  });

  it("leaves project unchanged when each cue already has its own formation", () => {
    const base = createEmptyProject();
    const f1 = base.activeFormationId;
    const f2 = crypto.randomUUID();
    const project = {
      ...base,
      formations: [
        base.formations[0]!,
        { ...base.formations[0]!, id: f2, name: "F2" },
      ],
      cues: [
        { id: "c1", tStartSec: 0, tEndSec: 3, formationId: f1 },
        { id: "c2", tStartSec: 3, tEndSec: 6, formationId: f2 },
      ],
    };
    expect(splitSharedCueFormations(project)).toBe(project);
  });
});
