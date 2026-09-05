import type { MetricComparison, WeightApprovalPackage } from "./weightApprovalTypes";

function cell(key: string, value: number | null): string {
  if (value == null) return "n/a";
  if (key === "spearman") return value.toFixed(3);
  return `${(value * 100).toFixed(1)}%`;
}

function metricLine(metrics: MetricComparison[], key: string): string {
  const row = metrics.find((m) => m.key === key);
  if (!row) return `${key.padEnd(22)} n/a     n/a`;
  return `${key.padEnd(22)} ${cell(key, row.v1).padEnd(8)} ${cell(key, row.v2)}`;
}

export function formatWeightApprovalReport(pkg: WeightApprovalPackage): string {
  const lines = [
    `WEIGHT PROPOSAL — ${pkg.layer.toUpperCase()} V2`,
    "──────────────────────────────",
    "",
    `Status: ${pkg.status}`,
    `Proposal: ${pkg.disabled ? "DISABLED" : pkg.proposal.weightsVersionCurrent + " → " + pkg.proposal.weightsVersionProposed}`,
    `Production: UNCHANGED (applied=${pkg.applied}, autoApplied=${pkg.autoApplied})`,
    "",
    "Versions",
    `dataset=${pkg.versions.datasetVersion}`,
    `algorithm=${pkg.versions.algorithmVersion}`,
    `analysis=${pkg.versions.analysisVersion}`,
    `approval=${pkg.versions.approvalVersion}`,
    `weights=${pkg.versions.weightsVersionCurrent}`,
    "",
  ];
  if (pkg.status === "INSUFFICIENT") {
    lines.push(
      "INSUFFICIENT",
      `Reason: Minimum evidence threshold not met (n=${pkg.proposal.sampleSize}).`,
      "Weight proposal: DISABLED",
      "Approval: IMPOSSIBLE",
      ""
    );
    return lines.join("\n");
  }
  lines.push("Evidence");
  for (const ev of pkg.evidence) {
    lines.push(
      `- ${ev.finding} n=${ev.sampleSize} confidence=${ev.confidence} layer=${ev.affectedLayer}` +
        (ev.affectedMetric ? ` metric=${ev.affectedMetric}` : "")
    );
    lines.push("  OBSERVED:");
    for (const o of ev.observed) lines.push(`  - ${o}`);
    lines.push("  HYPOTHESIS:");
    for (const h of ev.hypothesis) lines.push(`  - ${h}`);
  }
  lines.push("", "Proposal deltas (candidate only, not a necessary value)");
  const deltaKeys = Object.keys(pkg.proposal.deltas).sort((a, b) => a.localeCompare(b));
  if (deltaKeys.length === 0) lines.push("- none");
  for (const key of deltaKeys) {
    lines.push(`- ${key}: ${pkg.proposal.current[key]} → ${pkg.proposal.proposed[key]}`);
  }
  if (pkg.comparison) {
    lines.push("", "Simulation (full dataset)", "                      V1       V2");
    for (const key of [
      "top1Agreement",
      "top3Agreement",
      "spearman",
      "pairwiseAgreement",
      "acceptUnchangedRate",
      "editRate",
      "rejectRate",
      "formationEditRate",
      "transitionEditRate",
    ]) {
      lines.push(metricLine(pkg.comparison.metrics, key));
    }
    lines.push(
      "",
      `Improved metrics: ${pkg.comparison.improvedCount}`,
      `Worsened metrics: ${pkg.comparison.worsenedCount}`,
      `Critical regressions: ${pkg.comparison.criticalRegressions.join("; ") || "None above guardrail."}`,
      `Ready for review: ${pkg.comparison.readyForReview}`
    );
  }
  if (pkg.reviews.length > 0) {
    lines.push("", "Reviews");
    for (const review of pkg.reviews) {
      lines.push(`- ${review.decision} by ${review.reviewerId}: ${review.reason}`);
    }
  }
  lines.push("", "Notes", ...pkg.notes.map((n) => `- ${n}`), "", "──────────────────────────────");
  return lines.join("\n");
}
