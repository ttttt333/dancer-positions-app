import { describe, expect, it } from "vitest";
import { summarizeProjectJson } from "./projectListSummary";

describe("summarizeProjectJson", () => {
  it("uses first cue formation for preview", () => {
    const summary = summarizeProjectJson({
      formations: [
        { id: "f1", name: "A", dancers: [{ id: "d1", xPct: 10, yPct: 20, colorIndex: 0, label: "1" }] },
        { id: "f2", name: "B", dancers: [{ id: "d2", xPct: 50, yPct: 50, colorIndex: 1, label: "2" }] },
      ],
      cues: [
        { id: "c2", tStartSec: 5, tEndSec: 10, formationId: "f2" },
        { id: "c1", tStartSec: 0, tEndSec: 4, formationId: "f1" },
      ],
      activeFormationId: "f2",
    });
    expect(summary.cueCount).toBe(2);
    expect(summary.previewDancers).toHaveLength(1);
    expect(summary.previewDancers[0]?.xPct).toBe(10);
    expect(summary.cuePreviews).toHaveLength(2);
    expect(summary.cuePreviews[0]).toMatchObject({
      cueId: "c1",
      ordinal: 1,
      name: "A",
    });
    expect(summary.cuePreviews[1]?.cueId).toBe("c2");
    expect(summary.cuePreviews[1]?.dancers[0]?.xPct).toBe(50);
  });

  it("includes saved spot layouts from the project file", () => {
    const summary = summarizeProjectJson({
      formations: [
        { id: "f1", name: "A", dancers: [{ xPct: 10, yPct: 20, colorIndex: 0 }] },
      ],
      cues: [],
      savedSpotLayouts: [
        {
          id: "slot-1",
          name: "サビ",
          dancers: [{ xPct: 30, yPct: 40, colorIndex: 2 }],
        },
      ],
    });
    expect(summary.savedSpotPreviews).toEqual([
      {
        slotId: "slot-1",
        name: "サビ",
        dancers: [{ xPct: 30, yPct: 40, colorIndex: 2 }],
      },
    ]);
  });

  it("returns empty summary for invalid json", () => {
    expect(summarizeProjectJson(null)).toEqual({
      dancerCount: 0,
      cueCount: 0,
      previewDancers: [],
      cuePreviews: [],
      savedSpotPreviews: [],
    });
  });
});
