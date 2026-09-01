import { describe, expect, it } from "vitest";
import {
  clusterSelectionColumns,
  detectSelectionColumnGroups,
  getSelectionSwapAxis,
  swapSelectionColumnsDepth,
} from "./stageColumnSwap";
import type { DancerSpot } from "../types/choreography";
import { dancersForLayoutPreset } from "./formationLayouts";

function spot(id: string, xPct: number, yPct: number): DancerSpot {
  return { id, name: id, xPct, yPct, colorIndex: 0 };
}

describe("depth row detection", () => {
  it("detects three front-to-back rows for wedge formations", () => {
    const dancers = [
      spot("backL", 45, 18),
      spot("backR", 55, 18),
      spot("m1", 35, 45),
      spot("m2", 45, 45),
      spot("m3", 55, 45),
      spot("m4", 65, 45),
      spot("f1", 25, 78),
      spot("f2", 35, 80),
      spot("f3", 50, 82),
      spot("f4", 65, 80),
      spot("f5", 75, 78),
    ];

    expect(getSelectionSwapAxis(dancers, dancers.map((d) => d.id))).toBe(
      "depth-rows"
    );
    expect(detectSelectionColumnGroups(dancers)).toHaveLength(3);
  });

  it("swaps all members between two depth rows", () => {
    const dancers = [
      spot("backL", 45, 18),
      spot("backR", 55, 18),
      spot("f1", 25, 78),
      spot("f2", 35, 80),
      spot("f3", 50, 82),
      spot("f4", 65, 80),
      spot("f5", 75, 78),
    ];
    const ids = dancers.map((d) => d.id);
    const next = swapSelectionColumnsDepth(dancers, ids, 0, 1);
    const changed = next.filter((d) => {
      const prev = dancers.find((x) => x.id === d.id)!;
      return Math.abs(prev.yPct - d.yPct) > 0.01;
    });
    expect(changed.length).toBe(dancers.length);
  });

  it("keeps each inverse-pyramid visual row as its own group", () => {
    const dancers = dancersForLayoutPreset(75, "pyramid_inverse");
    const ids = dancers.map((d) => d.id);
    expect(getSelectionSwapAxis(dancers, ids)).toBe("depth-rows");
    const groups = detectSelectionColumnGroups(dancers);
    const uniqueY = new Set(dancers.map((d) => d.yPct.toFixed(3))).size;
    expect(groups).toHaveLength(uniqueY);
    expect(groups.length).toBeGreaterThanOrEqual(8);
    for (const g of groups) {
      const ys = g.map((d) => d.yPct);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1);
    }
  });

  it("keeps each pyramid visual row as its own group", () => {
    const dancers = dancersForLayoutPreset(75, "pyramid");
    const ids = dancers.map((d) => d.id);
    expect(getSelectionSwapAxis(dancers, ids)).toBe("depth-rows");
    const groups = detectSelectionColumnGroups(dancers);
    const uniqueY = new Set(dancers.map((d) => d.yPct.toFixed(3))).size;
    expect(groups).toHaveLength(uniqueY);
    for (const g of groups) {
      const ys = g.map((d) => d.yPct);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1);
    }
  });
});

describe("vertical column detection", () => {
  it("detects three uniform vertical columns", () => {
    const dancers = [
      spot("a1", 20, 10),
      spot("b1", 50, 10),
      spot("c1", 80, 10),
      spot("a2", 20, 40),
      spot("b2", 50, 40),
      spot("c2", 80, 40),
    ];
    expect(getSelectionSwapAxis(dancers, dancers.map((d) => d.id))).toBe(
      "vertical-columns"
    );
    expect(detectSelectionColumnGroups(dancers)).toHaveLength(3);
  });

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
  });

  it("swaps only targeted vertical columns in a three-column formation", () => {
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
    expect(byId.get("c1")!.yPct).toBe(10);
    expect(byId.get("c2")!.yPct).toBe(40);
  });
});

describe("cluster metadata", () => {
  it("exposes cluster metadata for UI", () => {
    const dancers = [spot("a", 30, 10), spot("b", 70, 10)];
    const cols = clusterSelectionColumns(dancers, dancers.map((d) => d.id));
    expect(cols).toHaveLength(2);
  });
});
