/**
 * Post-Benchmark finding classes for Phase 4.6.
 * Do NOT jump to madmom/MSAF from raw scores alone.
 */

import type { BeatPatternScore, PatternAxisVerdict } from "./scoreBeatPattern";

export type FindingClass =
  | "PASS"
  | "WEAK"
  | "GT-AMBIGUITY"
  | "ANALYZER-LIMIT";

export type DimensionFinding = {
  songId: string;
  title: string;
  analyzerId: string;
  dimension: "BEAT" | "DOWNBEAT" | "BPM" | "SECTION" | "MUSICAL_CHANGE";
  findingClass: FindingClass;
  score: number | null;
  evidence: string;
  axes?: {
    period: PatternAxisVerdict;
    phase: PatternAxisVerdict;
    continuity: PatternAxisVerdict;
    evidence: PatternAxisVerdict;
  };
};

function worst(
  a: PatternAxisVerdict,
  b: PatternAxisVerdict
): PatternAxisVerdict {
  const rank: Record<PatternAxisVerdict, number> = {
    PASS: 0,
    WEAK: 1,
    FAIL: 2,
    NOT_AVAILABLE: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Classify a Beat Pattern score.
 * Phase FAIL with half-beat ratio (e.g. song-013) → WEAK/ANALYZER-LIMIT candidate,
 * never GT-AMBIGUITY when consensus phase policy is locked.
 */
export function classifyBeatPattern(opts: {
  songId: string;
  title: string;
  analyzerId: string;
  score: BeatPatternScore;
  gtLockedPhasePolicy?: boolean;
}): DimensionFinding {
  const { score } = opts;
  const axes = {
    period: score.period.verdict,
    phase: score.phase.verdict,
    continuity: score.continuity.verdict,
    evidence: score.evidence.verdict,
  };

  const hardFail = [axes.period, axes.phase, axes.continuity].filter(
    (v) => v === "FAIL"
  ).length;
  const anyWeak = [axes.period, axes.phase, axes.continuity, axes.evidence].some(
    (v) => v === "WEAK" || v === "FAIL"
  );

  let findingClass: FindingClass = "PASS";
  // ANALYZER-LIMIT: period broken, or phase+continuity both fail (unstable wrong grid)
  if (axes.period === "FAIL" || (axes.phase === "FAIL" && axes.continuity === "FAIL")) {
    findingClass = "ANALYZER-LIMIT";
  } else if (hardFail === 1 || anyWeak) {
    findingClass = "WEAK";
  }

  // Consensus-locked songs: constant half-beat phase error = Analyzer WEAK, never GT-AMBIGUITY
  if (
    opts.gtLockedPhasePolicy &&
    axes.phase === "FAIL" &&
    (score.phase.halfBeatRatio ?? 0) >= 0.35 &&
    axes.continuity !== "FAIL"
  ) {
    findingClass = "WEAK";
  }

  const phaseMs =
    score.phase.medianAbsErrorSec != null
      ? Math.round(score.phase.medianAbsErrorSec * 1000)
      : null;

  return {
    songId: opts.songId,
    title: opts.title,
    analyzerId: opts.analyzerId,
    dimension: score.kind === "beat" ? "BEAT" : "DOWNBEAT",
    findingClass,
    score: score.aggregateScore,
    evidence: [
      `period=${axes.period}(rel=${score.period.relativeError?.toFixed(3) ?? "n/a"})`,
      `phase=${axes.phase}(medMs=${phaseMs})`,
      `continuity=${axes.continuity}(lock=${score.continuity.lockFraction?.toFixed(2) ?? "n/a"})`,
      `evidence=${axes.evidence}`,
      ...score.notes.slice(0, 2),
    ].join("; "),
    axes,
  };
}

export function summarizeFindingClasses(
  findings: DimensionFinding[]
): Record<FindingClass, number> {
  const out: Record<FindingClass, number> = {
    PASS: 0,
    WEAK: 0,
    "GT-AMBIGUITY": 0,
    "ANALYZER-LIMIT": 0,
  };
  for (const f of findings) out[f.findingClass]++;
  return out;
}

export function aggregateWorstClass(
  findings: DimensionFinding[]
): FindingClass {
  const order: FindingClass[] = [
    "PASS",
    "WEAK",
    "GT-AMBIGUITY",
    "ANALYZER-LIMIT",
  ];
  let worstIdx = 0;
  for (const f of findings) {
    const i = order.indexOf(f.findingClass);
    if (i > worstIdx) worstIdx = i;
  }
  return order[worstIdx]!;
}

/** Unused helper kept for type-level exhaustiveness in reports */
export function axisWorst(
  a: PatternAxisVerdict,
  b: PatternAxisVerdict
): PatternAxisVerdict {
  return worst(a, b);
}
