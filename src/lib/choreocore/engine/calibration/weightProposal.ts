/**
 * Weight Proposal + offline simulation.
 * Production weights は読んでも書き換えない。
 */

import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import {
  CALIBRATION_SAMPLE,
  FORMATION_WEIGHTS_VERSION,
  TRANSITION_WEIGHTS_VERSION,
  WEIGHT_PROPOSAL_MAX_ABS,
  WEIGHT_PROPOSAL_STEP,
} from "./humanEvaluationConfig";
import { analyzeAiHumanCalibration, calibrationConfidence, computeRankAgreement } from "./aiHumanCalibration";
import type {
  AxisHypothesis,
  HumanEvaluationRecord,
  HumanEvaluationStore,
  WeightProposal,
  WeightSimulation,
} from "./humanEvaluationTypes";

export function productionFormationWeights(): Record<string, number> {
  return { ...FORMATION_INTELLIGENCE_WEIGHTS };
}

export function productionTransitionWeights(): Record<string, number> {
  return { ...TRANSITION_SCORE_WEIGHTS };
}

export function scoreBreakdownWithWeights(
  breakdown: Record<string, number>,
  weights: Record<string, number>
): number {
  const keys = Object.keys(weights).sort((a, b) => a.localeCompare(b));
  let sum = 0;
  for (const key of keys) {
    sum += (breakdown[key] ?? 0) * (weights[key] ?? 0);
  }
  return sum;
}

function renormalize(weights: Record<string, number>): Record<string, number> {
  const keys = Object.keys(weights).sort((a, b) => a.localeCompare(b));
  const total = keys.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  const denom = total > 0 ? total : 1;
  const out: Record<string, number> = {};
  for (const key of keys) out[key] = Math.max(0, weights[key] ?? 0) / denom;
  return out;
}

function applyHypotheses(
  current: Record<string, number>,
  hypotheses: AxisHypothesis[]
): { next: Record<string, number>; rationale: string[] } {
  const next = { ...current };
  const rationale: string[] = [];
  const keys = new Set(Object.keys(current));
  for (const h of hypotheses) {
    if (!keys.has(h.axis)) continue;
    const delta =
      h.direction === "over-weighted" ? -WEIGHT_PROPOSAL_STEP : WEIGHT_PROPOSAL_STEP;
    const applied = Math.max(
      -WEIGHT_PROPOSAL_MAX_ABS,
      Math.min(WEIGHT_PROPOSAL_MAX_ABS, delta)
    );
    next[h.axis] = Math.max(0.02, (next[h.axis] ?? 0) + applied);
    rationale.push(`${h.axis} ${h.direction}: ${h.evidence}`);
  }
  return { next: renormalize(next), rationale };
}

export function proposeWeightAdjustments(
  store: HumanEvaluationStore,
  layer: "formation" | "transition" = "formation"
): WeightProposal {
  const current =
    layer === "formation" ? productionFormationWeights() : productionTransitionWeights();
  const currentVersion =
    layer === "formation" ? FORMATION_WEIGHTS_VERSION : TRANSITION_WEIGHTS_VERSION;
  const scoped: HumanEvaluationStore = {
    ...store,
    records: store.records.filter((r) => r.subject.kind === layer),
  };
  const report = analyzeAiHumanCalibration(scoped);
  const empty: WeightProposal = {
    layer,
    weightsVersionCurrent: currentVersion,
    weightsVersionProposed: `${currentVersion}-unchanged`,
    current,
    proposed: { ...current },
    deltas: {},
    rationale: [
      report.confidence === "insufficient"
        ? "Insufficient sample — no weight change proposed."
        : "No axis hypothesis strong enough for a proposal.",
    ],
    sampleSize: scoped.records.length,
    confidence: report.confidence,
    autoApplied: false,
  };
  if (scoped.records.length < CALIBRATION_SAMPLE.proposalMin) return empty;
  if (report.axisHypotheses.length === 0) return empty;

  const { next, rationale } = applyHypotheses(current, report.axisHypotheses);
  const deltas: Record<string, number> = {};
  for (const key of Object.keys(current).sort((a, b) => a.localeCompare(b))) {
    const d = (next[key] ?? 0) - (current[key] ?? 0);
    if (Math.abs(d) >= 1e-9) deltas[key] = d;
  }
  return {
    layer,
    weightsVersionCurrent: currentVersion,
    weightsVersionProposed: `${currentVersion.replace(/V\d+$/, "")}V2-proposal`,
    current,
    proposed: next,
    deltas,
    rationale: [
      ...rationale,
      "Proposal is offline only. Production weights were not changed.",
    ],
    sampleSize: scoped.records.length,
    confidence: calibrationConfidence(scoped.records.length),
    autoApplied: false,
  };
}

function rescoredRecords(
  records: HumanEvaluationRecord[],
  weights: Record<string, number>
): HumanEvaluationRecord[] {
  return records.map((record) => ({
    ...record,
    aiScoreSnapshot: {
      ...record.aiScoreSnapshot,
      overall: scoreBreakdownWithWeights(record.aiScoreSnapshot.breakdown, weights),
    },
  }));
}

export function simulateWeightChange(input: {
  store: HumanEvaluationStore;
  current: Record<string, number>;
  proposed: Record<string, number>;
  weightsVersionBefore: string;
  weightsVersionAfter: string;
  layer?: "formation" | "transition";
}): WeightSimulation {
  const layer = input.layer ?? "formation";
  const records = input.store.records.filter((r) => r.subject.kind === layer);
  const before =
    computeRankAgreement(rescoredRecords(records, input.current)) ?? {
      groups: 0,
      top1Agreement: 0,
      top3Agreement: 0,
      spearman: 0,
    };
  const after =
    computeRankAgreement(rescoredRecords(records, input.proposed)) ?? {
      groups: 0,
      top1Agreement: 0,
      top3Agreement: 0,
      spearman: 0,
    };
  const improved =
    after.top1Agreement > before.top1Agreement ||
    (after.top1Agreement === before.top1Agreement && after.spearman > before.spearman);
  return {
    weightsVersionBefore: input.weightsVersionBefore,
    weightsVersionAfter: input.weightsVersionAfter,
    before,
    after,
    improved,
    autoApplied: false,
  };
}
