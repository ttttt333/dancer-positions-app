import { describe, expect, it } from "vitest";
import {
  classifyLayoutPresetId,
  classifyPresetFamily,
  orderLayoutsByGoldenPreference,
  scorePresetAgainstGoldenRules,
} from "./goldenFormationFilter";

describe("goldenFormationFilter", () => {
  it("maps staple layout ids onto the golden seven", () => {
    expect(classifyLayoutPresetId("line")).toBe("HORIZON_LINE");
    expect(classifyLayoutPresetId("stagger")).toBe("STAGGERED_GRID");
    expect(classifyLayoutPresetId("vee")).toBe("V_SHAPE");
    expect(classifyLayoutPresetId("diamond")).toBe("DIAMOND_BOX");
    expect(classifyLayoutPresetId("wing_spread")).toBe("WING_SPREAD");
    expect(classifyLayoutPresetId("cluster_tight")).toBe("TIGHT_CLUSTER");
    expect(classifyLayoutPresetId("pyramid_inverse")).toBe("SINGLE_CENTER_BACK");
  });

  it("penalizes non-golden and asymmetric presets", () => {
    const odd = scorePresetAgainstGoldenRules({
      id: "pinwheel",
      positions: [
        { x: 2, y: 0 },
        { x: 0.5, y: 1 },
        { x: -1.2, y: 0.3 },
      ],
    });
    expect(odd.isGolden).toBe(false);
    expect(odd.scoreAdjustment).toBeLessThan(-0.5);

    const line = scorePresetAgainstGoldenRules({ id: "line" });
    expect(line.isGolden).toBe(true);
    expect(line.scoreAdjustment).toBeGreaterThanOrEqual(0);
  });

  it("gives CONTRACT an intent bonus for tight cluster", () => {
    const hit = scorePresetAgainstGoldenRules(
      { id: "cluster_tight" },
      "CONTRACT"
    );
    const miss = scorePresetAgainstGoldenRules(
      { id: "cluster_tight" },
      "EXPAND"
    );
    expect(hit.scoreAdjustment).toBeGreaterThan(miss.scoreAdjustment);
  });

  it("gives EXPAND an intent bonus for wings / V", () => {
    const wing = scorePresetAgainstGoldenRules({ id: "wing_spread" }, "EXPAND");
    const vee = scorePresetAgainstGoldenRules({ id: "vee" }, "EXPAND");
    const line = scorePresetAgainstGoldenRules({ id: "line" }, "EXPAND");
    expect(wing.scoreAdjustment).toBeGreaterThan(line.scoreAdjustment);
    expect(vee.scoreAdjustment).toBeGreaterThan(line.scoreAdjustment);
  });

  it("orders layouts so golden families come first", () => {
    const ordered = orderLayoutsByGoldenPreference([
      "pinwheel",
      "asymmetric_l",
      "stagger",
      "vee",
      "heart",
      "cluster_tight",
    ]);
    expect(ordered.slice(0, 3)).toEqual(["stagger", "vee", "cluster_tight"]);
    expect(ordered.slice(-3)).toEqual(
      expect.arrayContaining(["pinwheel", "heart", "asymmetric_l"])
    );
  });

  it("bumps intent-matched golden layouts ahead while keeping relative order", () => {
    const ordered = orderLayoutsByGoldenPreference(
      ["stagger", "cluster_tight", "vee", "pinwheel"],
      { intentPrimary: "CONTRACT" }
    );
    expect(ordered[0]).toBe("cluster_tight");
    expect(ordered.slice(0, 3)).toEqual(["cluster_tight", "stagger", "vee"]);
    expect(ordered[ordered.length - 1]).toBe("pinwheel");
  });

  it("classifies a geometric V from positions", () => {
    const family = classifyPresetFamily([
      { x: 0, y: 0 },
      { x: -0.9, y: 1 },
      { x: 0.9, y: 1 },
      { x: -1.8, y: 2 },
      { x: 1.8, y: 2 },
    ]);
    expect(family).toBe("V_SHAPE");
  });

  it("penalizes uneven nearest-neighbor spacing via tidiness CV", () => {
    const tidy = scorePresetAgainstGoldenRules({
      id: "stagger",
      positions: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    });
    const messy = scorePresetAgainstGoldenRules({
      id: "stagger",
      positions: [
        { x: 0, y: 0 },
        { x: 0.1, y: 0 },
        { x: 0.2, y: 0 },
        { x: 8, y: 0 },
      ],
    });
    expect(messy.scoreAdjustment).toBeLessThan(tidy.scoreAdjustment);
    expect(messy.scoreAdjustment).toBeLessThan(0);
  });
});
