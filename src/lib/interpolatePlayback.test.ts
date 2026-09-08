import { describe, expect, it } from "vitest";
import {
  clearDancersAtTimeCache,
  dancersAtTime,
} from "./interpolatePlayback";
import type { Cue, Formation } from "../types/choreography";

describe("dancersAtTime cache", () => {
  it("returns stable hold positions without re-sorting each call", () => {
    clearDancersAtTimeCache();
    const formations: Formation[] = [
      {
        id: "f1",
        name: "A",
        dancers: [
          { id: "d1", label: "1", xPct: 10, yPct: 20, colorIndex: 0 },
          { id: "d2", label: "2", xPct: 30, yPct: 40, colorIndex: 1 },
        ],
      },
      {
        id: "f2",
        name: "B",
        dancers: [
          { id: "d1", label: "1", xPct: 50, yPct: 60, colorIndex: 0 },
          { id: "d2", label: "2", xPct: 70, yPct: 80, colorIndex: 1 },
        ],
      },
    ];
    const cues: Cue[] = [
      {
        id: "c1",
        label: "1",
        tStartSec: 0,
        tEndSec: 2,
        formationId: "f1",
      },
      {
        id: "c2",
        label: "2",
        tStartSec: 3,
        tEndSec: 5,
        formationId: "f2",
        gapApproachFromPrev: "linear",
      },
    ];

    const a = dancersAtTime(1, cues, formations, "f1");
    const b = dancersAtTime(1, cues, formations, "f1");
    expect(a).toBe(b); // same hold array reference from cache

    const mid = dancersAtTime(2.5, cues, formations, "f1");
    expect(mid[0].xPct).toBeGreaterThan(10);
    expect(mid[0].xPct).toBeLessThan(50);
  });
});
