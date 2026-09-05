import { DISCREPANCY_TOP_N } from "./discrepancyConfig";
import type { DiscrepancyReport, RateStat } from "./discrepancyTypes";

function pct(stat: RateStat): string {
  if (stat.rate == null) return "n/a";
  return `${(stat.rate * 100).toFixed(1)}%`;
}

function layerLine(report: DiscrepancyReport, layer: DiscrepancyReport["layerAttribution"][number]["layer"]): string {
  const row = report.layerAttribution.find((l) => l.layer === layer);
  if (!row || row.rate == null) return `${layer}: n/a`;
  return `${layer}: ${(row.rate * 100).toFixed(1)}% (n=${row.count})`;
}

export function formatDiscrepancyReport(report: DiscrepancyReport): string {
  const top = report.findings.slice(0, DISCREPANCY_TOP_N);
  const findingBlocks = top.map((finding, i) =>
    [
      `${i + 1}. ${finding.category}`,
      `Likely layer: ${finding.likelyLayer}`,
      `Rate: ${finding.rate == null ? "n/a" : `${(finding.rate * 100).toFixed(1)}%`}`,
      `Sample: n=${finding.sampleSize}`,
      `Confidence: ${finding.confidence}`,
      "OBSERVED:",
      ...finding.observed.map((line) => `- ${line}`),
      "HYPOTHESIS:",
      ...finding.hypothesis.map((line) => `- ${line}`),
    ].join("\n")
  );

  return [
    "CHOREOCORE DISCREPANCY REPORT",
    "──────────────────────────────",
    "",
    "Dataset",
    `${report.candidateCount} candidates / ${report.sampleSize} evaluation records`,
    `analysis=${report.analysisVersion}`,
    `dataset=${report.datasetVersion}`,
    `algorithm=${report.algorithmVersion}`,
    `weights=${report.weightsVersion}`,
    `confidence=${report.confidence}`,
    "",
    "AI / HUMAN AGREEMENT",
    `Accept unchanged       ${pct(report.overall.acceptUnchanged)}`,
    `Accept + Edit          ${pct(report.overall.acceptEdit)}`,
    `Reject                 ${pct(report.overall.reject)}`,
    "",
    "CORE PATTERNS",
    `High-score → Reject    ${pct(report.patterns.highScoreReject)}`,
    `Low-score → Accept     ${pct(report.patterns.lowScoreAccept)}`,
    "",
    "LAYER ATTRIBUTION (among disagreements)",
    layerLine(report, "music_cue"),
    layerLine(report, "intent"),
    layerLine(report, "formation"),
    layerLine(report, "transition"),
    layerLine(report, "unknown"),
    "",
    "TOP DISCREPANCIES",
    findingBlocks.length === 0 ? "(none)" : findingBlocks.join("\n\n"),
    "",
    "POSITIVE EVIDENCE",
    ...report.positiveEvidence.observed.map((line) => `- ${line}`),
    "",
    "PAIRWISE",
    `disagreement=${report.pairwiseDisagreementRate == null ? "n/a" : `${(report.pairwiseDisagreementRate * 100).toFixed(1)}%`}`,
    `mismatches=${report.pairwiseMismatches.length}`,
    "",
    "WEIGHT PROPOSALS",
    `formation: ${report.weightProposals.formation.weightsVersionProposed} autoApplied=${report.weightProposals.formation.autoApplied}`,
    `transition: ${report.weightProposals.transition.weightsVersionProposed} autoApplied=${report.weightProposals.transition.autoApplied}`,
    "",
    "NOTES",
    ...report.notes.map((line) => `- ${line}`),
    "",
    "──────────────────────────────",
  ].join("\n");
}
