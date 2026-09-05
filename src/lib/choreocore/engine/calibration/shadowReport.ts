import type { ShadowReport } from "./shadowTypes";

export function formatShadowReport(report: ShadowReport): string {
  return [
    "CHOREOCORE V2 SHADOW REPORT",
    "──────────────────────────────",
    "",
    `Dataset: N=${report.sampleSize} candidates / ${report.contextCount} contexts`,
    `Layer: ${report.layer}`,
    `Production: ${report.productionWeightsVersion}`,
    `Shadow: ${report.shadowWeightsVersion}`,
    `Status: ${report.status}`,
    `Confidence: ${report.confidence}`,
    `Auto promoted: ${report.autoPromoted}`,
    "",
    "Candidate Set Changed:",
    String(
      report.layer === "formation"
        ? report.formation?.setChanged ?? 0
        : report.transition?.setChanged ?? 0
    ),
    "Top-1 Changed:",
    String(
      report.layer === "formation"
        ? report.formation?.top1Changed ?? 0
        : report.transition?.top1Changed ?? 0
    ),
    "",
    "Human (Production V1 outcomes)",
    `V1 top-1 ∩ accept unchanged: ${report.observational.v1Top1AcceptUnchanged}`,
    `V2 top-1 ∩ accept unchanged: ${report.observational.v2Top1AcceptUnchanged} (observational only)`,
    "",
    "OBSERVED:",
    ...report.observed.map((line) => `- ${line}`),
    "",
    "HYPOTHESIS:",
    ...report.hypothesis.map((line) => `- ${line}`),
    "",
    "NOTES:",
    ...report.notes.map((line) => `- ${line}`),
    "",
    "──────────────────────────────",
  ].join("\n");
}
