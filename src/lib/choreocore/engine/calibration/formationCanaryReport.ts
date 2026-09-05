import type { CanaryHealthReport, FormationCanaryActivation } from "./formationCanaryTypes";

export function formatFormationCanaryReport(
  report: CanaryHealthReport,
  activation?: FormationCanaryActivation | null
): string {
  return [
    "FORMATION V2 CONTROLLED CANARY",
    "━━━━━━━━━━━━━━━━━━━━━━━━━",
    `DATA_SOURCE = ${activation?.dataSource ?? "NONE"}`,
    `enabled=${activation?.config.enabled ?? false}`,
    `status=${report.status}`,
    `activationId=${activation?.activationId ?? "none"}`,
    "",
    `arm assignment key = ${activation?.config.assignmentKey ?? "projectKey"}`,
    `percent = ${activation?.config.canaryPercentage ?? 0} (fixed, no auto rollout)`,
    "",
    "Isolation",
    "Formation   canary arm only",
    "Transition  V1",
    "Music       V1",
    "Cue         V1",
    "Intent      V1",
    "",
    "Metrics",
    `candidates ${report.metrics.candidateCount}`,
    `accept     ${report.metrics.acceptCount}`,
    `reject     ${report.metrics.rejectCount}`,
    `edit       ${report.metrics.editCount}`,
    "",
    "Safety",
    `fallbackToV1 ${report.safety.fallbackToV1Count}`,
    `resolverErr  ${report.safety.resolverErrorCount}`,
    `invalid      ${report.safety.invalidResultCount}`,
    "",
    "Blockers",
    ...(report.blockers.length === 0 ? ["- none"] : report.blockers.map((row) => `• ${row}`)),
    "",
    ...report.notes.map((note) => `- ${note}`),
  ].join("\n");
}
