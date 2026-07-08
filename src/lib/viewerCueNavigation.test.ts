import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectDefaults";
import { computeViewerCueNavState } from "./viewerCueNavigation";
import { sortCuesByStart } from "../core/timelineController";

describe("computeViewerCueNavState", () => {
  it("returns empty state when no cues", () => {
    const project = createEmptyProject();
    expect(computeViewerCueNavState(project, null)).toMatchObject({
      cueCount: 0,
      canPrev: false,
      canNext: false,
      displayIndex: 0,
    });
  });

  it("computes prev/next for selected cue", () => {
    const project = createEmptyProject();
    project.cues = sortCuesByStart([
      {
        id: "c1",
        name: "A",
        tStartSec: 0,
        tEndSec: 10,
        formationId: project.formations[0]!.id,
      },
      {
        id: "c2",
        name: "B",
        tStartSec: 10,
        tEndSec: 20,
        formationId: project.formations[0]!.id,
      },
    ]);
    const mid = computeViewerCueNavState(project, "c2");
    expect(mid).toMatchObject({
      cueIndex: 1,
      cueCount: 2,
      displayIndex: 2,
      canPrev: true,
      canNext: false,
    });
  });
});
