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
    expect(mid[0]!.xPct).toBeGreaterThan(10);
    expect(mid[0]!.xPct).toBeLessThan(50);
  });

  it("switches instantly between abutting cues (no in-between frame)", () => {
    clearDancersAtTimeCache();
    const formations: Formation[] = [
      {
        id: "f1",
        name: "A",
        dancers: [{ id: "d1", label: "1", xPct: 0, yPct: 0, colorIndex: 0 }],
      },
      {
        id: "f2",
        name: "B",
        dancers: [{ id: "d1", label: "1", xPct: 100, yPct: 0, colorIndex: 3 }],
      },
    ];
    const cues: Cue[] = [
      { id: "c1", tStartSec: 0, tEndSec: 10, formationId: "f1" },
      { id: "c2", tStartSec: 10, tEndSec: 20, formationId: "f2" },
    ];
    for (const t of [8, 9.5, 9.99, 9.9999]) {
      const d = dancersAtTime(t, cues, formations, "f1", { bpm: 120 })[0]!;
      expect(d.xPct).toBe(0);
      expect(d.colorIndex).toBe(0);
    }
    const at = dancersAtTime(10, cues, formations, "f1", { bpm: 120 })[0]!;
    expect(at.xPct).toBe(100);
    expect(at.colorIndex).toBe(3);
  });

  it("switches instantly across a tiny gap too", () => {
    clearDancersAtTimeCache();
    const formations: Formation[] = [
      { id: "f1", name: "A", dancers: [{ id: "d1", label: "1", xPct: 0, yPct: 0, colorIndex: 0 }] },
      { id: "f2", name: "B", dancers: [{ id: "d1", label: "1", xPct: 100, yPct: 0, colorIndex: 0 }] },
    ];
    const cues: Cue[] = [
      { id: "c1", tStartSec: 0, tEndSec: 10, formationId: "f1" },
      { id: "c2", tStartSec: 10.1, tEndSec: 20, formationId: "f2" },
    ];
    expect(dancersAtTime(10.05, cues, formations, "f1")[0]!.xPct).toBe(0);
    expect(dancersAtTime(10.1, cues, formations, "f1")[0]!.xPct).toBe(100);
  });

  it("still moves across abutting cues when a personal path is set", () => {
    clearDancersAtTimeCache();
    const formations: Formation[] = [
      {
        id: "f1",
        name: "A",
        dancers: [{ id: "d1", label: "1", xPct: 0, yPct: 0, colorIndex: 0 }],
      },
      {
        id: "f2",
        name: "B",
        dancers: [{ id: "d1", label: "1", xPct: 100, yPct: 0, colorIndex: 0 }],
      },
    ];
    const cues: Cue[] = [
      { id: "c1", tStartSec: 0, tEndSec: 10, formationId: "f1" },
      {
        id: "c2",
        tStartSec: 10,
        tEndSec: 20,
        formationId: "f2",
        dancerCustomPaths: { d1: { cpX: 50, cpY: 20 } },
      },
    ];
    const early = dancersAtTime(1, cues, formations, "f1", { bpm: 120 });
    expect(early[0]!.xPct).toBe(0);
    const moving = dancersAtTime(8, cues, formations, "f1", { bpm: 120 });
    expect(moving[0]!.xPct).toBeGreaterThan(0);
    expect(moving[0]!.xPct).toBeLessThan(100);
    const arrived = dancersAtTime(10, cues, formations, "f1", { bpm: 120 });
    expect(arrived[0]!.xPct).toBe(100);
  });
});
