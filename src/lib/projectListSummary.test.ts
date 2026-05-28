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
  });

  it("returns empty summary for invalid json", () => {
    expect(summarizeProjectJson(null)).toEqual({
      dancerCount: 0,
      cueCount: 0,
      previewDancers: [],
    });
  });
});
