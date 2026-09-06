import { describe, expect, it } from "vitest";
import {
  layoutShapeBucket,
  quantizePolicyForLayoutPreset,
} from "./layoutPresetBridge";
import { dancersForLayoutPreset } from "../../formationLayouts";

describe("quantizePolicyForLayoutPreset", () => {
  it("disables re-stagger for depth presets that already encode 千鳥", () => {
    expect(layoutShapeBucket("stagger")).toBe("depth");
    expect(quantizePolicyForLayoutPreset("stagger")).toEqual({
      enableStaggering: false,
      enableSymmetry: true,
      enableLattice: true,
    });
  });

  it("disables lattice for vee / arc / diamond so diagonals survive", () => {
    expect(quantizePolicyForLayoutPreset("vee").enableLattice).toBe(false);
    expect(quantizePolicyForLayoutPreset("arc").enableLattice).toBe(false);
    expect(quantizePolicyForLayoutPreset("diamond").enableLattice).toBe(false);
    expect(quantizePolicyForLayoutPreset("vee").enableStaggering).toBe(false);
  });

  it("disables forced symmetry for asymmetric presets", () => {
    expect(quantizePolicyForLayoutPreset("asymmetric_l").enableSymmetry).toBe(
      false
    );
  });
});

describe("vee layout tip uniqueness", () => {
  it("does not duplicate tip coordinates for even dancer counts", () => {
    for (const n of [4, 6, 8]) {
      const spots = dancersForLayoutPreset(n, "vee");
      const keys = spots.map(
        (s) => `${s.xPct.toFixed(2)},${s.yPct.toFixed(2)}`
      );
      expect(new Set(keys).size).toBe(n);
    }
  });

  it("places an odd-count tip on center x≈50", () => {
    const spots = dancersForLayoutPreset(5, "vee");
    const tip = spots.reduce((best, s) => (s.yPct > best.yPct ? s : best));
    expect(tip.xPct).toBeCloseTo(50, 0);
  });
});
