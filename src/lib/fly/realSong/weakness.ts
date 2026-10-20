import type { AnalyzerReliabilityProfile } from "../benchmark/types";
import type {
  ExpansionPlan,
  WeaknessDimension,
  WeaknessFinding,
  WeaknessSeverity,
} from "./types";
import { FLY_WEAKNESS_VERSION } from "./versions";

function mapSignalToDimension(signalType: string): WeaknessDimension | null {
  if (signalType === "tempo") return "BPM";
  if (signalType === "beat") return "BEAT";
  if (signalType === "downbeat") return "DOWNBEAT";
  if (signalType === "eightCount") return "8COUNT";
  if (signalType === "section") return "SECTION";
  if (signalType === "event" || signalType === "musical_change") {
    return "MUSICAL_CHANGE";
  }
  return null;
}

function severityFor(
  score: number,
  evidence: WeaknessFinding["evidenceConfidence"]
): WeaknessSeverity {
  if (evidence === "NONE") return "INFO";
  if (score < 0.7) return "WEAK";
  if (score < 0.85 || (evidence === "LOW" && score < 0.9)) return "WATCH";
  return "INFO";
}

export function detectWeaknesses(
  profiles: AnalyzerReliabilityProfile[]
): WeaknessFinding[] {
  const findings: WeaknessFinding[] = [];
  for (const p of profiles) {
    if (p.score == null || p.status !== "OK") continue;
    // Prefer condition-specific over "all" for targeting; still include all
    const dim = mapSignalToDimension(p.signalType);
    if (!dim) continue;
    const severity = severityFor(p.score, p.evidenceConfidence);
    findings.push({
      analyzer: p.analyzerId,
      dimension: dim,
      condition: p.condition,
      score: p.score,
      sampleCount: p.sampleCount,
      evidenceConfidence: p.evidenceConfidence,
      severity,
      note: `weakness_version=${FLY_WEAKNESS_VERSION}; metric=${p.metric}`,
    });
  }
  return findings.sort((a, b) => {
    const rank = { WEAK: 0, WATCH: 1, INFO: 2 };
    return rank[a.severity] - rank[b.severity] || a.score - b.score;
  });
}

/**
 * Active Expansion: next +10 songs targeted at WEAK/WATCH conditions.
 * Does not fetch audio — returns a plan only.
 */
export function planActiveExpansion(
  findings: WeaknessFinding[],
  opts?: { songCount?: number }
): ExpansionPlan {
  const n = opts?.songCount ?? 10;
  const actionable = findings.filter(
    (f) =>
      (f.severity === "WEAK" || f.severity === "WATCH") &&
      f.condition !== "all"
  );
  const targets = [
    ...new Set(actionable.map((f) => `${f.dimension}@${f.condition}`)),
  ].slice(0, 12);

  const rationale = actionable.slice(0, 8).map(
    (f) =>
      `${f.analyzer} ${f.dimension} on ${f.condition}: score=${f.score.toFixed(3)} n=${f.sampleCount} evidence=${f.evidenceConfidence} → ${f.severity}`
  );

  const lowSampleSizeWarning =
    findings.some((f) => f.evidenceConfidence === "LOW") ||
    findings.every((f) => f.sampleCount < 10);

  if (!targets.length) {
    rationale.push(
      "No WEAK/WATCH condition-specific findings yet — keep Stage A difficulty matrix; do not random-add."
    );
  }

  return {
    suggestedSongCount: n,
    targetConditions: targets,
    rationale,
    basedOnFindings: actionable.slice(0, 20),
    lowSampleSizeWarning,
  };
}
