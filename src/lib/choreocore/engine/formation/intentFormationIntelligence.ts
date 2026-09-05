/**
 * Stage 6: Choreographic Intent → Formation candidates → VIPM scoring → ranking.
 * Formation Engine / Motion Engine / Music / Cue / Intent は書き換えない。
 */

import type { ChoreographicIntent, ChoreographicIntentType } from "../intent/ChoreographicIntentTypes";
import {
  applyChorusCallbackToRecommendation,
  type ChorusShapeMemory,
} from "./chorusCallback";
import type { FormationCue, StageConfig } from "../types/CueTypes";
import type { Formation, FormationCandidate } from "../types/FormationTypes";
import { FORMATION_FAMILY } from "../types/ScoringTypes";
import { generateFormationCandidates } from "./FormationCandidateGenerator";
import { analyzeFormationTransition } from "../movement/TransitionAnalyzer";
import { makeMovementTiming } from "../movement/MovementTiming";
import { transitionQualityScore } from "../scoring/TransitionQualityScore";
import { visualImpactScore as storedVisualImpactScore } from "../scoring/VisualImpactScore";
import { intentMatchScore } from "./FormationIntentMapper";
import { clamp, finite, mean } from "../scoring/scoreMath";
import {
  COMPLEXITY_SOFT,
  COVERAGE_FIT_SCALE,
  CONTRAST_FIT_SCALE,
  DEFAULT_TRANSITION_BEATS,
  DEFAULT_TRANSITION_BPM,
  DIVERSITY_RANKING,
  FORMATION_INTELLIGENCE_ALTERNATIVE_COUNT,
  FORMATION_INTELLIGENCE_CANDIDATE_COUNT,
  FORMATION_INTELLIGENCE_PENALTIES,
  FORMATION_INTELLIGENCE_VERSION,
  FORMATION_INTELLIGENCE_WEIGHTS,
  HARD_CONSTRAINTS,
  HARD_REJECTION_REASONS,
  MOVEMENT_COST_NORMALIZE,
  MOVEMENT_COST_WEIGHTS,
  VISUAL_IMPACT_COMPONENT_WEIGHTS,
  VISUAL_IMPACT_PER_MOVEMENT,
} from "./intentFormationConfig";
import type {
  FormationFeasibilityBreakdown,
  FormationIntelligenceMetrics,
  FormationIntelligenceReport,
  FormationIntelligenceRequest,
  FormationRecommendation,
  FormationShapeMetrics,
  RankedFormationCandidate,
} from "./intentFormationTypes";
import {
  fitToTarget,
  intentContextAdjustment,
  measureFormationShape,
  shapeContrastScore,
  signedCoverageChange,
  targetCoverageDelta,
  targetShapeContrast,
} from "./intentFormationMetrics";
import {
  choreographicIntentToCueIntent,
  cueForChoreographicIntent,
} from "./intentToFormationCue";
import type { TransitionAnalysis } from "../types/MovementTypes";

export {
  FORMATION_INTELLIGENCE_VERSION,
  FORMATION_INTELLIGENCE_WEIGHTS,
  VISUAL_IMPACT_PER_MOVEMENT,
} from "./intentFormationConfig";
export type {
  FormationCandidateHumanRating,
  FormationIntelligenceReport,
  FormationRecommendation,
  RankedFormationCandidate,
} from "./intentFormationTypes";

function beatsToSeconds(beats: number, bpm: number): number {
  return Math.max(0.05, beats * (60 / (bpm > 0 ? bpm : DEFAULT_TRANSITION_BPM)));
}

function asCurrentFormation(formation: Formation, stage: StageConfig): Formation {
  const metrics = measureFormationShape(formation, stage);
  return {
    ...formation,
    stageCoverage: metrics.stageCoverage,
  };
}

export function isFormationHardInfeasible(input: {
  candidate: FormationCandidate;
  transition: TransitionAnalysis;
  current: Formation;
  lockedDancerIds?: string[];
}): FormationFeasibilityBreakdown {
  const reasons: string[] = [];
  const plan = input.transition.movementPlan;
  const maxSpeed = Math.max(0, ...plan.movements.map((m) => m.speedRatio));
  const outside =
    plan.stageBoundaryViolation ||
    input.candidate.rejectionReasons.includes("OUTSIDE_SAFE_MARGIN") ||
    input.transition.warnings.some((w) => w.startsWith("STAGE_OUTSIDE"));
  for (const r of input.candidate.rejectionReasons) {
    if ((HARD_REJECTION_REASONS as readonly string[]).includes(r)) {
      reasons.push(r);
    }
  }
  if (outside) reasons.push("OUTSIDE_STAGE");
  const transitionReason = input.transition.rejectionReason;
  if (
    transitionReason &&
    (HARD_REJECTION_REASONS as readonly string[]).includes(transitionReason)
  ) {
    reasons.push(transitionReason);
  }
  if (maxSpeed > HARD_CONSTRAINTS.maxSpeedRatio) {
    reasons.push("IMPOSSIBLE_SPEED");
  }
  if (
    plan.collision.hasCollision &&
    plan.collision.risk > HARD_CONSTRAINTS.maxCollisionRisk &&
    transitionReason === "STATIC_COLLISION"
  ) {
    reasons.push("HARD_COLLISION");
  }
  let lockedViolation = false;
  if (input.lockedDancerIds?.length) {
    for (const id of input.lockedDancerIds) {
      const from = input.current.positions[id];
      const to = input.candidate.formation.positions[id];
      if (!from || !to) {
        lockedViolation = true;
        reasons.push("LOCKED_POSITION_MISSING");
        break;
      }
      if (
        Math.hypot(from.x - to.x, from.y - to.y) > HARD_CONSTRAINTS.lockedPositionEpsilon
      ) {
        lockedViolation = true;
        reasons.push("LOCKED_POSITION_VIOLATION");
        break;
      }
    }
  }
  const unique = [...new Set(reasons)];
  return {
    valid: unique.length === 0,
    collisionRisk: clamp(finite(plan.collision.risk), 0, 100),
    maxRequiredSpeed: finite(maxSpeed),
    outsideStage: outside,
    lockedViolation,
    rejectionReasons: unique,
  };
}

function movementCostFromTransition(transition: TransitionAnalysis): number {
  const plan = transition.movementPlan;
  const path = clamp(
    (plan.totalDistance / MOVEMENT_COST_NORMALIZE.pathLengthRef) * 100,
    0,
    100
  );
  const maxD = clamp(
    (plan.maxDistance / MOVEMENT_COST_NORMALIZE.maxDistanceRef) * 100,
    0,
    100
  );
  const speed = clamp(
    Math.max(0, ...plan.movements.map((m) => m.speedRatio)) * 70,
    0,
    100
  );
  const crossing = clamp(finite(plan.collision.risk), 0, 100);
  const timing = clamp(
    Math.max(0, ...plan.movements.map((m) => m.speedRatio)) * 60,
    0,
    100
  );
  return clamp(
    path * MOVEMENT_COST_WEIGHTS.pathLength +
      maxD * MOVEMENT_COST_WEIGHTS.maxIndividualDistance +
      speed * MOVEMENT_COST_WEIGHTS.requiredSpeed +
      crossing * MOVEMENT_COST_WEIGHTS.crossingRisk +
      timing * MOVEMENT_COST_WEIGHTS.timingPressure,
    0,
    100
  );
}

function visualImpactPerMovementScore(visualImpact: number, movementCost: number): {
  vipm: number;
  efficiency: number;
} {
  const cost = Math.max(VISUAL_IMPACT_PER_MOVEMENT.costFloor, movementCost);
  const vipm = visualImpact / cost;
  return {
    vipm,
    efficiency: clamp(vipm * VISUAL_IMPACT_PER_MOVEMENT.scoreScale, 0, 100),
  };
}

function directionalCoverageScore(
  intent: ChoreographicIntentType,
  coverageDelta: number
): number {
  if (
    intent === "EXPAND" ||
    intent === "REVEAL" ||
    intent === "MAJOR_CHANGE" ||
    intent === "SPLIT"
  ) {
    return clamp(50 + coverageDelta * 1.2, 0, 100);
  }
  if (intent === "CONTRACT" || intent === "HIDE" || intent === "MERGE" || intent === "RESET") {
    return clamp(50 - coverageDelta * 1.2, 0, 100);
  }
  return clamp(100 - Math.abs(coverageDelta) * 1.1, 0, 100);
}

function directionalDensityScore(
  intent: ChoreographicIntentType,
  densityChange: number
): number {
  if (intent === "CONTRACT" || intent === "HIDE" || intent === "MERGE") {
    return clamp(50 + densityChange * 1.1, 0, 100);
  }
  if (intent === "EXPAND" || intent === "REVEAL" || intent === "SPLIT") {
    return clamp(50 - densityChange * 1.1, 0, 100);
  }
  return clamp(100 - Math.abs(densityChange) * 0.8, 0, 100);
}

function symmetryPreference(
  intent: ChoreographicIntentType,
  candidateSymmetry: number,
  symmetryChange: number
): number {
  if (intent === "SPLIT" || intent === "SHIFT_CENTER" || intent === "TRAVEL") {
    return clamp(100 - candidateSymmetry * 0.35 + Math.abs(symmetryChange) * 0.4, 0, 100);
  }
  if (intent === "HIT" || intent === "HOLD" || intent === "RESET") {
    return clamp(candidateSymmetry, 0, 100);
  }
  return clamp(55 + candidateSymmetry * 0.2, 0, 100);
}

function computeVisualImpact(options: {
  candidate: FormationCandidate;
  cue: FormationCue;
  intent: ChoreographicIntentType;
  current: FormationShapeMetrics;
  next: FormationShapeMetrics;
}): number {
  const stored = storedVisualImpactScore({
    candidate: options.candidate,
    cue: options.cue,
  });
  const contrast = shapeContrastScore(options.current, options.next);
  const coverageDelta = signedCoverageChange(options.current, options.next);
  const densityChange = options.next.compactness - options.current.compactness;
  const symmetryChange = options.next.symmetry - options.current.symmetry;
  const centerMove = Math.hypot(
    options.next.centroid.x - options.current.centroid.x,
    options.next.centroid.y - options.current.centroid.y
  );
  const centerShift = clamp(centerMove / 8, 0, 100);
  const w = VISUAL_IMPACT_COMPONENT_WEIGHTS;
  return clamp(
    stored * w.storedImpact +
      contrast * w.shapeContrast +
      directionalDensityScore(options.intent, densityChange) * w.densityChange +
      directionalCoverageScore(options.intent, coverageDelta) * w.stageCoverageChange +
      symmetryPreference(options.intent, options.next.symmetry, symmetryChange) *
        w.symmetryChange +
      (options.intent === "SHIFT_CENTER" ? centerShift : clamp(40 + centerShift * 0.3, 0, 100)) *
        w.centerShift,
    0,
    100
  );
}

function computeIntentAlignment(options: {
  candidate: FormationCandidate;
  intent: ChoreographicIntentType;
  intensity: number;
  current: FormationShapeMetrics;
  next: FormationShapeMetrics;
  previousIntent?: ChoreographicIntentType | null;
  nextIntent?: ChoreographicIntentType | null;
}): number {
  const cueIntent = choreographicIntentToCueIntent(options.intent);
  const base = intentMatchScore(options.candidate.formation.type, cueIntent);
  const coverageDelta = signedCoverageChange(options.current, options.next);
  const contrast = shapeContrastScore(options.current, options.next);
  const coverageFit = fitToTarget(
    coverageDelta,
    targetCoverageDelta(options.intent, options.intensity),
    COVERAGE_FIT_SCALE
  );
  const contrastFit = fitToTarget(
    contrast,
    targetShapeContrast(options.intent, options.intensity),
    CONTRAST_FIT_SCALE
  );
  let extra = 0;
  if (options.intent === "SPLIT") {
    extra += options.next.groupSeparation * 0.25;
    if (options.next.type === "SPLIT" || options.next.family === "SPLIT") extra += 8;
  }
  if (options.intent === "SHIFT_CENTER") {
    extra += Math.min(18, Math.abs(options.next.centerShift - options.current.centerShift) * 0.4);
  }
  if (options.intent === "HOLD") {
    extra += clamp(100 - contrast, 0, 100) * 0.15;
  }
  extra += intentContextAdjustment(
    options.previousIntent,
    options.intent,
    options.nextIntent,
    contrast
  );
  return clamp(base * 0.45 + coverageFit * 0.3 + contrastFit * 0.25 + extra, 0, 100);
}

function computeStageUsage(
  intent: ChoreographicIntentType,
  next: FormationShapeMetrics
): number {
  if (intent === "EXPAND" || intent === "REVEAL" || intent === "MAJOR_CHANGE") {
    return clamp(next.stageCoverage * 0.7 + next.edgeUtilization * 0.3, 0, 100);
  }
  if (intent === "CONTRACT" || intent === "HIDE" || intent === "MERGE") {
    return clamp(next.compactness * 0.65 + next.centerStrength * 0.35, 0, 100);
  }
  if (intent === "SPLIT") {
    return clamp(next.groupSeparation * 0.55 + next.stageCoverage * 0.45, 0, 100);
  }
  return clamp(next.stageCoverage * 0.5 + next.centerStrength * 0.5, 0, 100);
}

function computeRoleCompatibility(candidate: FormationCandidate): number {
  const hierarchy = candidate.formation.visualHierarchy;
  if (!hierarchy) return 62;
  const values = Object.values(hierarchy);
  if (values.length === 0) return 62;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return clamp(55 + (max - min) * 20, 0, 100);
}

function complexityPenaltyValue(
  intent: ChoreographicIntentType,
  complexity: number
): number {
  if (intent === "MAJOR_CHANGE" || intent === "HIT" || intent === "REVEAL") {
    return clamp((complexity - 70) * 0.4, 0, 40);
  }
  if (intent === "HOLD" || intent === "RESET" || intent === "MICRO_SHIFT") {
    return clamp(Math.max(0, complexity - COMPLEXITY_SOFT.holdThreshold) * 0.8, 0, 80);
  }
  return clamp(Math.max(0, complexity - COMPLEXITY_SOFT.defaultSoftStart) * 0.55, 0, 60);
}

function reasonCodesFor(options: {
  intent: ChoreographicIntentType;
  next: FormationShapeMetrics;
  current: FormationShapeMetrics;
  visualImpact: number;
  movementCost: number;
  efficiency: number;
  feasibility: FormationFeasibilityBreakdown;
}): string[] {
  const codes = [`INTENT_${options.intent}`, `FAMILY_${options.next.family}`];
  const coverageDelta = signedCoverageChange(options.current, options.next);
  if (coverageDelta >= 8) codes.push("HIGH_STAGE_COVERAGE");
  if (coverageDelta <= -8) codes.push("HIGH_COMPACTNESS");
  if (shapeContrastScore(options.current, options.next) >= 45) {
    codes.push("STRONG_SHAPE_CONTRAST");
  }
  if (options.movementCost <= 28) codes.push("LOW_MOVEMENT_COST");
  if (options.efficiency >= 70) codes.push("HIGH_VIPM");
  if (options.visualImpact >= 72) codes.push("HIGH_VISUAL_IMPACT");
  if (options.feasibility.valid) codes.push("FEASIBLE");
  if (options.next.groupSeparation >= 35) codes.push("GROUP_SEPARATION");
  return codes;
}

function composeScore(
  parts: {
    intentAlignment: number;
    visualImpact: number;
    transitionQuality: number;
    movementEfficiency: number;
    stageUsage: number;
    roleCompatibility: number;
    complexityPenalty: number;
    collisionPenalty: number;
  },
  weights: Record<string, number> = FORMATION_INTELLIGENCE_WEIGHTS
): number {
  const w = weights;
  const p = FORMATION_INTELLIGENCE_PENALTIES;
  return clamp(
    parts.intentAlignment * w.intentAlignment +
      parts.visualImpact * w.visualImpact +
      parts.transitionQuality * w.transitionQuality +
      parts.movementEfficiency * w.movementEfficiency +
      parts.stageUsage * w.stageUsage +
      parts.roleCompatibility * w.roleCompatibility -
      parts.complexityPenalty * p.complexity -
      parts.collisionPenalty * p.collision,
    0,
    100
  );
}

function compareRanked(a: RankedFormationCandidate, b: RankedFormationCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.formation.type !== b.formation.type) {
    return a.formation.type.localeCompare(b.formation.type);
  }
  return a.candidateId.localeCompare(b.candidateId);
}

function pickPrimaryAndAlternatives(
  ranked: RankedFormationCandidate[]
): { primary: RankedFormationCandidate | null; alternatives: RankedFormationCandidate[] } {
  if (ranked.length === 0) return { primary: null, alternatives: [] };
  const primary = ranked[0]!;
  const alts: RankedFormationCandidate[] = [];
  const used = new Set<string>([primary.shapeFamily]);
  const gap = DIVERSITY_RANKING.maxScoreGapFromPrimary;
  for (const c of ranked.slice(1)) {
    if (alts.length >= FORMATION_INTELLIGENCE_ALTERNATIVE_COUNT) break;
    if (primary.score - c.score > gap) continue;
    if (DIVERSITY_RANKING.sameFamilySkip && used.has(c.shapeFamily)) continue;
    alts.push(c);
    used.add(c.shapeFamily);
  }
  for (const c of ranked.slice(1)) {
    if (alts.length >= FORMATION_INTELLIGENCE_ALTERNATIVE_COUNT) break;
    if (alts.includes(c)) continue;
    if (primary.score - c.score > gap) continue;
    alts.push(c);
  }
  return { primary, alternatives: alts };
}

export function generateIntentFormationCandidates(
  request: FormationIntelligenceRequest
): FormationCandidate[] {
  const intentType = request.intent.primary.intent;
  const intensity = request.intent.primary.intensity;
  const cue = cueForChoreographicIntent(request.cue, intentType, intensity);
  return generateFormationCandidates(
    {
      dancerCount: request.dancerCount,
      cue,
      intent: choreographicIntentToCueIntent(intentType),
      currentFormation: {
        id: request.currentFormation.id,
        positions: request.currentFormation.positions,
      },
      stage: request.stage,
    },
    {
      minCandidates: FORMATION_INTELLIGENCE_CANDIDATE_COUNT.min,
      maxCandidates: FORMATION_INTELLIGENCE_CANDIDATE_COUNT.max,
    }
  );
}

export function recommendFormationsForIntent(
  request: FormationIntelligenceRequest
): FormationRecommendation {
  const intentType = request.intent.primary.intent;
  const intensity = request.intent.primary.intensity;
  const cue = cueForChoreographicIntent(request.cue, intentType, intensity);
  const current = asCurrentFormation(request.currentFormation, request.stage);
  const currentMetrics = measureFormationShape(current, request.stage);
  const bpm = request.constraints?.bpm ?? DEFAULT_TRANSITION_BPM;
  const available =
    request.constraints?.availableSeconds ??
    beatsToSeconds(DEFAULT_TRANSITION_BEATS, bpm);
  const timing = makeMovementTiming(
    Math.max(0, cue.rawTime - available),
    Math.max(available, cue.rawTime),
    bpm
  );

  const generated = generateIntentFormationCandidates(request);
  const ranked: RankedFormationCandidate[] = [];
  let discardedCount = 0;

  for (const candidate of generated) {
    const transition = analyzeFormationTransition({
      currentFormation: current,
      nextFormation: candidate.formation,
      cue,
      bpm,
      timing,
      stage: request.stage,
    }, candidate);
    const feasibility = isFormationHardInfeasible({
      candidate,
      transition,
      current,
      lockedDancerIds: request.constraints?.lockedDancerIds,
    });
    if (!feasibility.valid) {
      discardedCount += 1;
      continue;
    }
    const nextMetrics = measureFormationShape(candidate.formation, request.stage);
    const visualImpact = computeVisualImpact({
      candidate,
      cue,
      intent: intentType,
      current: currentMetrics,
      next: nextMetrics,
    });
    const movementCost = movementCostFromTransition(transition);
    const { vipm, efficiency } = visualImpactPerMovementScore(visualImpact, movementCost);
    const intentAlignment = computeIntentAlignment({
      candidate,
      intent: intentType,
      intensity,
      current: currentMetrics,
      next: nextMetrics,
      previousIntent: request.previousIntent ?? request.intent.previousIntent,
      nextIntent: request.nextIntent,
    });
    const transitionQuality = transitionQualityScore(transition);
    const stageUsage = computeStageUsage(intentType, nextMetrics);
    const roleCompatibility = computeRoleCompatibility(candidate);
    const complexityPenalty = complexityPenaltyValue(intentType, nextMetrics.complexity);
    const collisionPenalty = clamp(feasibility.collisionRisk, 0, 100);
    const score = composeScore(
      {
        intentAlignment,
        visualImpact,
        transitionQuality,
        movementEfficiency: efficiency,
        stageUsage,
        roleCompatibility,
        complexityPenalty,
        collisionPenalty,
      },
      request.scoreWeights
    );
    ranked.push({
      formation: candidate.formation,
      candidateId: candidate.id,
      templateId: candidate.templateId,
      shapeFamily: FORMATION_FAMILY[candidate.formation.type],
      score,
      intentAlignment,
      visualImpact,
      transitionQuality,
      movementEfficiency: efficiency,
      movementCost,
      visualImpactPerMovement: vipm,
      stageUsage,
      roleCompatibility,
      complexityPenalty,
      collisionPenalty,
      reasonCodes: reasonCodesFor({
        intent: intentType,
        next: nextMetrics,
        current: currentMetrics,
        visualImpact,
        movementCost,
        efficiency,
        feasibility,
      }),
      feasibility,
    });
  }

  ranked.sort(compareRanked);
  const { primary, alternatives } = pickPrimaryAndAlternatives(ranked);
  return {
    intent: request.intent,
    primary,
    alternatives,
    ranked,
    discardedCount,
  };
}

function emptyMetrics(): FormationIntelligenceMetrics {
  return {
    intentAlignmentMean: 0,
    visualImpactMean: 0,
    movementEfficiencyMean: 0,
    feasibilityRate: 0,
    candidateDiversity: 0,
  };
}

export function summarizeFormationIntelligence(
  recommendations: FormationRecommendation[]
): FormationIntelligenceMetrics {
  const primaries = recommendations
    .map((r) => r.primary)
    .filter((p): p is RankedFormationCandidate => Boolean(p));
  if (primaries.length === 0) return emptyMetrics();
  const families = new Set(primaries.map((p) => p.shapeFamily));
  const rankedAll = recommendations.flatMap((r) => r.ranked);
  const generated = recommendations.reduce(
    (n, r) => n + r.ranked.length + r.discardedCount,
    0
  );
  return {
    intentAlignmentMean: mean(primaries.map((p) => p.intentAlignment)),
    visualImpactMean: mean(primaries.map((p) => p.visualImpact)),
    movementEfficiencyMean: mean(primaries.map((p) => p.movementEfficiency)),
    feasibilityRate: generated === 0 ? 0 : rankedAll.length / generated,
    candidateDiversity: families.size / Math.max(1, primaries.length),
  };
}

export function recommendFormationsForIntentSequence(input: {
  intents: ChoreographicIntent[];
  cues: FormationCue[];
  currentFormation: Formation;
  dancerCount: number;
  stage: StageConfig;
  bpm?: number;
  constraints?: FormationIntelligenceRequest["constraints"];
  scoreWeights?: Record<string, number>;
}): FormationIntelligenceReport {
  const cueById = new Map(input.cues.map((c) => [c.id, c]));
  const recommendations: FormationRecommendation[] = [];
  const chorusMemory: ChorusShapeMemory = new Map();
  for (let i = 0; i < input.intents.length; i += 1) {
    const intent = input.intents[i]!;
    const cue = cueById.get(intent.cueId) ?? input.cues[i];
    if (!cue) continue;
    const nextIntent = input.intents[i + 1]?.primary.intent ?? null;
    recommendations.push(
      applyChorusCallbackToRecommendation(
        recommendFormationsForIntent({
          intent,
          cue,
          currentFormation: input.currentFormation,
          dancerCount: input.dancerCount,
          stage: input.stage,
          previousIntent: intent.previousIntent,
          nextIntent,
          scoreWeights: input.scoreWeights,
          constraints: {
            ...input.constraints,
            bpm: input.constraints?.bpm ?? input.bpm,
          },
        }),
        chorusMemory
      )
    );
  }
  return {
    analysisVersion: FORMATION_INTELLIGENCE_VERSION,
    recommendations,
    metrics: summarizeFormationIntelligence(recommendations),
  };
}
