import { describe, expect, it } from "vitest";
import {
  clusterSelectionColumns,
  detectSelectionColumnGroups,
  getSelectionSwapAxis,
  swapSelectionColumnSetsDepth,
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

describe("swapSelectionColumnSetsDepth", () => {
  it("swaps non-adjacent depth rows (3rd with 5th)", () => {
    const dancers = [
      spot("r1", 50, 80),
      spot("r2", 50, 65),
      spot("r3", 50, 50),
      spot("r4", 50, 35),
      spot("r5", 50, 20),
    ];
    const ids = dancers.map((d) => d.id);
    expect(getSelectionSwapAxis(dancers, ids)).toBe("depth-rows");
    const next = swapSelectionColumnSetsDepth(dancers, ids, [2], [4]);
    const byId = new Map(next.map((d) => [d.id, d]));
    expect(byId.get("r3")!.yPct).toBeCloseTo(20, 5);
    expect(byId.get("r5")!.yPct).toBeCloseTo(50, 5);
    expect(byId.get("r1")!.yPct).toBe(80);
    expect(byId.get("r2")!.yPct).toBe(65);
    expect(byId.get("r4")!.yPct).toBe(35);
  });

  it("swaps two rank blocks (4・5 with 10・11)", () => {
    const dancers = Array.from({ length: 11 }, (_, i) =>
      spot(`r${i + 1}`, 50, 80 - i * 6)
    );
    const ids = dancers.map((d) => d.id);
    const next = swapSelectionColumnSetsDepth(dancers, ids, [3, 4], [9, 10]);
    const byId = new Map(next.map((d) => [d.id, d]));
    const ysA = [byId.get("r4")!.yPct, byId.get("r5")!.yPct].sort((a, b) => a - b);
    const ysB = [byId.get("r10")!.yPct, byId.get("r11")!.yPct].sort(
      (a, b) => a - b
    );
    const origB = [dancers[9]!.yPct, dancers[10]!.yPct].sort((a, b) => a - b);
    const origA = [dancers[3]!.yPct, dancers[4]!.yPct].sort((a, b) => a - b);
    expect(ysA[0]).toBeCloseTo(origB[0], 5);
    expect(ysA[1]).toBeCloseTo(origB[1], 5);
    expect(ysB[0]).toBeCloseTo(origA[0], 5);
    expect(ysB[1]).toBeCloseTo(origA[1], 5);
    expect(byId.get("r1")!.yPct).toBe(dancers[0]!.yPct);
  });

  it("does not collapse a wide row onto a narrow row's Ys", () => {
    const dancers = dancersForLayoutPreset(75, "pyramid_inverse");
    const ids = dancers.map((d) => d.id);
    const groups = detectSelectionColumnGroups(dancers);
    expect(groups.length).toBeGreaterThanOrEqual(3);
    const front = groups[0]!;
    const back = groups[groups.length - 1]!;
    expect(front.length).toBeGreaterThan(back.length);

    const next = swapSelectionColumnsDepth(
      dancers,
      ids,
      0,
      groups.length - 1
    );
    const byId = new Map(next.map((d) => [d.id, d]));

    for (const d of front) {
      expect(byId.get(d.id)!.xPct).toBe(d.xPct);
    }
    const frontXs = new Set(front.map((d) => d.xPct.toFixed(3)));
    expect(new Set(front.map((d) => byId.get(d.id)!.xPct.toFixed(3)))).toEqual(
      frontXs
    );

    const movedFrontYs = front.map((d) => byId.get(d.id)!.yPct);
    const frontYSpan =
      Math.max(...movedFrontYs) - Math.min(...movedFrontYs);
    const origFrontSpan =
      Math.max(...front.map((d) => d.yPct)) -
      Math.min(...front.map((d) => d.yPct));
    expect(frontYSpan).toBeCloseTo(origFrontSpan, 5);

    const origBackMean =
      back.reduce((s, d) => s + d.yPct, 0) / back.length;
    const origFrontMean =
      front.reduce((s, d) => s + d.yPct, 0) / front.length;
    const newFrontMean =
      movedFrontYs.reduce((s, y) => s + y, 0) / movedFrontYs.length;
    expect(newFrontMean).toBeCloseTo(origBackMean, 5);
    const movedBackMean =
      back.reduce((s, d) => s + byId.get(d.id)!.yPct, 0) / back.length;
    expect(movedBackMean).toBeCloseTo(origFrontMean, 5);
  });

  it("keeps two selected ranks as two rows when swapped with one rank", () => {
    const dancers = dancersForLayoutPreset(75, "pyramid_inverse");
    const ids = dancers.map((d) => d.id);
    const groups = detectSelectionColumnGroups(dancers);
    expect(groups.length).toBeGreaterThanOrEqual(4);
    const block = [groups.length - 2, groups.length - 1];
    const next = swapSelectionColumnSetsDepth(dancers, ids, [0], block);
    const byId = new Map(next.map((d) => [d.id, d]));
    const movedYs = [
      ...new Set(
        block.flatMap((i) =>
          (groups[i] ?? []).map((d) => byId.get(d.id)!.yPct.toFixed(2))
        )
      ),
    ];
    expect(movedYs.length).toBe(2);
    const origSpans = block.map((i) => {
      const g = groups[i]!;
      return Math.max(...g.map((d) => d.yPct)) - Math.min(...g.map((d) => d.yPct));
    });
    const newSpans = block.map((i) => {
      const g = groups[i]!;
      const ys = g.map((d) => byId.get(d.id)!.yPct);
      return Math.max(...ys) - Math.min(...ys);
    });
    expect(newSpans[0]).toBeCloseTo(origSpans[0]!, 5);
    expect(newSpans[1]).toBeCloseTo(origSpans[1]!, 5);
  });
});
