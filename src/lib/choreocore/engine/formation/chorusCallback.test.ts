/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  CALLBACK_FINAL,
  CALLBACK_REPEAT,
  CALLBACK_SCALE_MAX,
  FINAL_CHORUS_SCALE,
  applyChorusCallbackToRecommendation,
  decideChorusCallback,
  scaleSpotsFromCenter,
} from "./chorusCallback";
import type { FormationRecommendation } from "./intentFormationTypes";
import type { ChoreographicIntent } from "../intent/ChoreographicIntentTypes";
import type { RankedFormationCandidate } from "./intentFormationTypes";

function intent(
  variation: ChoreographicIntent["variation"],
  chorusFamilyId: string | null = "chorus-A"
): ChoreographicIntent {
  return {
    cueId: `cue-${variation}`,
    primary: {
      intent: "EXPAND",
      score: 0.8,
      confidence: 0.8,
      intensity: 0.8,
      sourceEventIds: ["ec-1"],
      reasonCodes: ["EXPAND"],
    },
    alternatives: [],
    contrastFromPrevious: 0,
    previousIntent: null,
    sourceEventId: "ec-1",
    chorusFamilyId,
    variation,
  };
}

function cand(
  family: RankedFormationCandidate["shapeFamily"],
  id: string
): RankedFormationCandidate {
  return {
    formation: {
      id,
      type: family === "V" ? "V" : family === "LINE" ? "LINE" : "CLUSTER",
      positions: {},
      symmetry: 50,
      complexity: 20,
      stageCoverage: family === "V" ? 70 : 40,
      visualImpact: 50,
      tags: [],
    },
    candidateId: id,
    templateId: `tmpl-${id}`,
    shapeFamily: family,
    score: family === "V" ? 80 : 70,
    intentAlignment: 70,
    visualImpact: 60,
    transitionQuality: 50,
    movementEfficiency: 50,
    movementCost: 20,
    visualImpactPerMovement: 2,
    stageUsage: 50,
    roleCompatibility: 50,
    complexityPenalty: 0,
    collisionPenalty: 0,
    reasonCodes: [`FAMILY_${family}`],
    feasibility: {
      valid: true,
      collisionRisk: 0,
      maxRequiredSpeed: 1,
      outsideStage: false,
      lockedViolation: false,
      rejectionReasons: [],
    },
  };
}

function rec(
  variation: ChoreographicIntent["variation"],
  ranked: RankedFormationCandidate[]
): FormationRecommendation {
  return {
    intent: intent(variation),
    primary: ranked[0] ?? null,
    alternatives: ranked.slice(1, 3),
    ranked,
    discardedCount: 0,
  };
}

describe("chorusCallback", () => {
  it("remembers first shape and reuses it on repeat / final", () => {
    const memory = new Map();
    const first = applyChorusCallbackToRecommendation(
      rec("first", [cand("V", "v1"), cand("LINE", "l1")]),
      memory
    );
    expect(first.callback?.rememberedShapeFamily).toBe("V");
    expect(memory.get("chorus-A")).toBe("V");

    const repeat = applyChorusCallbackToRecommendation(
      rec("repeat", [cand("LINE", "l2"), cand("V", "v2")]),
      memory
    );
    expect(repeat.primary?.shapeFamily).toBe("V");
    expect(repeat.primary?.reasonCodes).toContain(CALLBACK_REPEAT);
    expect(repeat.callback?.variation).toBe("repeat");
    expect(repeat.callback?.scale).toBe(0.72);

    const finale = applyChorusCallbackToRecommendation(
      rec("final", [cand("LINE", "l3"), cand("V", "v3")]),
      memory
    );
    expect(finale.primary?.shapeFamily).toBe("V");
    expect(finale.primary?.reasonCodes).toContain(CALLBACK_FINAL);
    expect(finale.primary?.reasonCodes).toContain(CALLBACK_SCALE_MAX);
    expect(finale.callback?.scale).toBe(1);
  });

  it("bypasses recent avoidance only when a memory hit exists", () => {
    const memory = new Map<string, "V">([["chorus-A", "V"]]);
    const hit = decideChorusCallback(intent("repeat"), memory, new Map([["chorus-A", "vee"]]));
    expect(hit.bypassRecentAvoidance).toBe(true);
    expect(hit.rememberedLayoutId).toBe("vee");
    const miss = decideChorusCallback(intent("repeat", "chorus-B"), memory);
    expect(miss.bypassRecentAvoidance).toBe(false);
  });

  it("scales spots out from center for the last chorus", () => {
    const scaled = scaleSpotsFromCenter(
      [
        { xPct: 40, yPct: 40 },
        { xPct: 60, yPct: 60 },
      ],
      FINAL_CHORUS_SCALE
    );
    expect(scaled[0]!.xPct).toBeLessThan(40);
    expect(scaled[1]!.xPct).toBeGreaterThan(60);
  });
});
