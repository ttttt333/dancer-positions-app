import { describe, it, expect } from "vitest";
import {
  evaluateSectionContextScore,
  resolveSectionRuleCategory,
} from "./sectionContextRules";
import { evaluateMotionDynamics } from "./motionDynamicsEvaluator";
import { enforceAndEvaluateSymmetry } from "./symmetryGuard";
import { scorePresetAgainstGoldenRules } from "./goldenFormationFilter";

describe("sectionAndMotionGuard", () => {
  it("OUTRO で GRID が減点され V_SHAPE が高評価されること", () => {
    const gridScore = evaluateSectionContextScore("OUTRO", "GRID");
    const vScore = evaluateSectionContextScore("OUTRO", "V_SHAPE");
    expect(gridScore).toBeLessThan(0);
    expect(vScore).toBeGreaterThan(0.3);
  });

  it("16人中2人しか動かない場合、移動ダイナミクスで大幅減点されること", () => {
    const prev = Array.from({ length: 16 }, (_, i) => ({
      xPct: i * 5 + 10,
      yPct: 50,
    }));
    const next = prev.map((p, i) =>
      i < 2 ? { xPct: p.xPct + 15, yPct: p.yPct } : { ...p }
    );

    const result = evaluateMotionDynamics(prev, next);
    expect(result.movingRatio).toBeLessThan(0.35);
    expect(result.scoreAdjustment).toBeLessThan(-0.2);
  });

  it("左右非対称なV字が線対称に補正されること", () => {
    const asymmetricalV = [
      { xPct: 50, yPct: 20 },
      { xPct: 35, yPct: 40 }, // left (dx=15)
      { xPct: 60, yPct: 40 }, // right (dx=10)
    ];

    const { enforcedPositions } = enforceAndEvaluateSymmetry(
      asymmetricalV,
      "V_SHAPE"
    );
    expect(enforcedPositions[1]!.xPct).toBe(37.5); // 50 - 12.5
    expect(enforcedPositions[2]!.xPct).toBe(62.5); // 50 + 12.5
  });

  it("resolveSectionRuleCategory maps layout ids for OUTRO scoring", () => {
    expect(resolveSectionRuleCategory("STAGGERED_GRID", "grid")).toBe("GRID");
    expect(resolveSectionRuleCategory("V_SHAPE", "vee")).toBe("V_SHAPE");
    expect(resolveSectionRuleCategory("DIAMOND_BOX", "diamond")).toBe("DIAMOND");
  });

  it("golden filter applies OUTRO section context (grid vs vee)", () => {
    const section = {
      label: "OUTRO" as const,
      start_eight: 20,
      end_eight: 24,
      start_time: 80,
      end_time: 96,
      cluster_id: 9,
      mean_energy: 0.4,
      energy_trend: -0.01,
      repeat_count: 1,
      confidence: 0.8,
    };
    const grid = scorePresetAgainstGoldenRules(
      { id: "grid" },
      undefined,
      undefined,
      { section }
    );
    const vee = scorePresetAgainstGoldenRules(
      { id: "vee" },
      undefined,
      undefined,
      { section }
    );
    expect(vee.scoreAdjustment).toBeGreaterThan(grid.scoreAdjustment);
  });
});
