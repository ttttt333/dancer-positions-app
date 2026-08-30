import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import { swapSelectionKamiteShimote } from "./stageColumnSwap";
import {
  alignSelectedDancers,
  distributeSelectedDancers,
  flipSelectedDancers,
} from "./stageSelectionTransform";

function spot(
  id: string,
  xPct: number,
  yPct: number,
  extra: Partial<DancerSpot> = {}
): DancerSpot {
  return { id, label: id, xPct, yPct, colorIndex: 0, ...extra };
}

function byId(dancers: DancerSpot[]): Record<string, DancerSpot> {
  return Object.fromEntries(dancers.map((d) => [d.id, d]));
}

describe("alignSelectedDancers", () => {
  const dancers = [
    spot("a", 20, 30),
    spot("b", 55, 80),
    spot("c", 40, 50),
    spot("other", 90, 10),
  ];
  const ids = ["a", "b", "c"];

  it("left-aligns x and keeps each y", () => {
    const next = byId(alignSelectedDancers(dancers, ids, "left"));
    expect(next.a!.xPct).toBe(20);
    expect(next.b!.xPct).toBe(20);
    expect(next.c!.xPct).toBe(20);
    expect(next.a!.yPct).toBe(30);
    expect(next.b!.yPct).toBe(80);
    expect(next.c!.yPct).toBe(50);
    expect(next.other!.xPct).toBe(90);
  });

  it("right-aligns to the selection max x", () => {
    const next = byId(alignSelectedDancers(dancers, ids, "right"));
    expect(next.a!.xPct).toBe(55);
    expect(next.b!.xPct).toBe(55);
    expect(next.c!.xPct).toBe(55);
  });

  it("center-aligns x to the selection midpoint", () => {
    const next = byId(alignSelectedDancers(dancers, ids, "centerX"));
    expect(next.a!.xPct).toBe(37.5);
    expect(next.b!.xPct).toBe(37.5);
    expect(next.c!.xPct).toBe(37.5);
  });

  it("top-aligns y and keeps each x", () => {
    const next = byId(alignSelectedDancers(dancers, ids, "top"));
    expect(next.a!.yPct).toBe(30);
    expect(next.b!.yPct).toBe(30);
    expect(next.c!.yPct).toBe(30);
    expect(next.b!.xPct).toBe(55);
  });

  it("bottom-aligns to the selection max y", () => {
    const next = byId(alignSelectedDancers(dancers, ids, "bottom"));
    expect(next.a!.yPct).toBe(80);
    expect(next.b!.yPct).toBe(80);
    expect(next.c!.yPct).toBe(80);
  });
});

describe("distributeSelectedDancers", () => {
  it("keeps the first and last x and spaces the middle", () => {
    const dancers = [
      spot("l", 10, 40),
      spot("m1", 18, 70),
      spot("m2", 80, 20),
      spot("r", 90, 55),
    ];
    const next = byId(distributeSelectedDancers(dancers, ["l", "m1", "m2", "r"], "x"));
    expect(next.l!.xPct).toBe(10);
    expect(next.r!.xPct).toBe(90);
    expect(next.m1!.xPct).toBeCloseTo(10 + (90 - 10) / 3);
    expect(next.m2!.xPct).toBeCloseTo(10 + (2 * (90 - 10)) / 3);
    expect(next.m1!.yPct).toBe(70);
    expect(next.m2!.yPct).toBe(20);
  });

  it("spaces along y while keeping x", () => {
    const dancers = [
      spot("t", 20, 10),
      spot("m", 80, 22),
      spot("b", 40, 70),
    ];
    const next = byId(distributeSelectedDancers(dancers, ["t", "m", "b"], "y"));
    expect(next.t!.yPct).toBe(10);
    expect(next.b!.yPct).toBe(70);
    expect(next.m!.yPct).toBe(40);
    expect(next.m!.xPct).toBe(80);
  });
});

describe("flipSelectedDancers", () => {
  it("mirrors x around the selection center using the existing kamite/shimote swap", () => {
    const dancers = [
      spot("l", 10, 20),
      spot("c", 30, 80),
      spot("r", 50, 40),
    ];
    const ids = ["l", "c", "r"];
    const flipped = flipSelectedDancers(dancers, ids, "x");
    expect(flipped).toEqual(swapSelectionKamiteShimote(dancers, ids));
    const next = byId(flipped);
    expect(next.l!.xPct).toBe(50);
    expect(next.r!.xPct).toBe(10);
    expect(next.c!.xPct).toBe(30);
    expect(next.l!.yPct).toBe(20);
  });

  it("mirrors y around the selection center", () => {
    const dancers = [
      spot("t", 10, 20),
      spot("m", 40, 30),
      spot("b", 80, 80),
    ];
    const next = byId(flipSelectedDancers(dancers, ["t", "m", "b"], "y"));
    expect(next.t!.yPct).toBe(80);
    expect(next.b!.yPct).toBe(20);
    expect(next.m!.yPct).toBe(70);
    expect(next.t!.xPct).toBe(10);
  });
});
