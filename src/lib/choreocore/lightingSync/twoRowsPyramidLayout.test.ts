import { describe, expect, it } from "vitest";
import { dancersForLayoutPreset } from "../../formationLayouts";

describe("two_rows / dense pyramid presets", () => {
  it("two_rows places balanced front/back rows without stagger offset", () => {
    const spots = dancersForLayoutPreset(8, "two_rows");
    expect(spots).toHaveLength(8);
    const ys = [...new Set(spots.map((s) => Math.round(s.yPct)))].sort(
      (a, b) => b - a
    );
    expect(ys).toHaveLength(2);
    const front = spots.filter((s) => Math.round(s.yPct) === ys[0]);
    const back = spots.filter((s) => Math.round(s.yPct) === ys[1]);
    expect(front).toHaveLength(4);
    expect(back).toHaveLength(4);
    // 各列は中央揃え・等間隔（千鳥オフセットなし）
    const frontXs = front.map((s) => s.xPct).sort((a, b) => a - b);
    const backXs = back.map((s) => s.xPct).sort((a, b) => a - b);
    expect(frontXs[0]).toBeCloseTo(backXs[0]!, 0);
    expect(frontXs[frontXs.length - 1]).toBeCloseTo(
      backXs[backXs.length - 1]!,
      0
    );
    const midFront = (frontXs[0]! + frontXs[frontXs.length - 1]!) / 2;
    expect(midFront).toBeCloseTo(50, 0);
  });

  it("compact pyramid stays within ~±2 grid width (dense like reference)", () => {
    const dense = dancersForLayoutPreset(16, "pyramid", {
      compact: true,
      dancerSpacingMm: 1500,
      stageWidthMm: 10000,
    });
    const xs = dense.map((s) => s.xPct);
    const half = (Math.max(...xs) - Math.min(...xs)) / 2;
    // 場ミリ拡大をスキップし、半幅 20% 未満（ステージ ±2 相当）
    expect(half).toBeLessThan(20);
  });

  it("compact pyramid is tighter than default pyramid", () => {
    const normal = dancersForLayoutPreset(9, "pyramid");
    const dense = dancersForLayoutPreset(9, "pyramid", { compact: true });
    const span = (spots: typeof normal) => {
      const xs = spots.map((s) => s.xPct);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(span(dense)).toBeLessThan(span(normal) * 0.75);
  });
});
