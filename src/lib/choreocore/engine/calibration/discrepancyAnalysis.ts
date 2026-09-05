/**
 * Stage 10: Evaluation Dataset から AI vs Human のズレを観測する。
 * Production weights / algorithms は読んでも書き換えない。
 */

import { HUMAN_EVALUATION_VERSION } from "./humanEvaluationConfig";
import { HUMAN_FEEDBACK_VERSION } from "./humanFeedbackConfig";
import {
  analyzeAiHumanCalibration,
  computeRankAgreement,
} from "./aiHumanCalibration";
import {
  proposeWeightAdjustments,
  simulateWeightChange,
} from "./weightProposal";
import type {
  HumanEditSignal,
  HumanEvaluationRecord,
  HumanEvaluationStore,
} from "./humanEvaluationTypes";
import {
  AI_SCORE_BUCKETS,
  DISCREPANCY_ANALYSIS_VERSION,
  DISCREPANCY_MIN_SAMPLE,
  DISCREPANCY_TOP_N,
} from "./discrepancyConfig";
import {
  candidateGroupKey,
  categoriesForOutcome,
  discrepancyConfidence,
  emptyEditSignal,
  isHighAiScore,
  likelyLayerForCategory,
  mergeEditSignals,
  patternsForOutcome,
  resolveCandidateOutcome,
} from "./discrepancyClassify";
import type {
  CandidateOutcome,
  DiscrepancyCategory,
  DiscrepancyFinding,
  DiscrepancyReport,
  EditRateBreakdown,
  LayerShare,
  LikelyLayer,
  PairwiseMismatch,
  RateStat,
  ScoreBucketStat,
  SegmentStat,
} from "./discrepancyTypes";

function rateStat(count: number, total: number): RateStat {
  return {
    count,
    total,
    rate: total === 0 ? null : count / total,
    sampleSize: total,
    confidence: discrepancyConfidence(total),
  };
}

function firstSnapshot(records: HumanEvaluationRecord[]): HumanEvaluationRecord {
  return [...records].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.evaluationId.localeCompare(b.evaluationId)
  )[0]!;
}

function outcomeFromGroup(records: HumanEvaluationRecord[]): CandidateOutcome | null {
  const outcome = resolveCandidateOutcome(records);
  if (!outcome) return null;
  const first = firstSnapshot(records);
  const signal = mergeEditSignals(records.map((r) => r.editSignal ?? emptyEditSignal()));
  const categories = categoriesForOutcome(outcome, signal);
  const layers = [...new Set(categories.map(likelyLayerForCategory))].sort((a, b) =>
    a.localeCompare(b)
  );
  return {
    candidateId: first.subject.candidateId,
    cueId: first.subject.cueId,
    musicId: first.subject.musicId,
    intent: first.subject.intent,
    formationType: first.subject.formationType,
    pathKind: records.find((r) => r.subject.pathKind)?.subject.pathKind ?? first.subject.pathKind,
    dancerCount: first.subject.dancerCount,
    outcome,
    patterns: patternsForOutcome(outcome, first.aiScoreSnapshot.overall),
    categories,
    likelyLayers: layers,
    editSignal: signal,
    aiScore: first.aiScoreSnapshot.overall,
    weightsVersion: first.aiScoreSnapshot.weightsVersion,
  };
}

function groupCandidates(records: HumanEvaluationRecord[]): CandidateOutcome[] {
  const groups = new Map<string, HumanEvaluationRecord[]>();
  for (const record of records) {
    const key = candidateGroupKey(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  const out: CandidateOutcome[] = [];
  for (const key of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
    const next = outcomeFromGroup(groups.get(key)!);
    if (next) out.push(next);
  }
  return out;
}

function segmentStats(
  candidates: CandidateOutcome[],
  keyOf: (c: CandidateOutcome) => string | undefined
): SegmentStat[] {
  const buckets = new Map<string, CandidateOutcome[]>();
  for (const candidate of candidates) {
    const key = keyOf(candidate);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(candidate);
    buckets.set(key, list);
  }
  return [...buckets.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const rows = buckets.get(key)!;
      const n = rows.length;
      return {
        key,
        sampleSize: n,
        acceptUnchangedRate: n === 0 ? null : rows.filter((r) => r.outcome === "ACCEPT_UNCHANGED").length / n,
        acceptEditRate: n === 0 ? null : rows.filter((r) => r.outcome === "ACCEPT_EDIT").length / n,
        rejectRate: n === 0 ? null : rows.filter((r) => r.outcome === "REJECT").length / n,
        confidence: discrepancyConfidence(n),
      };
    });
}

function editRates(accepted: CandidateOutcome[]): EditRateBreakdown {
  const n = accepted.length;
  const count = (pred: (s: HumanEditSignal) => boolean) =>
    accepted.filter((c) => pred(c.editSignal)).length;
  return {
    formation: rateStat(count((s) => Boolean(s.formationChanged)), n),
    position: rateStat(count((s) => Boolean(s.positionChanged)), n),
    assignment: rateStat(count((s) => Boolean(s.assignmentChanged)), n),
    path: rateStat(count((s) => Boolean(s.pathChanged)), n),
    timing: rateStat(count((s) => Boolean(s.timingChanged)), n),
  };
}

function scoreBuckets(candidates: CandidateOutcome[]): ScoreBucketStat[] {
  return AI_SCORE_BUCKETS.map((bucket) => {
    const rows = candidates.filter(
      (c) => c.aiScore >= bucket.min && c.aiScore < bucket.max
    );
    const n = rows.length;
    return {
      bucket: bucket.id,
      sampleSize: n,
      rejectRate: n === 0 ? null : rows.filter((r) => r.outcome === "REJECT").length / n,
      acceptUnchangedRate:
        n === 0 ? null : rows.filter((r) => r.outcome === "ACCEPT_UNCHANGED").length / n,
      acceptEditRate: n === 0 ? null : rows.filter((r) => r.outcome === "ACCEPT_EDIT").length / n,
      confidence: discrepancyConfidence(n),
    };
  });
}

function pairwiseMismatches(store: HumanEvaluationStore): PairwiseMismatch[] {
  const byId = new Map(store.records.map((r) => [r.subject.candidateId, r]));
  const out: PairwiseMismatch[] = [];
  for (const pair of [...store.pairwise].sort((a, b) => a.pairwiseId.localeCompare(b.pairwiseId))) {
    const a = byId.get(pair.candidateAId);
    const b = byId.get(pair.candidateBId);
    if (!a || !b) continue;
    const ai =
      a.aiScoreSnapshot.overall === b.aiScoreSnapshot.overall
        ? "EQUAL"
        : a.aiScoreSnapshot.overall > b.aiScoreSnapshot.overall
          ? "A"
          : "B";
    if (ai === pair.preference) continue;
    out.push({
      pairwiseId: pair.pairwiseId,
      candidateAId: pair.candidateAId,
      candidateBId: pair.candidateBId,
      human: pair.preference,
      ai,
    });
  }
  return out;
}

function findingObserved(
  category: DiscrepancyCategory,
  rows: CandidateOutcome[],
  rate: number | null
): string[] {
  const pct = rate == null ? "n/a" : `${(rate * 100).toFixed(1)}%`;
  const families = [...new Set(rows.map((r) => r.formationType).filter(Boolean))].sort();
  const intents = [...new Set(rows.map((r) => r.intent).filter(Boolean))].sort();
  const observed = [`n=${rows.length}`, `rate=${pct}`];
  if (category === "FORMATION_SELECTION" && families.length > 0) {
    observed.push(`formation families: ${families.join(", ")}`);
  }
  if (intents.length > 0) observed.push(`intents: ${intents.join(", ")}`);
  if (category === "TRANSITION_PATH") {
    observed.push("formation may be unchanged while path was edited");
  }
  if (category === "MUSIC_TIMING") {
    observed.push("timing changed while treating formation/path as separate signals");
  }
  if (category === "UNKNOWN") {
    observed.push("reject recorded without an edit signal; reason was not inferred");
  }
  return observed;
}

function findingHypothesis(category: DiscrepancyCategory): string[] {
  if (category === "FORMATION_SELECTION") {
    return [
      "Formation Intelligence may over-prefer a shape family that humans later replace.",
      "This is not proof that the original candidate was wrong.",
    ];
  }
  if (category === "FORMATION_GEOMETRY") {
    return [
      "Position edits may be micro-adjustments, stage conditions, or dancer-specific needs.",
      "Do not treat a single-dancer move as a failed formation candidate.",
    ];
  }
  if (category === "ASSIGNMENT") {
    return ["Assignment / swap edits may reflect role preference rather than shape quality."];
  }
  if (category === "TRANSITION_PATH") {
    return ["Motion Intelligence path choice may diverge from human path preference."];
  }
  if (category === "TRANSITION_TIMING" || category === "MUSIC_TIMING") {
    return ["Cue timing or available transition duration may be the weaker layer, not formation."];
  }
  if (category === "INTENT_MISMATCH") {
    return ["Intent selection may be sending Formation Intelligence into the wrong candidate pool."];
  }
  if (category === "GENERAL_PREFERENCE") {
    return ["Human reject without edit may be taste, context, or unobserved constraints."];
  }
  return ["Insufficient signal to attribute a layer. Leave as unknown."];
}

function buildFindings(candidates: CandidateOutcome[]): DiscrepancyFinding[] {
  const byCategory = new Map<DiscrepancyCategory, CandidateOutcome[]>();
  for (const candidate of candidates) {
    for (const category of candidate.categories) {
      const list = byCategory.get(category) ?? [];
      list.push(candidate);
      byCategory.set(category, list);
    }
  }
  const intentWeak = segmentStats(candidates, (c) => c.intent).filter((s) => {
    if (s.sampleSize < DISCREPANCY_MIN_SAMPLE) return false;
    return (s.acceptUnchangedRate ?? 1) < 0.45 && (s.acceptEditRate ?? 0) + (s.rejectRate ?? 0) >= 0.4;
  });
  if (intentWeak.length > 0) {
    const rows = candidates.filter((c) => intentWeak.some((s) => s.key === c.intent));
    byCategory.set("INTENT_MISMATCH", rows);
  }

  const findings: DiscrepancyFinding[] = [];
  for (const category of [...byCategory.keys()].sort((a, b) => a.localeCompare(b))) {
    const rows = byCategory.get(category)!;
    const n = rows.length;
    findings.push({
      category,
      likelyLayer: likelyLayerForCategory(category),
      sampleSize: n,
      rate: candidates.length === 0 ? null : n / candidates.length,
      confidence: discrepancyConfidence(n),
      observed: findingObserved(category, rows, candidates.length === 0 ? null : n / candidates.length),
      hypothesis: findingHypothesis(category),
    });
  }
  return findings.sort(
    (a, b) =>
      (b.rate ?? -1) - (a.rate ?? -1) ||
      b.sampleSize - a.sampleSize ||
      a.category.localeCompare(b.category)
  );
}

function layerShares(candidates: CandidateOutcome[]): LayerShare[] {
  const layers: LikelyLayer[] = ["music_cue", "intent", "formation", "transition", "unknown"];
  const discrepant = candidates.filter((c) => c.outcome !== "ACCEPT_UNCHANGED");
  const n = discrepant.length;
  return layers.map((layer) => {
    const count = discrepant.filter((c) => c.likelyLayers.includes(layer)).length;
    return {
      layer,
      count,
      rate: n === 0 ? null : count / n,
    };
  });
}

function dominantWeightsVersion(candidates: CandidateOutcome[]): string {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.weightsVersion, (counts.get(candidate.weightsVersion) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )[0]?.[0] ?? "unknown";
}

function proposalEvidence(reportLike: {
  patterns: DiscrepancyReport["patterns"];
  findings: DiscrepancyFinding[];
}): string[] {
  const lines: string[] = [];
  const high = reportLike.patterns.highScoreReject;
  if (high.rate != null) {
    lines.push(
      `Evidence: high-score reject n=${high.count}/${high.total} (${(high.rate * 100).toFixed(1)}%)`
    );
  }
  for (const finding of reportLike.findings.slice(0, DISCREPANCY_TOP_N)) {
    lines.push(
      `Potential issue: ${finding.category} → ${finding.likelyLayer} (n=${finding.sampleSize}, ${finding.confidence})`
    );
  }
  lines.push("Discrepancy evidence is observational. Weights were not changed.");
  return lines;
}

export function analyzeDiscrepancy(store: HumanEvaluationStore): DiscrepancyReport {
  const records = [...store.records].sort((a, b) => a.evaluationId.localeCompare(b.evaluationId));
  const candidates = groupCandidates(records);
  const presented = candidates.length;
  const acceptUnchanged = candidates.filter((c) => c.outcome === "ACCEPT_UNCHANGED");
  const acceptEdit = candidates.filter((c) => c.outcome === "ACCEPT_EDIT");
  const rejected = candidates.filter((c) => c.outcome === "REJECT");
  const accepted = [...acceptUnchanged, ...acceptEdit];
  const highScoreReject = candidates.filter((c) => c.patterns.includes("HIGH_SCORE_REJECT"));
  const lowScoreAccept = candidates.filter((c) => c.patterns.includes("LOW_SCORE_ACCEPT"));
  const highScore = candidates.filter((c) => isHighAiScore(c.aiScore));
  const highScoreUnchanged = highScore.filter((c) => c.outcome === "ACCEPT_UNCHANGED");
  const findings = buildFindings(candidates);
  const calibration = analyzeAiHumanCalibration(store);
  const mismatches = pairwiseMismatches(store);
  const pairwiseN = store.pairwise.filter((p) =>
    records.some((r) => r.subject.candidateId === p.candidateAId) &&
    records.some((r) => r.subject.candidateId === p.candidateBId)
  ).length;
  const formationProposal = proposeWeightAdjustments(store, "formation");
  const transitionProposal = proposeWeightAdjustments(store, "transition");
  const evidence = proposalEvidence({
    patterns: {
      highScoreReject: rateStat(highScoreReject.length, presented),
      lowScoreAccept: rateStat(lowScoreAccept.length, presented),
      acceptEdit: rateStat(acceptEdit.length, presented),
      acceptUnchanged: rateStat(acceptUnchanged.length, presented),
    },
    findings,
  });
  formationProposal.rationale = [...formationProposal.rationale, ...evidence];
  transitionProposal.rationale = [...transitionProposal.rationale, ...evidence];
  const simulation =
    Object.keys(formationProposal.deltas).length === 0
      ? null
      : simulateWeightChange({
          store,
          current: formationProposal.current,
          proposed: formationProposal.proposed,
          weightsVersionBefore: formationProposal.weightsVersionCurrent,
          weightsVersionAfter: formationProposal.weightsVersionProposed,
          layer: "formation",
        });

  const notes = [
    "Observed disagreement is not treated as AI failure or human ground truth.",
    "Observations and hypotheses are stored separately.",
    "Production weights and algorithms were not changed.",
    presented < DISCREPANCY_MIN_SAMPLE
      ? "Sample size is below the discrepancy claim threshold; treat findings as insufficient."
      : "Sample-size guardrails applied per segment and finding.",
  ];

  return {
    analysisVersion: DISCREPANCY_ANALYSIS_VERSION,
    datasetVersion: store.schemaVersion,
    algorithmVersion: HUMAN_FEEDBACK_VERSION,
    weightsVersion: dominantWeightsVersion(candidates),
    sampleSize: records.length,
    candidateCount: presented,
    pairwiseCount: store.pairwise.length,
    confidence: discrepancyConfidence(presented),
    calibrationConfidence: calibration.confidence,
    autoApplied: false,
    overall: {
      acceptUnchanged: rateStat(acceptUnchanged.length, presented),
      acceptEdit: rateStat(acceptEdit.length, presented),
      reject: rateStat(rejected.length, presented),
    },
    patterns: {
      highScoreReject: rateStat(highScoreReject.length, presented),
      lowScoreAccept: rateStat(lowScoreAccept.length, presented),
      acceptEdit: rateStat(acceptEdit.length, presented),
      acceptUnchanged: rateStat(acceptUnchanged.length, presented),
    },
    editRates: editRates(accepted),
    scoreBuckets: scoreBuckets(candidates),
    byIntent: segmentStats(candidates, (c) => c.intent),
    byFormation: segmentStats(candidates, (c) => c.formationType),
    byTransition: segmentStats(candidates, (c) => c.pathKind),
    byDancerCount: segmentStats(candidates, (c) =>
      c.dancerCount == null ? undefined : String(c.dancerCount)
    ),
    layerAttribution: layerShares(candidates),
    findings,
    positiveEvidence: {
      highScoreAcceptUnchanged: rateStat(highScoreUnchanged.length, highScore.length),
      observed:
        highScoreUnchanged.length === 0
          ? ["No high-score accept-unchanged cases in this dataset."]
          : [
              `High AI score + accept unchanged: ${highScoreUnchanged.length}/${highScore.length}`,
              "This is a positive agreement signal, not a discrepancy.",
            ],
    },
    rankAgreement: computeRankAgreement(records),
    pairwiseDisagreementRate:
      pairwiseN === 0 ? null : mismatches.length / pairwiseN,
    pairwiseMismatches: mismatches,
    weightProposals: {
      formation: formationProposal,
      transition: transitionProposal,
      simulation,
    },
    notes,
  };
}

export function analyzeDiscrepancyFromRecords(
  records: HumanEvaluationRecord[]
): DiscrepancyReport {
  return analyzeDiscrepancy({
    schemaVersion: HUMAN_EVALUATION_VERSION,
    records,
    pairwise: [],
  });
}
