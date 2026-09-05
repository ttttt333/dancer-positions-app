/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { ChoreographicIntent, ChoreographicIntentType } from "../intent/ChoreographicIntentTypes";
import type { Formation } from "../types/FormationTypes";
import { FORMATION_FAMILY } from "../types/ScoringTypes";
import { stageCoverage } from "./FormationScaler";
import { DEFAULT_STAGE, lineFormation, makeCue } from "./formationFixtures";
import {
  generateIntentFormationCandidates,
  isFormationHardInfeasible,
  recommendFormationsForIntent,
} from "./intentFormationIntelligence";
import { HARD_CONSTRAINTS, VISUAL_IMPACT_PER_MOVEMENT } from "./intentFormationConfig";
import { analyzeFormationTransition } from "../movement/TransitionAnalyzer";
import { makeMovementTiming } from "../movement/MovementTiming";

const MAJOR_INTENTS: ChoreographicIntentType[] = [
  "EXPAND",
  "CONTRACT",
  "SPLIT",
  "MERGE",
  "HOLD",
  "REVEAL",
  "HIT",
  "SHIFT_CENTER",
];

function makeChoreoIntent(
  type: ChoreographicIntentType,
  intensity = 0.82,
  extra: Partial<ChoreographicIntent> = {}
): ChoreographicIntent {
  return {
    cueId: extra.cueId ?? "cue-intent-1",
    primary: {
      intent: type,
      score: 0.88,
      confidence: 0.84,
      intensity,
      sourceEventIds: ["ec-1"],
      reasonCodes: [type],
    },
    alternatives: [],
    contrastFromPrevious: extra.contrastFromPrevious ?? 0,
    previousIntent: extra.previousIntent ?? null,
  };
}

function clusterPositions(count: number): Record<string, { x: number; y: number }> {
  const cx = DEFAULT_STAGE.width / 2;
  const cy = DEFAULT_STAGE.depth / 2;
  const r = 30;
  const positions: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < count; i += 1) {
    const a = (i / Math.max(1, count)) * Math.PI * 2;
    positions[`d${i}`] = {
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
    };
  }
  return positions;
}

function formationFromPositions(
  id: string,
  type: Formation["type"],
  positions: Record<string, { x: number; y: number }>
): Formation {
  return {
    id,
    type,
    positions,
    symmetry: type === "LINE" ? 92 : 40,
    complexity: 22,
    stageCoverage: stageCoverage(positions, DEFAULT_STAGE),
    visualImpact: 48,
    tags: [type.toLowerCase()],
  };
}

function recommend(
  type: ChoreographicIntentType,
  options: {
    intensity?: number;
    current?: Formation;
    dancerCount?: number;
    previousIntent?: ChoreographicIntentType | null;
    availableSeconds?: number;
    lockedDancerIds?: string[];
  } = {}
) {
  const dancerCount = options.dancerCount ?? 6;
  const current =
    options.current ??
    formationFromPositions("cur-line", "LINE", lineFormation(dancerCount));
  return recommendFormationsForIntent({
    intent: makeChoreoIntent(type, options.intensity ?? 0.82, {
      previousIntent: options.previousIntent ?? null,
    }),
    cue: makeCue("EXPAND", "LARGE", { id: "cue-intent-1", rawTime: 48 }),
    currentFormation: current,
    dancerCount,
    stage: DEFAULT_STAGE,
    previousIntent: options.previousIntent ?? null,
    constraints: {
      availableSeconds: options.availableSeconds,
      lockedDancerIds: options.lockedDancerIds,
      bpm: 120,
    },
  });
}

describe("intentFormationIntelligence", () => {
  it("A. major intents each produce multiple feasible candidates", () => {
    for (const intent of MAJOR_INTENTS) {
      const result = recommend(intent);
      expect(result.ranked.length, intent).toBeGreaterThanOrEqual(2);
      expect(result.primary, intent).not.toBeNull();
      expect(result.ranked.every((c) => c.feasibility.valid), intent).toBe(true);
    }
  });

  it("B. hard constraints drop outside-stage / locked / impossible transitions", () => {
    const current = formationFromPositions("cur-line", "LINE", lineFormation(6));
    const outside = {
      ...current,
      id: "bad-outside",
      positions: {
        d0: { x: -400, y: -400 },
        d1: { x: -380, y: -400 },
        d2: { x: -360, y: -400 },
        d3: { x: -340, y: -400 },
        d4: { x: -320, y: -400 },
        d5: { x: -300, y: -400 },
      },
    };
    const fakeCandidate = {
      id: "cand-outside",
      formation: outside,
      templateId: "outside",
      intentMatch: 50,
      dancerCountFit: 100,
      stageFit: 0,
      spacingPreview: 0,
      symmetry: 0,
      complexity: 20,
      stageCoverage: 0,
      visualImpact: 10,
      rejected: true,
      rejectionReasons: ["OUTSIDE_SAFE_MARGIN"],
      metadata: { generatedFromCueId: "cue-intent-1", generationStrategy: "test" },
    };
    const transition = analyzeFormationTransition(
      {
        currentFormation: current,
        nextFormation: outside,
        cue: makeCue("EXPAND"),
        bpm: 120,
        timing: makeMovementTiming(46, 48, 120),
        stage: DEFAULT_STAGE,
      },
      fakeCandidate
    );
    const hard = isFormationHardInfeasible({
      candidate: fakeCandidate,
      transition,
      current,
    });
    expect(hard.valid).toBe(false);
    expect(hard.outsideStage).toBe(true);

    const locked = recommend("EXPAND", {
      lockedDancerIds: ["d0", "d1", "d2", "d3", "d4", "d5"],
    });
    expect(locked.ranked.every((c) => c.feasibility.lockedViolation === false)).toBe(
      true
    );
    expect(locked.discardedCount).toBeGreaterThan(0);
  });

  it("C. EXPAND vs CONTRACT reflect coverage / compactness direction", () => {
    const current = formationFromPositions("cur-mid", "LINE", lineFormation(6));
    const expand = recommend("EXPAND", { current, intensity: 0.9 });
    const contract = recommend("CONTRACT", { current, intensity: 0.9 });
    expect(expand.primary).not.toBeNull();
    expect(contract.primary).not.toBeNull();
    expect(expand.primary!.formation.stageCoverage).toBeGreaterThan(
      contract.primary!.formation.stageCoverage
    );
    expect(expand.primary!.reasonCodes).toContain("INTENT_EXPAND");
    expect(contract.primary!.reasonCodes).toContain("INTENT_CONTRACT");
  });

  it("D. movement efficiency uses visual impact / movement cost, not distance alone", () => {
    const result = recommend("EXPAND", { intensity: 0.85 });
    expect(result.ranked.length).toBeGreaterThanOrEqual(2);
    for (const row of result.ranked) {
      expect(row.visualImpactPerMovement).toBeGreaterThan(0);
      expect(row.movementEfficiency).toBeGreaterThan(0);
      expect(row.movementCost).toBeGreaterThanOrEqual(0);
    }
    const byVipm = [...result.ranked].sort(
      (a, b) => b.visualImpactPerMovement - a.visualImpactPerMovement
    );
    const byCost = [...result.ranked].sort((a, b) => a.movementCost - b.movementCost);
    const vipmBest = byVipm[0]!;
    expect(
      vipmBest.visualImpact /
        Math.max(VISUAL_IMPACT_PER_MOVEMENT.costFloor, vipmBest.movementCost)
    ).toBeCloseTo(vipmBest.visualImpactPerMovement, 5);
    const cheapest = byCost[0]!;
    const richest = [...result.ranked].sort((a, b) => b.visualImpact - a.visualImpact)[0]!;
    if (cheapest.candidateId !== richest.candidateId) {
      expect(vipmBest.movementEfficiency).toBeGreaterThan(0);
    }
  });

  it("E. current formation can change candidate ranking", () => {
    const line = formationFromPositions("cur-line", "LINE", lineFormation(6));
    const cluster = formationFromPositions("cur-cluster", "CLUSTER", clusterPositions(6));
    const fromLine = recommend("EXPAND", { current: line, intensity: 0.85 });
    const fromCluster = recommend("EXPAND", { current: cluster, intensity: 0.85 });
    expect(fromLine.primary).not.toBeNull();
    expect(fromCluster.primary).not.toBeNull();
    const lineKey = fromLine.ranked.map((c) => `${c.candidateId}:${c.score.toFixed(3)}`).join("|");
    const clusterKey = fromCluster.ranked
      .map((c) => `${c.candidateId}:${c.score.toFixed(3)}`)
      .join("|");
    expect(lineKey).not.toEqual(clusterKey);
  });

  it("F. intent intensity changes evaluation", () => {
    const current = formationFromPositions("cur-cluster", "CLUSTER", clusterPositions(6));
    const high = recommend("EXPAND", { current, intensity: 0.95 });
    const low = recommend("EXPAND", { current, intensity: 0.32 });
    expect(high.primary).not.toBeNull();
    expect(low.primary).not.toBeNull();
    const highKey = high.ranked.map((c) => `${c.templateId}:${c.score.toFixed(3)}`).join("|");
    const lowKey = low.ranked.map((c) => `${c.templateId}:${c.score.toFixed(3)}`).join("|");
    expect(highKey).not.toEqual(lowKey);
  });

  it("G. primary + alternatives keep meaningful family diversity", () => {
    const result = recommend("EXPAND", { intensity: 0.9 });
    expect(result.primary).not.toBeNull();
    const top = [result.primary!, ...result.alternatives];
    expect(top.length).toBeGreaterThanOrEqual(2);
    const families = new Set(top.map((c) => c.shapeFamily));
    expect(families.size).toBeGreaterThanOrEqual(2);
    expect(top[0]!.formation.type).not.toBe("CUSTOM");
  });

  it("H. identical input returns identical ranking", () => {
    const current = formationFromPositions("cur-line", "LINE", lineFormation(6));
    const a = recommend("EXPAND", { current, intensity: 0.8 });
    const b = recommend("EXPAND", { current, intensity: 0.8 });
    expect(a.ranked.map((c) => c.candidateId)).toEqual(b.ranked.map((c) => c.candidateId));
    expect(a.ranked.map((c) => c.score)).toEqual(b.ranked.map((c) => c.score));
    expect(a.primary?.candidateId).toBe(b.primary?.candidateId);
  });

  it("does not map one intent to one formation type", () => {
    const types = new Set(
      generateIntentFormationCandidates({
        intent: makeChoreoIntent("EXPAND", 0.9),
        cue: makeCue("EXPAND", "LARGE", { id: "cue-intent-1" }),
        currentFormation: formationFromPositions("cur-line", "LINE", lineFormation(6)),
        dancerCount: 6,
        stage: DEFAULT_STAGE,
      }).map((c) => c.formation.type)
    );
    expect(types.size).toBeGreaterThan(1);
    expect(types.has("V") && types.size === 1).toBe(false);
  });

  it("reason codes and score breakdown stay explorable", () => {
    const result = recommend("SPLIT", { intensity: 0.8 });
    const row = result.primary!;
    expect(row.reasonCodes.some((c) => c.startsWith("INTENT_"))).toBe(true);
    expect(row.intentAlignment).toBeGreaterThan(0);
    expect(row.visualImpact).toBeGreaterThan(0);
    expect(row.transitionQuality).toBeGreaterThanOrEqual(0);
    expect(row.feasibility.valid).toBe(true);
    expect(FORMATION_FAMILY[row.formation.type]).toBe(row.shapeFamily);
  });

  it("locked epsilon is the named hard-constraint constant", () => {
    expect(HARD_CONSTRAINTS.lockedPositionEpsilon).toBeGreaterThan(0);
  });
});
