import { describe, expect, it } from "vitest";
import { dancersForLayoutPreset } from "./formationLayouts";

function clusterCentroids(
  spots: { xPct: number; yPct: number }[],
  centers: [number, number][]
) {
  const assigned: { xPct: number; yPct: number }[][] = centers.map(() => []);
  for (const s of spots) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < centers.length; i += 1) {
      const [cx, cy] = centers[i]!;
      const d = (s.xPct - cx) ** 2 + (s.yPct - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    assigned[best]!.push(s);
  }
  return assigned;
}

describe("3-way dense clusters", () => {
  it("three_clusters balances group sizes and keeps L/R symmetric when possible", () => {
    for (const n of [9, 12, 15, 16, 17]) {
      const spots = dancersForLayoutPreset(n, "three_clusters");
      expect(spots).toHaveLength(n);
      const groups = clusterCentroids(spots, [
        [50, 70],
        [22, 28],
        [78, 28],
      ]);
      const sizes = groups.map((g) => g.length);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      // 左右奥の人数差は最大1
      expect(Math.abs(sizes[1]! - sizes[2]!)).toBeLessThanOrEqual(1);
    }
  });

  it("block_3 places balanced L/C/R compact clusters", () => {
    const spots = dancersForLayoutPreset(14, "block_3");
    const groups = clusterCentroids(spots, [
      [20, 50],
      [50, 50],
      [80, 50],
    ]);
    const sizes = groups.map((g) => g.length);
    expect(sizes).toEqual([5, 4, 5]); // rem=2 → L/R
    for (const g of groups) {
      const xs = g.map((s) => s.xPct);
      const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
      // 各群は自ゾーン付近にまとまる
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(28);
      expect(Number.isFinite(mid)).toBe(true);
    }
  });
});

describe("2-split variations", () => {
  const ids = [
    "split_lr_cluster",
    "split_lr_line",
    "split_lr_two_rows",
    "split_lr_front",
    "split_lr_back",
    "split_lr_corridor",
    "split_fb_cluster",
    "split_fb_line",
    "split_diag_lr",
    "split_diag_rl",
    "split_lr_stagger",
    "split_lr_arc",
    "block_lr",
  ] as const;

  it("all 2-split presets place exact N dancers", () => {
    for (const id of ids) {
      for (const n of [8, 11, 16]) {
        const spots = dancersForLayoutPreset(n, id);
        expect(spots).toHaveLength(n);
      }
    }
  });

  it("LR splits keep left and right counts within 1", () => {
    const spots = dancersForLayoutPreset(15, "split_lr_cluster");
    const left = spots.filter((s) => s.xPct < 50);
    const right = spots.filter((s) => s.xPct >= 50);
    expect(Math.abs(left.length - right.length)).toBeLessThanOrEqual(1);
  });
});
