import { describe, expect, it } from "vitest";
import {
  clusterSelectionColumns,
  countSelectionColumns,
  detectSelectionColumnGroups,
  swapSelectionColumnsDepth,
} from "./stageColumnSwap";
import type { DancerSpot } from "../types/choreography";

function spot(id: string, xPct: number, yPct: number): DancerSpot {
  return { id, name: id, xPct, yPct, colorIndex: 0 };
}

describe("detectSelectionColumnGroups", () => {
  it("detects three uniform columns", () => {
    const dancers = [
      spot("a1", 20, 10),
      spot("b1", 50, 10),
      spot("c1", 80, 10),
      spot("a2", 20, 40),
      spot("b2", 50, 40),
      spot("c2", 80, 40),
    ];
    const cols = detectSelectionColumnGroups(dancers);
    expect(cols).toHaveLength(3);
    expect(cols.flat()).toHaveLength(6);
  });

  it("detects two columns when front row is wider in X spread", () => {
    const dancers = [
      spot("backL", 40, 15),
      spot("backR", 60, 15),
      spot("f1", 25, 80),
      spot("f2", 35, 82),
      spot("f3", 65, 80),
      spot("f4", 75, 82),
    ];
    expect(countSelectionColumns(dancers, dancers.map((d) => d.id))).toBe(2);
    const cols = detectSelectionColumnGroups(dancers);
    expect(cols).toHaveLength(2);
    expect(cols[0]!.length + cols[1]!.length).toBe(6);
  });
});

describe("swapSelectionColumnsDepth", () => {
  it("swaps Y for all members in two choreographic columns", () => {
    const dancers: DancerSpot[] = [
      spot("a", 30, 10),
      spot("b", 30, 30),
      spot("c", 30, 50),
      spot("d", 70, 12),
      spot("e", 70, 32),
      spot("f", 70, 52),
    ];
    const ids = dancers.map((d) => d.id);

    const next = swapSelectionColumnsDepth(dancers, ids, 0, 1);
    const byId = new Map(next.map((d) => [d.id, d]));

    expect(byId.get("a")!.yPct).toBeCloseTo(12, 5);
    expect(byId.get("b")!.yPct).toBeCloseTo(32, 5);
    expect(byId.get("c")!.yPct).toBeCloseTo(52, 5);
    expect(byId.get("d")!.yPct).toBeCloseTo(10, 5);
    expect(byId.get("e")!.yPct).toBeCloseTo(30, 5);
    expect(byId.get("f")!.yPct).toBeCloseTo(50, 5);

    for (const d of next) {
      expect(d.xPct).toBe(dancers.find((x) => x.id === d.id)!.xPct);
    }
  });

  it("swaps only the targeted columns in a three-column formation", () => {
    const dancers = [
      spot("a1", 20, 10),
      spot("b1", 50, 12),
      spot("c1", 80, 10),
      spot("a2", 20, 40),
      spot("b2", 50, 43),
      spot("c2", 80, 40),
    ];
    const ids = dancers.map((d) => d.id);
    const next = swapSelectionColumnsDepth(dancers, ids, 0, 1);
    const byId = new Map(next.map((d) => [d.id, d]));

    expect(byId.get("a1")!.yPct).toBeCloseTo(12, 5);
    expect(byId.get("b1")!.yPct).toBeCloseTo(10, 5);
    expect(byId.get("a2")!.yPct).toBeCloseTo(43, 5);
    expect(byId.get("b2")!.yPct).toBeCloseTo(40, 5);
    expect(byId.get("c1")!.yPct).toBe(10);
    expect(byId.get("c2")!.yPct).toBe(40);
  });

  it("moves every selected member when swapping columns 1 and 2", () => {
    const dancers = [
      spot("backL", 40, 15),
      spot("backR", 60, 15),
      spot("f1", 25, 80),
      spot("f2", 35, 82),
      spot("f3", 65, 80),
      spot("f4", 75, 82),
    ];
    const ids = dancers.map((d) => d.id);
    const next = swapSelectionColumnsDepth(dancers, ids, 0, 1);
    const changed = next.filter((d) => {
      const prev = dancers.find((x) => x.id === d.id)!;
      return Math.abs(prev.yPct - d.yPct) > 0.01;
    });
    expect(changed).toHaveLength(6);
  });

  it("swaps Y for unequal column sizes", () => {
    const dancers = [
      spot("l1", 20, 10),
      spot("l2", 22, 30),
      spot("l3", 21, 50),
      spot("r1", 80, 20),
      spot("r2", 78, 40),
    ];
    const ids = dancers.map((d) => d.id);
    const next = swapSelectionColumnsDepth(dancers, ids, 0, 1);
    const changed = next.filter((d) => {
      const prev = dancers.find((x) => x.id === d.id)!;
      return Math.abs(prev.yPct - d.yPct) > 0.01;
    });
    expect(changed).toHaveLength(5);
  });

  it("exposes cluster metadata for UI", () => {
    const dancers = [
      spot("a", 30, 10),
      spot("b", 70, 10),
    ];
    const cols = clusterSelectionColumns(dancers, dancers.map((d) => d.id));
    expect(cols).toHaveLength(2);
    expect(cols[0]!.members).toHaveLength(1);
    expect(cols[1]!.members).toHaveLength(1);
  });
});
