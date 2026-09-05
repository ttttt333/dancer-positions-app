import type { RealWorldEvidenceReport } from "./realWorldEvidenceTypes";

function pct(value: number | null): string {
  return value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

export function formatRealWorldEvidenceReport(report: RealWorldEvidenceReport): string {
  return [
    "REAL-WORLD EVIDENCE",
    "━━━━━━━━━━━━━━━━",
    `integrity=${report.integrity}`,
    `readiness=${report.readiness.status}`,
    `canReleaseFormationV2=${report.readiness.canReleaseFormationV2}`,
    "",
    "Formation",
    `Candidates      ${report.formation.candidateCount}`,
    `Accepted        ${report.formation.acceptCount} (${pct(report.formation.acceptRate)})`,
    `Edited          ${report.formation.acceptEditCount}`,
    `Unchanged       ${report.formation.acceptUnchangedCount}`,
    `Rejected        ${report.formation.rejectCount}`,
    "",
    "Transition",
    `Candidates      ${report.transition.candidateCount}`,
    `Accepted        ${report.transition.acceptCount}`,
    `Edited          ${report.transition.acceptEditCount}`,
    `Rejected        ${report.transition.rejectCount}`,
    "",
    "Evidence Quality",
    `sampleCount     ${report.evidenceQuality.sampleCount}`,
    `projects        ${report.evidenceQuality.uniqueProjectCount}`,
    `sessions        ${report.evidenceQuality.uniqueSessionCount}`,
    `users           ${report.evidenceQuality.uniqueUserCount}`,
    `songs           ${report.evidenceQuality.uniqueSongCount}`,
    `actions         ${report.evidenceQuality.actionDiversity}`,
    "",
    "Blockers",
    ...(report.readiness.blockers.length === 0
      ? ["- none"]
      : report.readiness.blockers.map((b) => `- ${b}`)),
    "",
    "Warnings",
    ...(report.readiness.warnings.length === 0
      ? ["- none"]
      : report.readiness.warnings.map((w) => `- ${w}`)),
    "",
    ...report.notes.map((n) => `- ${n}`),
  ].join("\n");
}
