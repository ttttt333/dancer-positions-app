import { describe, expect, it } from "vitest";
import {
  progressBetween,
  resolveMoveInSec,
  resolveTransitionWindow,
  lerpSpotsLinear,
} from "./interpolation";

describe("progressBetween", () => {
  it("lerps midpoints", () => {
    expect(progressBetween(1, 0, 2)).toBeCloseTo(0.5);
    expect(progressBetween(-1, 0, 2)).toBe(0);
    expect(progressBetween(3, 0, 2)).toBe(1);
  });
});

describe("resolveMoveInSec", () => {
  it("uses 8 counts at 120bpm (=4s) when hold is long", () => {
    expect(resolveMoveInSec({ holdDurationSec: 20, bpm: 120 })).toBeCloseTo(4);
  });

  it("respects moveInSec override and hold cap", () => {
    expect(
      resolveMoveInSec({ holdDurationSec: 2, moveInSec: 10, bpm: 120 })
    ).toBeCloseTo(0.9); // 45% of 2
  });
});

describe("resolveTransitionWindow", () => {
  it("keeps explicit gaps", () => {
    const w = resolveTransitionWindow({
      prevStartSec: 0,
      prevEndSec: 2,
      nextStartSec: 4,
    });
    expect(w.kind).toBe("explicit-gap");
    expect(w.holdEndSec).toBe(2);
    expect(w.arrivalSec).toBe(4);
  });

  it("carves implicit move from abutting cues", () => {
    const w = resolveTransitionWindow({
      prevStartSec: 0,
      prevEndSec: 10,
      nextStartSec: 10,
      bpm: 120,
    });
    expect(w.kind).toBe("implicit-carve");
    expect(w.arrivalSec).toBe(10);
    expect(w.holdEndSec).toBeLessThan(10);
    expect(w.holdEndSec).toBeCloseTo(6); // 10 - 4s
  });
});

describe("lerpSpotsLinear", () => {
  it("matches by dancer id", () => {
    const mid = lerpSpotsLinear(
      [{ id: "a", label: "1", xPct: 0, yPct: 0, colorIndex: 0 }],
      [{ id: "a", label: "1", xPct: 100, yPct: 50, colorIndex: 0 }],
      0.5
    );
    expect(mid[0]!.xPct).toBeCloseTo(50);
    expect(mid[0]!.yPct).toBeCloseTo(25);
  });
});
