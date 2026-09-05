import { describe, expect, it } from "vitest";
import {
  DANCER_MIN_DISTANCE,
  clampScaleForMinDistance,
  enforceSymmetryMeters,
  enforceSymmetryPct,
  ensureMinPairDistancePct,
  minPairDistanceMeters,
  scaleSpotsFromCenterSafe,
} from "./formationGeometry";

describe("formationGeometry", () => {
  it("defines DANCER_MIN_DISTANCE as 0.8m", () => {
    expect(DANCER_MIN_DISTANCE).toBe(0.8);
  });

  it("blocks contract scale that would pack closer than 0.8m", () => {
    // 2人・横に 2m（xPct ± 50*2/12 ≈ ±8.33 → 41.67 / 58.33）
    const spots = [
      { xPct: 50 - (1 / 12) * 100, yPct: 50 },
      { xPct: 50 + (1 / 12) * 100, yPct: 50 },
    ];
    const minD = minPairDistanceMeters(spots);
    expect(minD).toBeCloseTo(2, 5);
    // 要求 0.3 → 距離 0.6m になるので、0.8/2=0.4 までしか縮めない
    expect(clampScaleForMinDistance(minD, 0.3)).toBeCloseTo(0.4, 5);
    const scaled = scaleSpotsFromCenterSafe(spots, 0.3);
    expect(minPairDistanceMeters(scaled)).toBeGreaterThanOrEqual(
      DANCER_MIN_DISTANCE - 1e-6
    );
  });

  it("allows expand without clamping", () => {
    expect(clampScaleForMinDistance(2, 1.32)).toBe(1.32);
  });

  it("pushes overlapping dancers apart to at least 0.8m", () => {
    const piled = [
      { id: "a", xPct: 50, yPct: 50 },
      { id: "b", xPct: 51, yPct: 50.5 },
      { id: "c", xPct: 49.5, yPct: 49.5 },
      { id: "d", xPct: 50.2, yPct: 50.1 },
    ];
    expect(minPairDistanceMeters(piled)).toBeLessThan(0.4);
    const spread = ensureMinPairDistancePct(piled, DANCER_MIN_DISTANCE);
    expect(minPairDistanceMeters(spread)).toBeGreaterThanOrEqual(
      DANCER_MIN_DISTANCE - 1e-3
    );
  });

  it("mirrors left from right masters and pins center", () => {
    const spots = [
      { id: "c", xPct: 50.4, yPct: 48 },
      { id: "r1", xPct: 70, yPct: 40 },
      { id: "l1", xPct: 28, yPct: 41 },
      { id: "r2", xPct: 80, yPct: 60 },
      { id: "l2", xPct: 22, yPct: 58 },
    ];
    const out = enforceSymmetryPct(spots);
    const byId = Object.fromEntries(out.map((s) => [s.id, s]));
    expect(byId.c!.xPct).toBe(50);
    expect(byId.l1!.xPct).toBeCloseTo(30, 5);
    expect(byId.l1!.yPct).toBeCloseTo(40, 5);
    expect(byId.l2!.xPct).toBeCloseTo(20, 5);
    expect(byId.l2!.yPct).toBeCloseTo(60, 5);
  });

  it("enforces meter symmetry the same way", () => {
    const pts = [
      { x: 0.05, y: 0 },
      { x: 2, y: 1 },
      { x: -1.7, y: 0.9 },
    ];
    const out = enforceSymmetryMeters(pts);
    expect(out[0]!.x).toBe(0);
    expect(out[2]!.x).toBeCloseTo(-2, 5);
    expect(out[2]!.y).toBeCloseTo(1, 5);
  });
});
