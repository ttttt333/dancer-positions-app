import { FORMATION_CANARY_HEALTH_HEURISTICS, FORMATION_CANARY_VERSION } from "./formationCanaryConfig";
import type {
  CanaryHealthReport,
  FormationCanaryActivation,
  FormationCanaryMetrics,
  FormationCanaryObservation,
  FormationCanarySafetyEvent,
  FormationCanarySafetyMetrics,
} from "./formationCanaryTypes";

function rate(count: number, total: number): number | null {
  return total === 0 ? null : count / total;
}

export function computeFormationCanaryMetrics(
  rows: FormationCanaryObservation[]
): FormationCanaryMetrics {
  const scoped = [...rows]
    .filter((row) => row.arm === "V2" || row.activeVersion === "V2" || row.arm === "V1")
    .sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  const n = scoped.length;
  const accept = scoped.filter((row) => String(row.humanOutcome).startsWith("ACCEPT")).length;
  const reject = scoped.filter((row) => row.humanOutcome === "REJECT").length;
  const edit = scoped.filter(
    (row) =>
      row.humanOutcome === "ACCEPT_EDIT" ||
      row.editSignal?.formationChanged ||
      row.editSignal?.positionChanged
  ).length;
  const unchanged = scoped.filter((row) => row.humanOutcome === "ACCEPT_UNCHANGED").length;
  const formationEdit = scoped.filter((row) => row.editSignal?.formationChanged).length;
  const positionEdit = scoped.filter((row) => row.editSignal?.positionChanged).length;
  const assignmentEdit = scoped.filter((row) => row.editSignal?.assignmentChanged).length;
  const swap = assignmentEdit;
  return {
    candidateCount: n,
    acceptCount: accept,
    rejectCount: reject,
    editCount: edit,
    unchangedCount: unchanged,
    acceptRate: rate(accept, n),
    rejectRate: rate(reject, n),
    editRate: rate(edit, n),
    unchangedRate: rate(unchanged, n),
    formationEditRate: rate(formationEdit, n),
    positionEditRate: rate(positionEdit, n),
    assignmentEditRate: rate(assignmentEdit, n),
    swapRate: rate(swap, n),
    top1Changed: 0,
    top3Changed: 0,
    scoreDelta: null,
    rankDelta: null,
  };
}

export function computeCanarySafetyMetrics(
  events: FormationCanarySafetyEvent[]
): FormationCanarySafetyMetrics {
  const count = (kind: FormationCanarySafetyEvent["kind"]) =>
    events.filter((event) => event.kind === kind).length;
  return {
    invalidResultCount: count("invalid_result"),
    fallbackToV1Count: events.filter((event) =>
      event.kind === "fallback_v1" ||
      event.kind === "version_mismatch" ||
      event.kind === "package_invalid" ||
      event.kind === "resolver_error"
    ).length,
    resolverErrorCount: count("resolver_error"),
    candidateGenerationFailureCount: count("generation_failure"),
    applyFailureCount: count("apply_failure"),
  };
}

export function assessCanaryHealth(input: {
  activation?: FormationCanaryActivation | null;
  observations: FormationCanaryObservation[];
  safety: FormationCanarySafetyEvent[];
}): CanaryHealthReport {
  const metrics = computeFormationCanaryMetrics(input.observations);
  const safety = computeCanarySafetyMetrics(input.safety);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!input.activation) blockers.push("CANARY_NOT_ACTIVATED");
  if (input.activation?.rolledBack) blockers.push("ROLLED_BACK");
  if (input.activation && input.activation.dataSource !== "REAL") {
    warnings.push("FIXTURE_CANARY_NOT_PRODUCTION");
  }
  if (safety.fallbackToV1Count >= FORMATION_CANARY_HEALTH_HEURISTICS.fallbackWarn) {
    warnings.push("FALLBACK_TO_V1");
  }
  if (safety.applyFailureCount >= FORMATION_CANARY_HEALTH_HEURISTICS.applyFailureWarn) {
    warnings.push("APPLY_FAILURE");
  }

  let status: CanaryHealthReport["status"] = "BLOCKED";
  if (input.activation?.rolledBack) status = "ROLLED_BACK";
  else if (!input.activation) status = "BLOCKED";
  else if (safety.fallbackToV1Count >= FORMATION_CANARY_HEALTH_HEURISTICS.fallbackRegression) {
    status = "REGRESSION";
  } else if (warnings.includes("FALLBACK_TO_V1") || warnings.includes("APPLY_FAILURE")) {
    status = "WARNING";
  } else if (input.activation.config.enabled) {
    status = input.observations.length === 0 ? "ACTIVE" : "HEALTHY";
  }

  return {
    analysisVersion: FORMATION_CANARY_VERSION,
    status,
    dimensions: {
      functionalSafety: safety.resolverErrorCount > 0 ? "BLOCKED" : "PASS",
      humanOutcome: metrics.candidateCount === 0 ? "UNKNOWN" : "PASS",
      editBehavior: metrics.candidateCount === 0 ? "UNKNOWN" : "PASS",
      fallbackErrorRate:
        safety.fallbackToV1Count >= FORMATION_CANARY_HEALTH_HEURISTICS.fallbackRegression
          ? "REGRESSION"
          : safety.fallbackToV1Count >= FORMATION_CANARY_HEALTH_HEURISTICS.fallbackWarn
            ? "WARNING"
            : "PASS",
      versionIntegrity: input.activation ? "PASS" : "BLOCKED",
    },
    metrics,
    safety,
    blockers: [...new Set(blockers)].sort((a, b) => a.localeCompare(b)),
    warnings: [...new Set(warnings)].sort((a, b) => a.localeCompare(b)),
    notes: [
      "No overall health score. Dimensions stay independent.",
      "Fallback to V1 is allowed. Automatic promotion is not.",
      "counterfactual remains unknown.",
      "Edit after V2 accept is not automatic proof that V2 failed.",
    ],
  };
}
