import { describe, expect, it } from "vitest";
import {
  countPathCrossings,
  repairPathCrossings,
  segmentsCross,
} from "./dancerPathGuard";

describe("dancerPathGuard", () => {
  it("detects crossing segments", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 2, y: 2 };
    const p3 = { x: 0, y: 2 };
    const p4 = { x: 2, y: 0 };
    expect(segmentsCross(p1, p2, p3, p4)).toBe(true);
  });

  it("does not flag parallel non-crossing segments", () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
        { x: 2, y: 1 }
      )
    ).toBe(false);
  });

  it("repairs crossed movement paths by swapping assignments", () => {
    const current = [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
    ];
    const targets = [
      { x: 2, y: 2 },
      { x: 2, y: 0 },
    ];
    const initialAssign = [0, 1];
    expect(countPathCrossings(current, targets, initialAssign)).toBe(1);

    const repaired = repairPathCrossings(current, targets, initialAssign);
    expect(repaired).toEqual([1, 0]);
    expect(countPathCrossings(current, targets, repaired)).toBe(0);
  });

  it("leaves non-crossing parallel paths unchanged", () => {
    const current = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ];
    const targets = [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ];
    expect(repairPathCrossings(current, targets, [0, 1])).toEqual([0, 1]);
  });
});
