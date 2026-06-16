import { describe, expect, it } from "vitest";
import {
  partitionSelectionByX,
  swapSelectionColumnsDepth,
} from "./stageColumnSwap";
import type { DancerSpot } from "../types/choreography";

function spot(
  id: string,
  xPct: number,
  yPct: number
): DancerSpot {
  return { id, name: id, xPct, yPct, colorIndex: 0 };
}

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

  it("assigns every selected member to one of two columns when front row is wider", () => {
    const dancers: DancerSpot[] = [
      spot("backL", 40, 15),
      spot("backR", 60, 15),
      spot("f1", 25, 80),
      spot("f2", 35, 82),
      spot("f3", 65, 80),
      spot("f4", 75, 82),
    ];
    const cols = partitionSelectionByX(dancers, 2);
    expect(cols).toHaveLength(2);
    expect(cols[0]!.length + cols[1]!.length).toBe(6);

    const ids = dancers.map((d) => d.id);
    const next = swapSelectionColumnsDepth(dancers, ids, 0, 1);
    const changed = next.filter((d) => {
      const prev = dancers.find((x) => x.id === d.id)!;
      return Math.abs(prev.yPct - d.yPct) > 0.01;
    });
    expect(changed).toHaveLength(6);
  });

  it("swaps Y for unequal column sizes", () => {
    const dancers: DancerSpot[] = [
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
});
