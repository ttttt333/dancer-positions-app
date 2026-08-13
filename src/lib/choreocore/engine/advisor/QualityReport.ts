import type { QualityAdvisorReport } from "../types/AdvisorTypes";

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function verdictMark(verdict: string): string {
  if (verdict === "PASS") return "PASS";
  if (verdict === "WATCH") return "WATCH";
  return "FAIL";
}

function impactText(label: string): string {
  if (label === "VERY_HIGH") return "Very High";
  if (label === "HIGH") return "High";
  if (label === "MEDIUM") return "Medium";
  return "Low";
}

export function formatQualityReport(report: QualityAdvisorReport): string {
  const lines: string[] = [
    "=====================================",
    "CHOREOCORE AI QUALITY REPORT",
    "=====================================",
    "",
    `Overall                    ${report.overall.toFixed(1)}`,
    `Grade                      ${report.grade}`,
    `Advisor                    ${report.advisorVersion}`,
    `Human-Human Agreement      ${pct(report.humanHumanAgreement)}`,
    `AI-Human Agreement         ${pct(report.aiHumanAgreement)}`,
    `Human Ceiling Ratio        ${report.humanCeilingRatio.toFixed(3)}`,
    `Safety constraint          ${report.safetyConstraintHeld ? "HELD" : "BREACHED"}`,
    "",
    "Quality gates",
    "-------------",
  ];
  for (const gate of report.gates) {
    const actual = gate.unit === "ratio" ? pct(gate.actual) : gate.actual.toFixed(1);
    const target = gate.higherIsBetter ? `≥${pct(gate.target)}` : `≤${pct(gate.target)}`;
    lines.push(`${gate.label.padEnd(24)} ${target.padEnd(10)} ${actual.padEnd(10)} ${verdictMark(gate.verdict)}`);
  }
  lines.push("");
  for (const card of report.cards) {
    lines.push(`⚠ PRIORITY ${card.rank}`);
    lines.push(`${card.failedAt.replace("PHASE_", "PHASE ").replace("_", " / ")}`);
    lines.push("");
    lines.push(`Score: ${card.score.toFixed(1)}`);
    lines.push(`Impact: ${impactText(card.impactLabel)}`);
    lines.push(`Frequency: ${pct(card.frequency)}`);
    if (card.safetyForced) lines.push("Safety override: YES");
    lines.push("");
    lines.push("主な問題:");
    for (const p of card.problems) lines.push(`- ${p}`);
    if (card.rootCauses.length > 0) {
      lines.push(`Root cause: ${card.rootCauses.join(", ")}`);
    }
    lines.push("");
    lines.push("推奨修正:");
    for (const fix of card.fixes) {
      lines.push(`${fix.order}. ${fix.action}`);
    }
    lines.push("");
    lines.push("期待改善:");
    lines.push(card.expectedImpact.summary);
    if (card.note) {
      lines.push("");
      lines.push(`Note: ${card.note}`);
    }
    lines.push("");
  }
  if (report.disagreements.length > 0) {
    lines.push("Human disagreement (not counted as AI error)");
    lines.push("-------------------------------------------");
    for (const d of report.disagreements) {
      lines.push(`${d.songId} ${d.cueId}: ${d.choices.join(" vs ")}`);
    }
    lines.push("");
  }
  lines.push(report.principle);
  lines.push("");
  lines.push("Tuning is advisory only. Do not auto-apply to production.");
  lines.push("=====================================");
  return lines.join("\n");
}
