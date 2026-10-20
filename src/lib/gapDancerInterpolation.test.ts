import { describe, expect, it } from "vitest";
import { lerpDancersAcrossGap } from "./gapDancerInterpolation";
import type { DancerSpot } from "../types/choreography";

const spot = (id: string, xPct: number, yPct: number): DancerSpot => ({
  id,
  label: id,
  xPct,
  yPct,
  colorIndex: 0,
});

describe("lerpDancersAcrossGap", () => {
  it("袖に待機したままの人はキュー間でも舞台に戻らない", () => {
    const from = [spot("a", -12, 30), spot("b", 50, 50)];
    const to = [spot("a", -12, 30), spot("b", 60, 50)];
    for (const alpha of [0.1, 0.5, 0.9]) {
      const [a] = lerpDancersAcrossGap(from, to, alpha, "linear");
      expect(a!.xPct).toBeCloseTo(-12);
    }
  });

  it("袖の中で位置が変わる人も袖の中を移動する", () => {
    const from = [spot("a", 110, 20)];
    const to = [spot("a", 112, 60)];
    const [a] = lerpDancersAcrossGap(from, to, 0.5, "detour_bulge");
    expect(a!.xPct).toBeGreaterThanOrEqual(110);
  });

  it("舞台上だけで動く人は従来どおり舞台内に収まる", () => {
    const from = [spot("a", 5, 50)];
    const to = [spot("a", 95, 50)];
    const [a] = lerpDancersAcrossGap(from, to, 0.5, "front_half_via_shimote");
    expect(a!.xPct).toBeGreaterThanOrEqual(2);
    expect(a!.xPct).toBeLessThanOrEqual(98);
  });

  it("袖から舞台へ出る人は袖側から入ってくる", () => {
    const from = [spot("a", -10, 40)];
    const to = [spot("a", 30, 40)];
    const [a] = lerpDancersAcrossGap(from, to, 0.1, "linear");
    expect(a!.xPct).toBeCloseTo(-6);
  });
});
