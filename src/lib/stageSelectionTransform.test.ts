import { describe, expect, it } from "vitest";
import type { DancerSpot } from "../types/choreography";
import { swapSelectionKamiteShimote } from "./stageColumnSwap";
import {
  alignSelectedDancers,
  distributeSelectedDancers,
  evenSelectionLine,
  flipSelectedDancers,
  straightenSelectionLine,
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

describe("straightenSelectionLine", () => {
  const dancers = [
    spot("a", 10, 20),
    spot("b", 40, 80),
    spot("c", 70, 30),
    spot("other", 5, 5),
  ];
  const ids = ["a", "b", "c"];

  it("puts a horizontal line on the selection's vertical center and keeps x", () => {
    const next = byId(straightenSelectionLine(dancers, ids, "row"));
    expect(next.a!.yPct).toBe(50);
    expect(next.b!.yPct).toBe(50);
    expect(next.c!.yPct).toBe(50);
    expect(next.a!.xPct).toBe(10);
    expect(next.b!.xPct).toBe(40);
    expect(next.c!.xPct).toBe(70);
    expect(next.other).toEqual(dancers[3]);
  });

  it("puts a vertical line on the selection's horizontal center and keeps y", () => {
    const next = byId(straightenSelectionLine(dancers, ids, "col"));
    expect(next.a!.xPct).toBe(40);
    expect(next.b!.xPct).toBe(40);
    expect(next.c!.xPct).toBe(40);
    expect(next.a!.yPct).toBe(20);
    expect(next.b!.yPct).toBe(80);
    expect(next.c!.yPct).toBe(30);
    expect(next.other!.xPct).toBe(5);
  });

  it("leaves a single dancer unchanged", () => {
    expect(straightenSelectionLine(dancers, ["a"], "row")).toBe(dancers);
  });
});

describe("evenSelectionLine", () => {
  it("aligns a row and spaces x between the current ends, keeping left-to-right order", () => {
    const dancers = [
      spot("l", 10, 20),
      spot("m", 16, 80),
      spot("r", 70, 30),
      spot("other", 90, 10),
    ];
    const next = byId(evenSelectionLine(dancers, ["l", "m", "r"], "row"));
    expect(next.l!.xPct).toBe(10);
    expect(next.m!.xPct).toBe(40);
    expect(next.r!.xPct).toBe(70);
    expect(next.l!.yPct).toBe(50);
    expect(next.m!.yPct).toBe(50);
    expect(next.r!.yPct).toBe(50);
    expect(next.other).toEqual(dancers[3]);
  });

  it("aligns a column and spaces y between the current ends, back to front", () => {
    const dancers = [
      spot("back", 10, 10),
      spot("mid", 80, 22),
      spot("front", 40, 70),
    ];
    const next = byId(evenSelectionLine(dancers, ["back", "mid", "front"], "col"));
    expect(next.back!.yPct).toBe(10);
    expect(next.mid!.yPct).toBe(40);
    expect(next.front!.yPct).toBe(70);
    expect(next.back!.xPct).toBe(45);
    expect(next.mid!.xPct).toBe(45);
    expect(next.front!.xPct).toBe(45);
  });

  it("opens a stacked row by the reference step when everyone shares an x", () => {
    const dancers = [
      spot("a", 50, 30),
      spot("b", 50, 40),
      spot("c", 50, 50),
    ];
    const next = byId(evenSelectionLine(dancers, ["a", "b", "c"], "row"));
    expect(next.a!.xPct).toBe(42);
    expect(next.b!.xPct).toBe(50);
    expect(next.c!.xPct).toBe(58);
    expect(next.a!.yPct).toBe(40);
    expect(next.b!.yPct).toBe(40);
    expect(next.c!.yPct).toBe(40);
  });

  it("keeps dancer ids and does not swap who is on the left", () => {
    const dancers = [
      spot("right", 80, 10, { label: "右" }),
      spot("left", 20, 90, { label: "左" }),
    ];
    const next = byId(evenSelectionLine(dancers, ["right", "left"], "row"));
    expect(next.left!.xPct).toBe(20);
    expect(next.right!.xPct).toBe(80);
    expect(next.left!.label).toBe("左");
    expect(next.right!.label).toBe("右");
    expect(next.left!.yPct).toBe(50);
    expect(next.right!.yPct).toBe(50);
  });
});
