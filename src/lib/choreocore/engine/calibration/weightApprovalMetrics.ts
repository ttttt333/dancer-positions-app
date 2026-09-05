/**
 * V1 vs V2 を同じ Evaluation Dataset 全体で再生する。
 * 都合のよい subset は使わない。
 */

import { analyzeAiHumanCalibration, computeRankAgreement } from "./aiHumanCalibration";
import {
  candidateGroupKey,
  resolveCandidateOutcome,
} from "./discrepancyClassify";
import { DISCREPANCY_SCORE } from "./discrepancyConfig";
import type { HumanEvaluationRecord, HumanEvaluationStore } from "./humanEvaluationTypes";
import { scoreBreakdownWithWeights } from "./weightProposal";
import { APPROVAL_MIN_IMPROVED_METRICS } from "./weightApprovalConfig";
import type {
  MetricComparison,
  SimulationComparison,
  WeightApprovalLayer,
} from "./weightApprovalTypes";

function rescoreStore(
  store: HumanEvaluationStore,
  layer: WeightApprovalLayer,
  weights: Record<string, number>
): HumanEvaluationStore {
  const records = [...store.records]
    .sort((a, b) => a.evaluationId.localeCompare(b.evaluationId))
    .map((record) => {
      if (record.subject.kind !== layer) return record;
      return {
        ...record,
        aiScoreSnapshot: {
          ...record.aiScoreSnapshot,
          overall: scoreBreakdownWithWeights(record.aiScoreSnapshot.breakdown, weights),
        },
      };
    });
  return {
    schemaVersion: store.schemaVersion,
    records,
    pairwise: [...store.pairwise].sort((a, b) => a.pairwiseId.localeCompare(b.pairwiseId)),
  };
}

function outcomeByCandidate(records: HumanEvaluationRecord[]): Map<string, string> {
  const groups = new Map<string, HumanEvaluationRecord[]>();
  for (const record of records) {
    const key = candidateGroupKey(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  const out = new Map<string, string>();
  for (const [key, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const outcome = resolveCandidateOutcome(list);
    if (outcome) out.set(key, outcome);
    const candidateId = list[0]?.subject.candidateId;
    if (candidateId && outcome) out.set(candidateId, outcome);
  }
  return out;
}

function contextKey(record: HumanEvaluationRecord): string {
  return [
    record.subject.musicId ?? "_",
    record.subject.cueId ?? "_",
    record.subject.kind,
  ].join("|");
}

function top1OutcomeRates(
  store: HumanEvaluationStore,
  layer: WeightApprovalLayer
): {
  acceptUnchanged: number | null;
  acceptEdit: number | null;
  reject: number | null;
  formationEdit: number | null;
  transitionEdit: number | null;
  groups: number;
} {
  const records = store.records.filter((r) => r.subject.kind === layer);
  const outcomes = outcomeByCandidate(store.records);
  const groups = new Map<string, HumanEvaluationRecord[]>();
  for (const record of records) {
    const key = contextKey(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  const usable = [...groups.values()].filter((g) => g.length >= 2);
  if (usable.length === 0) {
    return {
      acceptUnchanged: null,
      acceptEdit: null,
      reject: null,
      formationEdit: null,
      transitionEdit: null,
      groups: 0,
    };
  }
  let unchanged = 0;
  let edited = 0;
  let rejected = 0;
  let formationEdit = 0;
  let transitionEdit = 0;
  for (const group of usable) {
    const ranked = [...group].sort(
      (a, b) =>
        b.aiScoreSnapshot.overall - a.aiScoreSnapshot.overall ||
        a.evaluationId.localeCompare(b.evaluationId)
    );
    const top = ranked[0]!;
    const outcome =
      outcomes.get(candidateGroupKey(top)) ?? outcomes.get(top.subject.candidateId);
    if (outcome === "ACCEPT_UNCHANGED") unchanged += 1;
    else if (outcome === "ACCEPT_EDIT") edited += 1;
    else if (outcome === "REJECT") rejected += 1;
    if (top.editSignal?.formationChanged || top.editSignal?.positionChanged) {
      formationEdit += 1;
    }
    if (top.editSignal?.pathChanged || top.editSignal?.timingChanged) {
      transitionEdit += 1;
    }
    const sibling = store.records.find(
      (r) =>
        r.subject.candidateId === top.subject.candidateId &&
        r.subject.kind !== layer &&
        (r.editSignal?.pathChanged || r.editSignal?.timingChanged)
    );
    if (sibling) transitionEdit += 1;
  }
  const n = usable.length;
  return {
    acceptUnchanged: unchanged / n,
    acceptEdit: edited / n,
    reject: rejected / n,
    formationEdit: formationEdit / n,
    transitionEdit: transitionEdit / n,
    groups: n,
  };
}

function highScoreRejectRate(store: HumanEvaluationStore, layer: WeightApprovalLayer): number | null {
  const outcomes = outcomeByCandidate(store.records);
  const scoped = store.records.filter((r) => r.subject.kind === layer);
  const seen = new Set<string>();
  let high = 0;
  let highReject = 0;
  for (const record of scoped) {
    const key = candidateGroupKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    if (record.aiScoreSnapshot.overall < DISCREPANCY_SCORE.high) continue;
    high += 1;
    if (outcomes.get(key) === "REJECT" || outcomes.get(record.subject.candidateId) === "REJECT") {
      highReject += 1;
    }
  }
  return high === 0 ? null : highReject / high;
}

function metric(
  key: string,
  v1: number | null,
  v2: number | null,
  higherIsBetter: boolean
): MetricComparison {
  if (v1 == null || v2 == null) {
    return { key, v1, v2, delta: null, direction: "unknown" };
  }
  const delta = v2 - v1;
  if (Math.abs(delta) < 1e-12) {
    return { key, v1, v2, delta: 0, direction: "unchanged" };
  }
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return { key, v1, v2, delta, direction: improved ? "improved" : "worsened" };
}

export function compareWeightVersions(input: {
  store: HumanEvaluationStore;
  layer: WeightApprovalLayer;
  v1Weights: Record<string, number>;
  v2Weights: Record<string, number>;
}): SimulationComparison {
  const v1Store = rescoreStore(input.store, input.layer, input.v1Weights);
  const v2Store = rescoreStore(input.store, input.layer, input.v2Weights);
  const v1Cal = analyzeAiHumanCalibration(v1Store);
  const v2Cal = analyzeAiHumanCalibration(v2Store);
  const v1Rank = computeRankAgreement(v1Store.records.filter((r) => r.subject.kind === input.layer));
  const v2Rank = computeRankAgreement(v2Store.records.filter((r) => r.subject.kind === input.layer));
  const v1Top = top1OutcomeRates(v1Store, input.layer);
  const v2Top = top1OutcomeRates(v2Store, input.layer);
  const metrics = [
    metric("top1Agreement", v1Rank?.top1Agreement ?? null, v2Rank?.top1Agreement ?? null, true),
    metric("top3Agreement", v1Rank?.top3Agreement ?? null, v2Rank?.top3Agreement ?? null, true),
    metric("spearman", v1Rank?.spearman ?? null, v2Rank?.spearman ?? null, true),
    metric("pairwiseAgreement", v1Cal.pairwiseAgreement, v2Cal.pairwiseAgreement, true),
    metric("highScoreRejectRate", highScoreRejectRate(v1Store, input.layer), highScoreRejectRate(v2Store, input.layer), false),
    metric("acceptUnchangedRate", v1Top.acceptUnchanged, v2Top.acceptUnchanged, true),
    metric("editRate", v1Top.acceptEdit, v2Top.acceptEdit, false),
    metric("rejectRate", v1Top.reject, v2Top.reject, false),
    metric("formationEditRate", v1Top.formationEdit, v2Top.formationEdit, false),
    metric("transitionEditRate", v1Top.transitionEdit, v2Top.transitionEdit, false),
  ];

  const improvedCount = metrics.filter((m) => m.direction === "improved").length;
  const worsenedCount = metrics.filter((m) => m.direction === "worsened").length;
  const criticalRegressions: string[] = [];
  const top1 = metrics.find((m) => m.key === "top1Agreement")!;
  if (top1.direction === "worsened") criticalRegressions.push("top1Agreement worsened");
  const otherLayerEdit =
    input.layer === "formation"
      ? metrics.find((m) => m.key === "transitionEditRate")
      : metrics.find((m) => m.key === "formationEditRate");
  if (otherLayerEdit?.direction === "worsened") {
    criticalRegressions.push(`${otherLayerEdit.key} worsened (cross-layer side effect)`);
  }

  const tradeoffs = metrics
    .filter((m) => m.direction === "worsened" && !criticalRegressions.some((c) => c.startsWith(m.key)))
    .map((m) => `${m.key} worsened (${m.v1} → ${m.v2})`);

  const overallImproved =
    improvedCount >= APPROVAL_MIN_IMPROVED_METRICS && criticalRegressions.length === 0;
  const readyForReview = overallImproved && worsenedCount === 0
    ? true
    : overallImproved && criticalRegressions.length === 0;

  const notes = [
    "Simulation uses the full evaluation dataset. No success-only subset.",
    "Numeric weight deltas are a candidate proposal, not a derived necessity.",
    `Improved metrics: ${improvedCount}. Worsened: ${worsenedCount}.`,
  ];
  if (tradeoffs.length > 0) notes.push(`Trade-offs: ${tradeoffs.join("; ")}`);
  if (!overallImproved) {
    notes.push("Slight or single-metric improvement is not enough for review.");
  }

  return {
    metrics,
    improvedCount,
    worsenedCount,
    criticalRegressions,
    tradeoffs,
    overallImproved,
    readyForReview,
    notes,
  };
}

export function detectRegression(comparison: SimulationComparison): boolean {
  return comparison.criticalRegressions.length > 0;
}
