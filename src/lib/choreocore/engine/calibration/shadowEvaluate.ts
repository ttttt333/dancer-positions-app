/**
 * Stage 12: 承認済み V2 を Shadow で観測する。
 * Production 結果は V1 のまま。V2 失敗でも V1 は継続する。
 */

import {
  candidateGroupKey,
  discrepancyConfidence,
  resolveCandidateOutcome,
} from "./discrepancyClassify";
import type { CandidateOutcomeKind } from "./discrepancyTypes";
import type { HumanEvaluationRecord, HumanEvaluationStore } from "./humanEvaluationTypes";
import { scoreBreakdownWithWeights } from "./weightProposal";
import { versionsCompatible } from "./weightApprovalGate";
import type { WeightApprovalLayer, WeightApprovalPackage } from "./weightApprovalTypes";
import { SHADOW_EVALUATION_VERSION, SHADOW_MIN_SAMPLE, SHADOW_TOP_K } from "./shadowConfig";
import type {
  ShadowComparison,
  ShadowDiscrepancyKind,
  ShadowEvaluation,
  ShadowObservational,
  ShadowReport,
  ShadowStatus,
} from "./shadowTypes";

export type ShadowEvaluateOptions = {
  forceShadowError?: boolean;
  extraShadowCandidateIds?: Record<string, string[]>;
};

function contextKey(record: HumanEvaluationRecord, layer: WeightApprovalLayer): string {
  return [record.subject.musicId ?? "_", record.subject.cueId ?? "_", layer].join("|");
}

function firstRecord(records: HumanEvaluationRecord[]): HumanEvaluationRecord {
  return [...records].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.evaluationId.localeCompare(b.evaluationId)
  )[0]!;
}

function humanOutcomes(store: HumanEvaluationStore): Map<string, CandidateOutcomeKind> {
  const groups = new Map<string, HumanEvaluationRecord[]>();
  for (const record of store.records) {
    const key = candidateGroupKey(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  const out = new Map<string, CandidateOutcomeKind>();
  for (const [key, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const outcome = resolveCandidateOutcome(list);
    if (!outcome) continue;
    out.set(key, outcome);
    const id = list[0]?.subject.candidateId;
    if (id) out.set(id, outcome);
  }
  return out;
}

function rankIds(rows: Array<{ id: string; score: number; tie: string }>): string[] {
  return [...rows]
    .sort((a, b) => b.score - a.score || a.tie.localeCompare(b.tie))
    .map((row) => row.id);
}

function setChanged(a: string[], b: string[]): boolean {
  const left = [...a].sort((x, y) => x.localeCompare(y)).join("|");
  const right = [...b].sort((x, y) => x.localeCompare(y)).join("|");
  return left !== right;
}

function emptyUnavailable(pkg: WeightApprovalPackage, reason: string): ShadowReport {
  return {
    analysisVersion: SHADOW_EVALUATION_VERSION,
    layer: pkg.layer,
    status: "UNAVAILABLE",
    confidence: "insufficient",
    autoPromoted: false,
    productionWeightsVersion: pkg.versions.weightsVersionCurrent,
    shadowWeightsVersion: pkg.versions.weightsVersionProposed,
    versions: { ...pkg.versions },
    sampleSize: 0,
    contextCount: 0,
    evaluations: [],
    comparisons: [],
    observational: {
      v1Top1AcceptUnchanged: 0,
      v2Top1AcceptUnchanged: 0,
      v1Top1Reject: 0,
      v2Top1Reject: 0,
      comparableGroups: 0,
    },
    observed: [reason],
    hypothesis: [],
    notes: [
      "Shadow is unavailable. Production V1 is unchanged.",
      "V2 was not applied and was not shown.",
    ],
  };
}

function scoreV2(
  record: HumanEvaluationRecord,
  weights: Record<string, number>,
  forceError: boolean
): number {
  if (forceError) throw new Error("shadow-forced-error");
  return scoreBreakdownWithWeights(record.aiScoreSnapshot.breakdown, weights);
}

function decideStatus(
  sampleSize: number,
  observational: ShadowObservational,
  comparisons: ShadowComparison[]
): ShadowStatus {
  if (sampleSize < SHADOW_MIN_SAMPLE) return "INSUFFICIENT";
  const top1Worse =
    observational.comparableGroups > 0 &&
    observational.v2Top1Reject > observational.v1Top1Reject &&
    observational.v2Top1AcceptUnchanged < observational.v1Top1AcceptUnchanged;
  if (top1Worse) return "REGRESSION";
  const promising =
    observational.v2Top1AcceptUnchanged > observational.v1Top1AcceptUnchanged &&
    observational.v2Top1Reject <= observational.v1Top1Reject;
  if (promising) return "PROMISING";
  if (comparisons.some((c) => c.top1Changed || c.candidateSetChanged)) return "HOLD";
  return "HOLD";
}

export function evaluateApprovedShadow(
  store: HumanEvaluationStore,
  pkg: WeightApprovalPackage,
  options: ShadowEvaluateOptions = {}
): ShadowReport {
  if (pkg.status !== "APPROVED" || pkg.applied !== false || pkg.autoApplied !== false) {
    return emptyUnavailable(pkg, "Only Stage 11 APPROVED proposals may enter Shadow.");
  }
  if (pkg.disabled || Object.keys(pkg.proposal.deltas).length === 0) {
    return emptyUnavailable(pkg, "Approved proposal has no shadowable weight deltas.");
  }
  if (!versionsCompatible(pkg, store)) {
    return emptyUnavailable(pkg, "Version mismatch — shadow evaluation disabled.");
  }

  const outcomes = humanOutcomes(store);
  const scoped = store.records
    .filter((r) => r.subject.kind === pkg.layer)
    .sort((a, b) => a.evaluationId.localeCompare(b.evaluationId));
  const groups = new Map<string, HumanEvaluationRecord[]>();
  for (const record of scoped) {
    const key = contextKey(record, pkg.layer);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }

  const evaluations: ShadowEvaluation[] = [];
  const comparisons: ShadowComparison[] = [];
  let shadowFailed = false;

  for (const key of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
    const records = groups.get(key)!;
    const v1Rows = records.map((record) => ({
      id: record.subject.candidateId,
      score: record.aiScoreSnapshot.overall,
      tie: record.evaluationId,
    }));
    let v2Rows: Array<{ id: string; score: number; tie: string }> = [];
    try {
      v2Rows = records.map((record) => ({
        id: record.subject.candidateId,
        score: scoreV2(record, pkg.proposal.proposed, Boolean(options.forceShadowError)),
        tie: record.evaluationId,
      }));
    } catch {
      shadowFailed = true;
      v2Rows = [];
    }
    const extra = options.extraShadowCandidateIds?.[key] ?? [];
    for (const id of extra) {
      if (!v2Rows.some((row) => row.id === id)) {
        v2Rows.push({ id, score: -1, tie: id });
      }
    }
    const v1Ranking = rankIds(v1Rows);
    const v2Ranking = v2Rows.length === 0 ? [] : rankIds(v2Rows);
    const v1Top = v1Ranking.slice(0, SHADOW_TOP_K);
    const v2Top = v2Ranking.slice(0, SHADOW_TOP_K);
    const candidateSetChanged = v2Ranking.length === 0 ? false : setChanged(v1Top, v2Top);
    const rankingChanged = v2Ranking.length === 0 ? false : v1Ranking.join("|") !== v2Ranking.join("|");
    const top1Changed =
      v2Ranking.length === 0 ? false : (v1Ranking[0] ?? null) !== (v2Ranking[0] ?? null);
    const groupOutcome =
      outcomes.get(candidateGroupKey(firstRecord(records))) ??
      outcomes.get(firstRecord(records).subject.candidateId);
    const categories: ShadowDiscrepancyKind[] = [];
    if (rankingChanged) categories.push("RANK_CHANGED");
    if (top1Changed) categories.push("TOP1_CHANGED");
    if (candidateSetChanged) categories.push("CANDIDATE_SET_CHANGED");
    if (
      v2Rows.length > 0 &&
      records.some((record) => {
        const v1 = v1Rows.find((row) => row.id === record.subject.candidateId);
        const v2 = v2Rows.find((row) => row.id === record.subject.candidateId);
        return v1 && v2 && Math.abs(v2.score - v1.score) > 1e-12;
      })
    ) {
      categories.push("SCORE_SHIFTED");
    }

    comparisons.push({
      contextKey: key,
      layer: pkg.layer,
      v1Top1: v1Ranking[0] ?? null,
      v2Top1: v2Ranking[0] ?? null,
      v1Ranking,
      v2Ranking,
      candidateSetChanged,
      rankingChanged,
      top1Changed,
      productionHumanOutcome: groupOutcome,
      categories,
    });

    const v1Rank = new Map(v1Ranking.map((id, i) => [id, i + 1]));
    const v2Rank = new Map(v2Ranking.map((id, i) => [id, i + 1]));
    for (const record of records) {
      const id = record.subject.candidateId;
      const v1 = v1Rows.find((row) => row.id === id)!;
      const v2 = v2Rows.find((row) => row.id === id);
      const scoreDelta = v2 ? v2.score - v1.score : null;
      evaluations.push({
        evaluationId: `shd-${pkg.layer}-${record.evaluationId}`,
        candidateId: id,
        contextKey: key,
        layer: pkg.layer,
        production: {
          score: v1.score,
          rank: v1Rank.get(id) ?? 0,
          weightsVersion: pkg.versions.weightsVersionCurrent,
        },
        shadow: {
          score: v2?.score ?? v1.score,
          rank: v2Rank.get(id) ?? 0,
          weightsVersion: pkg.versions.weightsVersionProposed,
          unavailable: v2 == null,
        },
        scoreDelta,
        rankDelta: v2 ? (v2Rank.get(id) ?? 0) - (v1Rank.get(id) ?? 0) : null,
        productionHumanOutcome: outcomes.get(candidateGroupKey(record)) ?? outcomes.get(id),
        counterfactual: "unknown",
        createdAt: record.createdAt,
      });
    }
  }

  const observational: ShadowObservational = {
    v1Top1AcceptUnchanged: 0,
    v2Top1AcceptUnchanged: 0,
    v1Top1Reject: 0,
    v2Top1Reject: 0,
    comparableGroups: 0,
  };
  for (const cmp of comparisons) {
    const accepted = evaluations.find(
      (e) =>
        e.contextKey === cmp.contextKey && e.productionHumanOutcome === "ACCEPT_UNCHANGED"
    );
    const rejectedTop = evaluations.find(
      (e) => e.contextKey === cmp.contextKey && e.candidateId === cmp.v1Top1
    );
    if (!cmp.v1Top1) continue;
    observational.comparableGroups += 1;
    if (accepted) {
      if (cmp.v1Top1 === accepted.candidateId) observational.v1Top1AcceptUnchanged += 1;
      if (cmp.v2Top1 === accepted.candidateId) observational.v2Top1AcceptUnchanged += 1;
    }
    if (rejectedTop?.productionHumanOutcome === "REJECT") {
      observational.v1Top1Reject += 1;
      if (cmp.v2Top1 === rejectedTop.candidateId) observational.v2Top1Reject += 1;
    }
  }

  const uniqueCandidates = new Set(evaluations.map((e) => e.candidateId)).size;
  const status = shadowFailed
    ? "UNAVAILABLE"
    : decideStatus(uniqueCandidates, observational, comparisons);
  const layerCounts = {
    top1Changed: comparisons.filter((c) => c.top1Changed).length,
    setChanged: comparisons.filter((c) => c.candidateSetChanged).length,
  };

  return {
    analysisVersion: SHADOW_EVALUATION_VERSION,
    layer: pkg.layer,
    status,
    confidence: discrepancyConfidence(uniqueCandidates),
    autoPromoted: false,
    productionWeightsVersion: pkg.versions.weightsVersionCurrent,
    shadowWeightsVersion: pkg.versions.weightsVersionProposed,
    versions: { ...pkg.versions },
    sampleSize: uniqueCandidates,
    contextCount: comparisons.length,
    evaluations,
    comparisons,
    observational,
    ...(pkg.layer === "formation"
      ? { formation: layerCounts }
      : { transition: layerCounts }),
    observed: [
      `contexts=${comparisons.length}`,
      `top1Changed=${layerCounts.top1Changed}`,
      `candidateSetChanged=${layerCounts.setChanged}`,
      `shadowFailed=${shadowFailed}`,
      "Human actions are production V1 outcomes. V2 was not shown.",
    ],
    hypothesis: shadowFailed
      ? ["Shadow scorer failed. No hypothesis about V2 quality is warranted."]
      : [
          "Rank or set differences are predicted shadow differences, not human choices of V2.",
          "If V2 top-1 later matches an edit, that is observational overlap only.",
        ],
    notes: [
      "Production remains V1. Shadow cannot mutate editor, project, or weights.",
      "Counterfactual human choice under a different display is unknown.",
      "No automatic promotion to production.",
      shadowFailed ? "V2 throw isolated. V1 rankings were still produced." : "Shadow completed.",
    ],
  };
}

export function productionRankings(store: HumanEvaluationStore, layer: WeightApprovalLayer): string[] {
  return store.records
    .filter((r) => r.subject.kind === layer)
    .sort(
      (a, b) =>
        b.aiScoreSnapshot.overall - a.aiScoreSnapshot.overall ||
        a.evaluationId.localeCompare(b.evaluationId)
    )
    .map((r) => r.subject.candidateId);
}
