import type { ReleaseDecisionReport } from "./releaseDecisionTypes";

function mark(ok: boolean): string {
  return ok ? "✓" : "✗";
}

function dim(verdict: string): string {
  return verdict === "PASS" ? "✓" : "❌";
}

export function formatReleaseDecisionReport(report: ReleaseDecisionReport): string {
  const locked = report.status !== "READY_FOR_RELEASE";
  return [
    `${report.domain.toUpperCase()} V2 REVIEW`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━",
    `DATA_SOURCE = ${report.dataSource}`,
    `Status`,
    report.status === "NOT_ELIGIBLE" ? "🔴 NOT ELIGIBLE" : report.status,
    "",
    `Real samples       ${report.review.sampleCount}`,
    `Projects           ${report.review.projectCount}`,
    `Songs              ${report.review.songCount}`,
    `Users              ${report.review.userCount}`,
    `Sessions           ${report.review.sessionCount}`,
    "",
    `Evidence             ${dim(report.dimensions.evidenceSufficiency)}`,
    `Diversity            ${dim(report.dimensions.evidenceDiversity)}`,
    `Shadow               ${dim(report.dimensions.shadowEvidence)}`,
    `Regression           ${report.review.regressionStatus === "PASS" ? "—" : report.review.regressionStatus}`,
    `Version              ${dim(report.dimensions.versionIntegrity)}`,
    `Approval             ${dim(report.dimensions.humanApproval)}`,
    "",
    "Blockers",
    ...(report.hardBlockers.length === 0
      ? ["- none"]
      : report.hardBlockers.map((row) => `• ${row}`)),
    "",
    "Warnings",
    ...(report.warnings.length === 0 ? ["- none"] : report.warnings.map((row) => `• ${row}`)),
    "",
    "Evidence needed",
    ...report.evidenceNeeded.map((row) => `${mark(row.met)} ${row.label}`),
    "",
    "Checklist",
    ...report.checklist.map((row) => `${row.key.padEnd(28)} ${row.verdict}`),
    "",
    `RELEASE                ${locked ? "🔒" : "awaiting human"}`,
    "HOLD",
    "REJECT",
    "",
    `humanDecision=${report.humanDecision ?? "none"}`,
    `canProceedToCanary=${report.canProceedToCanary}`,
    `productionCanaryEligible=${report.productionCanaryEligible}`,
    "",
    ...report.notes.map((note) => `- ${note}`),
  ].join("\n");
}
