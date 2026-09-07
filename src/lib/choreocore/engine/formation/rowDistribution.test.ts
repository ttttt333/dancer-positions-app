import { describe, expect, it } from "vitest";
import {
  ARC_ROW_MAP,
  DIAMOND_ROW_MAP,
  STAGGERED_ROW_MAP,
  PYRAMID_ROW_MAP,
  WEDGE_ROW_MAP,
  W_SHAPE_ROW_MAP,
  countNearOcclusions,
  generateStructuredArc,
  generateStructuredDiamond,
  generateStructuredPyramid,
  generateStructuredStaggered,
  generateStructuredWedge,
  generateStructuredWShape,
  pyramidFallbackRowSplit,
  resolvePyramidRowSplit,
  resolveRowSplit,
} from "./rowDistribution";

describe("rowDistribution golden tables", () => {
  const expectedStagger: Record<number, number[]> = {
    3: [1, 2],
    4: [2, 2],
    5: [2, 3],
    6: [3, 3],
    7: [3, 4],
    8: [4, 4],
    9: [4, 5],
    10: [5, 5],
  };

  const expectedPyramid: Record<number, number[]> = {
    3: [1, 2],
    4: [1, 3],
    5: [1, 2, 2],
    6: [1, 2, 3],
    7: [1, 2, 4],
    8: [1, 2, 5],
    9: [1, 2, 3, 3],
    10: [1, 2, 3, 4],
    15: [1, 2, 3, 4, 5],
    17: [1, 2, 3, 4, 7],
    21: [1, 2, 3, 4, 5, 6],
  };

  it("matches staggered golden row splits for N=3..10", () => {
    for (const n of Object.keys(expectedStagger).map(Number)) {
      expect(resolveRowSplit(STAGGERED_ROW_MAP, n, 2)).toEqual(expectedStagger[n]);
      expect(STAGGERED_ROW_MAP[n]).toEqual(expectedStagger[n]);
    }
  });

  it("matches pyramid golden row splits including large N", () => {
    for (const n of Object.keys(expectedPyramid).map(Number)) {
      expect(resolvePyramidRowSplit(n)).toEqual(expectedPyramid[n]);
      expect(PYRAMID_ROW_MAP[n]).toEqual(expectedPyramid[n]);
    }
  });

  it("row splits sum to N", () => {
    for (let n = 1; n <= 28; n += 1) {
      const s = resolveRowSplit(STAGGERED_ROW_MAP, n, 2);
      const p = resolvePyramidRowSplit(n);
      expect(s.reduce((a, b) => a + b, 0)).toBe(n);
      expect(p.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it("pyramid large-N keeps tip=1 and does not flatten to even slabs", () => {
    for (const n of [13, 17, 18, 19, 22, 24, 27, 29, 31]) {
      const split = resolvePyramidRowSplit(n);
      expect(split[0]).toBe(1);
      expect(split.length).toBeGreaterThanOrEqual(3);
      // 均等3列 [5,6,6] のような板状ではない
      expect(split[0]).toBeLessThan(split[split.length - 1]!);
      // 急減しない（手前→奥）
      for (let i = 1; i < split.length; i += 1) {
        expect(split[i]!).toBeGreaterThanOrEqual(split[i - 1]! - 0);
      }
    }
  });

  it("pyramidFallbackRowSplit keeps triangle base and puts extras on the back", () => {
    expect(pyramidFallbackRowSplit(10)).toEqual([1, 2, 3, 4]);
    expect(pyramidFallbackRowSplit(17)).toEqual([1, 2, 3, 4, 7]);
    expect(pyramidFallbackRowSplit(17)).not.toEqual([5, 6, 6]);
    expect(pyramidFallbackRowSplit(17)).not.toEqual([1, 4, 5]);
  });
});

describe("generateStructuredStaggered / Pyramid occlusion", () => {
  it("staggered layouts have zero near-occlusions for N=3..10", () => {
    for (let n = 3; n <= 10; n += 1) {
      const pts = generateStructuredStaggered(n);
      expect(pts).toHaveLength(n);
      expect(countNearOcclusions(pts, 5)).toBe(0);
    }
  });

  it("pyramid layouts keep unique in-row X and allow only apex centerline stack", () => {
    for (let n = 3; n <= 10; n += 1) {
      const pts = generateStructuredPyramid(n);
      expect(pts).toHaveLength(n);

      const byY = new Map<number, number[]>();
      for (const p of pts) {
        const xs = byY.get(p.yPct) ?? [];
        xs.push(p.xPct);
        byY.set(p.yPct, xs);
      }
      for (const xs of byY.values()) {
        expect(new Set(xs).size).toBe(xs.length);
      }

      // 隣接する前後列だけ見る（三角形の斜辺上で祖父列と近づくのは許容）
      const ys = [...new Set(pts.map((p) => p.yPct))].sort((a, b) => b - a);
      let bad = 0;
      for (let ri = 0; ri < ys.length - 1; ri += 1) {
        const frontRow = pts.filter((p) => p.yPct === ys[ri]!);
        const backRow = pts.filter((p) => p.yPct === ys[ri + 1]!);
        for (const front of frontRow) {
          for (const back of backRow) {
            if (Math.abs(front.xPct - back.xPct) >= 3.5) continue;
            const onCenterline =
              Math.abs(front.xPct - 50) < 1 && Math.abs(back.xPct - 50) < 1;
            if (!onCenterline) bad += 1;
          }
        }
      }
      expect(bad).toBe(0);
    }
  });

  it("pyramid layouts for N=10 and N=17 stay in a centered triangle", () => {
    for (const [n, expected] of [
      [10, [1, 2, 3, 4]],
      [17, [1, 2, 3, 4, 7]],
    ] as const) {
      const pts = generateStructuredPyramid(n);
      expect(pts).toHaveLength(n);
      const ys = [...new Set(pts.map((p) => p.yPct))].sort((a, b) => b - a);
      expect(ys.length).toBe(expected.length);
      const counts = ys.map(
        (y) => pts.filter((p) => p.yPct === y).length
      );
      expect(counts).toEqual([...expected]);

      const tip = pts.filter((p) => p.yPct === ys[0]!);
      expect(tip).toHaveLength(1);
      expect(tip[0]!.xPct).toBeCloseTo(50, 0);

      // 各行は左右対称（中心 50）
      for (const y of ys) {
        const xs = pts
          .filter((p) => p.yPct === y)
          .map((p) => p.xPct)
          .sort((a, b) => a - b);
        const mid = (xs[0]! + xs[xs.length - 1]!) / 2;
        expect(mid).toBeCloseTo(50, 0);
      }

      // 奥へ向かって横幅が非減少（三角形）
      let prevSpan = -1;
      for (const y of ys) {
        const xs = pts
          .filter((p) => p.yPct === y)
          .map((p) => p.xPct);
        const span =
          xs.length <= 1 ? 0 : Math.max(...xs) - Math.min(...xs);
        expect(span).toBeGreaterThanOrEqual(prevSpan - 0.01);
        prevSpan = span;
      }
    }
  });

  it("front row (higher y) comes first in row order semantics", () => {
    const pts = generateStructuredStaggered(5); // [2,3] front→back
    const ys = [...new Set(pts.map((p) => p.yPct))].sort((a, b) => b - a);
    expect(ys.length).toBe(2);
    const frontY = ys[0]!;
    const backY = ys[1]!;
    const frontCount = pts.filter((p) => p.yPct === frontY).length;
    const backCount = pts.filter((p) => p.yPct === backY).length;
    expect(frontCount).toBe(2);
    expect(backCount).toBe(3);
  });

  it("5-person stagger places front in back gaps (classic 2-3)", () => {
    const pts = generateStructuredStaggered(5);
    const byY = new Map<number, number[]>();
    for (const p of pts) {
      const xs = byY.get(p.yPct) ?? [];
      xs.push(p.xPct);
      byY.set(p.yPct, xs);
    }
    const ys = [...byY.keys()].sort((a, b) => b - a);
    const frontXs = (byY.get(ys[0]!) ?? []).sort((a, b) => a - b);
    const backXs = (byY.get(ys[1]!) ?? []).sort((a, b) => a - b);
    expect(frontXs).toHaveLength(2);
    expect(backXs).toHaveLength(3);
    // Front should sit roughly in the two gaps of the back row
    const gap0 = (backXs[0]! + backXs[1]!) / 2;
    const gap1 = (backXs[1]! + backXs[2]!) / 2;
    expect(Math.abs(frontXs[0]! - gap0)).toBeLessThan(0.5);
    expect(Math.abs(frontXs[1]! - gap1)).toBeLessThan(0.5);
  });
});

describe("W / wedge / diamond / arc expansions", () => {
  it("W uses pyramid-family splits (5→[1,2,2], 7→[1,2,4])", () => {
    expect(W_SHAPE_ROW_MAP[5]).toEqual([1, 2, 2]);
    expect(W_SHAPE_ROW_MAP[7]).toEqual([1, 2, 4]);
    expect(generateStructuredWShape(5)).toHaveLength(5);
    expect(generateStructuredWShape(7)).toHaveLength(7);
  });

  it("wedge is reverse of pyramid (front-wide umbrella)", () => {
    expect(WEDGE_ROW_MAP[5]).toEqual([2, 2, 1]);
    expect(WEDGE_ROW_MAP[7]).toEqual([4, 2, 1]);
    const pts = generateStructuredWedge(5);
    expect(pts).toHaveLength(5);
    const ys = [...new Set(pts.map((p) => p.yPct))].sort((a, b) => b - a);
    const counts = ys.map((y) => pts.filter((p) => p.yPct === y).length);
    expect(counts[0]).toBe(2); // front
    expect(counts[counts.length - 1]).toBe(1); // back tip
  });

  it("diamond maps match symmetric layers", () => {
    expect(DIAMOND_ROW_MAP[4]).toEqual([1, 2, 1]);
    expect(DIAMOND_ROW_MAP[5]).toEqual([1, 3, 1]);
    expect(DIAMOND_ROW_MAP[9]).toEqual([1, 2, 3, 2, 1]);
    for (let n = 3; n <= 10; n += 1) {
      const pts = generateStructuredDiamond(n);
      expect(pts).toHaveLength(n);
      const split = resolveRowSplit(DIAMOND_ROW_MAP, n, 5);
      expect(split.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it("arc dual-ring places inner in angular gaps for 2-3 style", () => {
    const pts = generateStructuredArc(5);
    expect(pts).toHaveLength(5);
    // outer 2 + inner 3 (stagger map)
    const byR = new Map<string, number>();
    for (const p of pts) {
      const dx = p.xPct - 50;
      const dy = p.yPct - 52;
      const r = Math.hypot(dx, dy).toFixed(0);
      byR.set(r, (byR.get(r) ?? 0) + 1);
    }
    expect([...byR.values()].reduce((a, b) => a + b, 0)).toBe(5);
    expect(byR.size).toBeGreaterThanOrEqual(2);
  });

  it("W / wedge / diamond / arc maps sum to N for 1..16", () => {
    for (let n = 1; n <= 16; n += 1) {
      for (const [map, rows] of [
        [W_SHAPE_ROW_MAP, 3],
        [WEDGE_ROW_MAP, 3],
        [DIAMOND_ROW_MAP, 5],
        [ARC_ROW_MAP, 2],
      ] as const) {
        const split = resolveRowSplit(map, n, rows);
        expect(split.reduce((a, b) => a + b, 0)).toBe(n);
      }
    }
  });
});
