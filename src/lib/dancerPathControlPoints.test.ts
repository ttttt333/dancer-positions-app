import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import {
  buildInitialControlPoints,
  CP_CLEARANCE_PCT,
  placeMovingControlPoint,
} from "./dancerPathControlPoints";

function spot(id: string, x: number, y: number): DancerSpot {
  return { id, label: id, xPct: x, yPct: y, colorIndex: 0 };
}

describe("placeMovingControlPoint", () => {
  it("offsets perpendicular so the CP is not on the segment midpoint", () => {
    const cp = placeMovingControlPoint(10, 50, 90, 50, [
      { x: 10, y: 50 },
      { x: 90, y: 50 },
    ]);
    expect(Math.abs(cp.cpY - 50)).toBeGreaterThanOrEqual(5);
    expect(cp.cpX).toBeGreaterThan(30);
    expect(cp.cpX).toBeLessThan(70);
  });
});

describe("buildInitialControlPoints", () => {
  it("keeps yellow CPs clear of blue/green markers on a crowded kamite→shimote row", () => {
    /** 上手→下手へ横移動する3人（同じ列付近） */
    const prev = [
      spot("a", 15, 40),
      spot("b", 20, 55),
      spot("c", 18, 70),
    ];
    const next = [
      spot("a", 75, 40),
      spot("b", 80, 55),
      spot("c", 78, 70),
    ];
    const paths = buildInitialControlPoints(prev, next);
    const markers = [
      ...prev.map((d) => ({ x: d.xPct, y: d.yPct })),
      ...next.map((d) => ({ x: d.xPct, y: d.yPct })),
    ];
    const cps = Object.values(paths);
    for (const cp of cps) {
      for (const m of markers) {
        expect(Math.hypot(cp.cpX - m.x, cp.cpY - m.y)).toBeGreaterThanOrEqual(
          CP_CLEARANCE_PCT - 0.05
        );
      }
    }
    /** 制御点同士も重ならない */
    for (let i = 0; i < cps.length; i++) {
      for (let j = i + 1; j < cps.length; j++) {
        expect(
          Math.hypot(cps[i]!.cpX - cps[j]!.cpX, cps[i]!.cpY - cps[j]!.cpY)
        ).toBeGreaterThanOrEqual(CP_CLEARANCE_PCT - 0.05);
      }
    }
  });

  it("keeps yellow CPs clear when moving kamite→shimote (right→left)", () => {
    const prev = [
      spot("a", 80, 35),
      spot("b", 85, 50),
      spot("c", 82, 65),
    ];
    const next = [
      spot("a", 20, 35),
      spot("b", 25, 50),
      spot("c", 22, 65),
    ];
    const paths = buildInitialControlPoints(prev, next);
    const markers = [
      ...prev.map((d) => ({ x: d.xPct, y: d.yPct })),
      ...next.map((d) => ({ x: d.xPct, y: d.yPct })),
    ];
    const cps = Object.values(paths);
    for (const cp of cps) {
      for (const m of markers) {
        expect(Math.hypot(cp.cpX - m.x, cp.cpY - m.y)).toBeGreaterThanOrEqual(
          CP_CLEARANCE_PCT - 0.05
        );
      }
    }
    for (let i = 0; i < cps.length; i++) {
      for (let j = i + 1; j < cps.length; j++) {
        expect(
          Math.hypot(cps[i]!.cpX - cps[j]!.cpX, cps[i]!.cpY - cps[j]!.cpY)
        ).toBeGreaterThanOrEqual(CP_CLEARANCE_PCT - 0.05);
      }
    }
  });
});
