import type { HumanEditSignal, HumanEvaluationRecord } from "./humanEvaluationTypes";
import { DISCREPANCY_CONFIDENCE, DISCREPANCY_SCORE } from "./discrepancyConfig";
import type {
  CandidateOutcomeKind,
  CoreDiscrepancyPattern,
  DiscrepancyCategory,
  DiscrepancyConfidence,
  LikelyLayer,
} from "./discrepancyTypes";

export function discrepancyConfidence(sampleSize: number): DiscrepancyConfidence {
  if (sampleSize <= DISCREPANCY_CONFIDENCE.insufficientMax) return "insufficient";
  if (sampleSize <= DISCREPANCY_CONFIDENCE.lowMax) return "low";
  if (sampleSize <= DISCREPANCY_CONFIDENCE.mediumMax) return "medium";
  return "high";
}

export function emptyEditSignal(): HumanEditSignal {
  return {
    positionChanged: false,
    formationChanged: false,
    assignmentChanged: false,
    pathChanged: false,
    timingChanged: false,
  };
}

export function mergeEditSignals(signals: HumanEditSignal[]): HumanEditSignal {
  const out = emptyEditSignal();
  for (const signal of signals) {
    if (signal.positionChanged) out.positionChanged = true;
    if (signal.formationChanged) out.formationChanged = true;
    if (signal.assignmentChanged) out.assignmentChanged = true;
    if (signal.pathChanged) out.pathChanged = true;
    if (signal.timingChanged) out.timingChanged = true;
  }
  return out;
}

export function hasSemanticEdit(signal: HumanEditSignal): boolean {
  return Boolean(
    signal.positionChanged ||
      signal.formationChanged ||
      signal.assignmentChanged ||
      signal.pathChanged ||
      signal.timingChanged
  );
}

export function isHighAiScore(score: number): boolean {
  return score >= DISCREPANCY_SCORE.high;
}

export function isLowAiScore(score: number): boolean {
  return score <= DISCREPANCY_SCORE.low;
}

export function categoriesFromEditSignal(signal: HumanEditSignal): DiscrepancyCategory[] {
  const categories: DiscrepancyCategory[] = [];
  if (signal.formationChanged) categories.push("FORMATION_SELECTION");
  if (signal.positionChanged && !signal.formationChanged) {
    categories.push("FORMATION_GEOMETRY");
  }
  if (signal.assignmentChanged) categories.push("ASSIGNMENT");
  if (signal.pathChanged) categories.push("TRANSITION_PATH");
  if (signal.timingChanged) {
    categories.push(signal.pathChanged ? "TRANSITION_TIMING" : "MUSIC_TIMING");
  }
  return categories;
}

export function categoriesForOutcome(
  outcome: CandidateOutcomeKind,
  signal: HumanEditSignal
): DiscrepancyCategory[] {
  if (outcome === "ACCEPT_UNCHANGED") return [];
  if (outcome === "REJECT" && !hasSemanticEdit(signal)) return ["UNKNOWN"];
  const fromEdit = categoriesFromEditSignal(signal);
  if (fromEdit.length > 0) return fromEdit;
  if (outcome === "REJECT") return ["GENERAL_PREFERENCE"];
  return ["UNKNOWN"];
}

export function likelyLayerForCategory(category: DiscrepancyCategory): LikelyLayer {
  if (category === "MUSIC_TIMING") return "music_cue";
  if (category === "INTENT_MISMATCH") return "intent";
  if (
    category === "FORMATION_SELECTION" ||
    category === "FORMATION_GEOMETRY" ||
    category === "ASSIGNMENT"
  ) {
    return "formation";
  }
  if (category === "TRANSITION_PATH" || category === "TRANSITION_TIMING") {
    return "transition";
  }
  return "unknown";
}

export function patternsForOutcome(
  outcome: CandidateOutcomeKind,
  aiScore: number
): CoreDiscrepancyPattern[] {
  const patterns: CoreDiscrepancyPattern[] = [];
  if (outcome === "ACCEPT_UNCHANGED") patterns.push("ACCEPT_UNCHANGED");
  if (outcome === "ACCEPT_EDIT") patterns.push("ACCEPT_EDIT");
  if (outcome === "REJECT" && isHighAiScore(aiScore)) patterns.push("HIGH_SCORE_REJECT");
  if (
    (outcome === "ACCEPT_UNCHANGED" || outcome === "ACCEPT_EDIT") &&
    isLowAiScore(aiScore)
  ) {
    patterns.push("LOW_SCORE_ACCEPT");
  }
  return patterns;
}

export function candidateGroupKey(record: HumanEvaluationRecord): string {
  return `${record.subject.candidateId}|${record.subject.cueId ?? ""}`;
}

export function resolveCandidateOutcome(
  records: HumanEvaluationRecord[]
): CandidateOutcomeKind | null {
  const sorted = [...records].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.evaluationId.localeCompare(b.evaluationId)
  );
  let lastExplicit: "accept" | "reject" | null = null;
  const signal = mergeEditSignals(
    sorted.map((r) => r.editSignal ?? emptyEditSignal())
  );
  for (const record of sorted) {
    if (record.decision === "accept" || record.decision === "reject") {
      lastExplicit = record.decision;
    }
  }
  const edited = hasSemanticEdit(signal) || sorted.some((r) => r.decision === "edit");
  if (lastExplicit === "reject") return "REJECT";
  if (lastExplicit === "accept") return edited ? "ACCEPT_EDIT" : "ACCEPT_UNCHANGED";
  if (edited) return "ACCEPT_EDIT";
  return null;
}
