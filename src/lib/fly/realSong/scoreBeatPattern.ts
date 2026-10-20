/**
 * Phase 4.6 Beat / Downbeat Pattern scoring.
 * Axes: Period / Phase / Continuity / Evidence.
 * Forbidden: pointwise F1 of seeds vs full-song hyp lists.
 */

import type { DerivedTimingPattern } from "./beatPattern";

export type PatternAxisVerdict = "PASS" | "WEAK" | "FAIL" | "NOT_AVAILABLE";

export type BeatPatternScore = {
  status: "OK" | "NOT_AVAILABLE" | "EMPTY";
  kind: "beat" | "downbeat";
  period: {
    gtIntervalSec: number;
    hypIntervalSec: number | null;
    relativeError: number | null;
    score: number | null;
    verdict: PatternAxisVerdict;
    octaveHint: 0.5 | 1 | 2 | null;
  };
  phase: {
    /** Median absolute residual to GT grid (seconds) */
    medianAbsErrorSec: number | null;
    /** Fraction of half-interval (0.5 ≈ half-beat flip) */
    halfBeatRatio: number | null;
    score: number | null;
    verdict: PatternAxisVerdict;
  };
  continuity: {
    /** Fraction of evaluation bins that stay locked */
    lockFraction: number | null;
    evaluatedBins: number;
    score: number | null;
    verdict: PatternAxisVerdict;
  };
  evidence: {
    gtSeedCount: number;
    hypCountInWindow: number;
    hypIntervalCv: number | null;
    score: number | null;
    verdict: PatternAxisVerdict;
  };
  /** Mean of available axis scores in [0,1] */
  aggregateScore: number | null;
  window: { startSec: number; endSec: number };
  notes: string[];
};

const PERIOD_PASS = 0.03;
const PERIOD_WEAK = 0.08;
const PHASE_PASS_SEC = 0.04;
const PHASE_WEAK_SEC = 0.1;
const CONT_PASS = 0.85;
const CONT_WEAK = 0.65;

function uniqSorted(times: number[]): number[] {
  return [...new Set(times.map((t) => Number(t)))]
    .filter((t) => Number.isFinite(t) && t >= 0)
    .sort((a, b) => a - b);
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function successiveIntervals(times: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < times.length; i++) out.push(times[i]! - times[i - 1]!);
  return out;
}

function cv(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs);
  if (m <= 1e-9) return null;
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) / m;
}

/** Residual of t to infinite GT grid starting at phase0 with period interval */
export function gridResidualSec(
  t: number,
  phase0: number,
  interval: number
): number {
  if (interval <= 1e-9) return Math.abs(t - phase0);
  const k = Math.round((t - phase0) / interval);
  return Math.abs(t - (phase0 + k * interval));
}

function octaveHint(
  gtInterval: number,
  hypInterval: number
): 0.5 | 1 | 2 | null {
  const r = hypInterval / gtInterval;
  if (Math.abs(r - 1) <= 0.08) return 1;
  if (Math.abs(r - 2) <= 0.12) return 2;
  if (Math.abs(r - 0.5) <= 0.08) return 0.5;
  return null;
}

function periodScore(relErr: number | null): {
  score: number | null;
  verdict: PatternAxisVerdict;
} {
  if (relErr == null) return { score: null, verdict: "NOT_AVAILABLE" };
  if (relErr <= PERIOD_PASS) return { score: 1, verdict: "PASS" };
  if (relErr <= PERIOD_WEAK)
    return {
      score: Math.max(0, 1 - (relErr - PERIOD_PASS) / (PERIOD_WEAK - PERIOD_PASS) * 0.35),
      verdict: "WEAK",
    };
  return {
    score: Math.max(0, 0.65 - Math.min(0.65, (relErr - PERIOD_WEAK) * 2)),
    verdict: "FAIL",
  };
}

function phaseScore(medErr: number | null, halfInterval: number): {
  score: number | null;
  verdict: PatternAxisVerdict;
  halfBeatRatio: number | null;
} {
  if (medErr == null || halfInterval <= 0)
    return { score: null, verdict: "NOT_AVAILABLE", halfBeatRatio: null };
  const halfBeatRatio = medErr / halfInterval;
  if (medErr <= PHASE_PASS_SEC) return { score: 1, verdict: "PASS", halfBeatRatio };
  if (medErr <= PHASE_WEAK_SEC)
    return {
      score: Math.max(
        0.4,
        1 - ((medErr - PHASE_PASS_SEC) / (PHASE_WEAK_SEC - PHASE_PASS_SEC)) * 0.5
      ),
      verdict: "WEAK",
      halfBeatRatio,
    };
  // Near half-beat (e.g. ~207ms at 122.5 BPM) → clear phase FAIL
  return {
    score: Math.max(0, 0.35 - Math.min(0.35, (medErr - PHASE_WEAK_SEC) * 2)),
    verdict: "FAIL",
    halfBeatRatio,
  };
}

function continuityScore(lockFraction: number | null): {
  score: number | null;
  verdict: PatternAxisVerdict;
} {
  if (lockFraction == null) return { score: null, verdict: "NOT_AVAILABLE" };
  if (lockFraction >= CONT_PASS) return { score: lockFraction, verdict: "PASS" };
  if (lockFraction >= CONT_WEAK) return { score: lockFraction, verdict: "WEAK" };
  return { score: lockFraction, verdict: "FAIL" };
}

function evidenceScore(opts: {
  gtSeedCount: number;
  hypCount: number;
  hypCv: number | null;
}): { score: number | null; verdict: PatternAxisVerdict } {
  if (opts.hypCount < 4) return { score: 0.1, verdict: "FAIL" };
  let s = Math.min(1, opts.hypCount / 32);
  if (opts.gtSeedCount >= 8) s = Math.min(1, s + 0.15);
  if (opts.hypCv != null && opts.hypCv > 0.25) s *= 0.7;
  const verdict: PatternAxisVerdict =
    s >= 0.75 ? "PASS" : s >= 0.45 ? "WEAK" : "FAIL";
  return { score: s, verdict };
}

/**
 * Score analyzer beat/downbeat times against a derived GT pattern.
 * Uses only Period / Phase / Continuity / Evidence — never seed-count F1.
 */
export function scoreTimingPattern(
  kind: "beat" | "downbeat",
  gt: DerivedTimingPattern,
  hypTimes: number[] | null | undefined,
  opts?: { lockTolSec?: number }
): BeatPatternScore {
  const notes: string[] = [];
  const window = {
    startSec: gt.patternStartSec,
    endSec: gt.continuationUntilSec,
  };
  const lockTol = opts?.lockTolSec ?? (kind === "beat" ? 0.07 : 0.1);

  if (!hypTimes) {
    return emptyPatternScore(kind, gt, "NOT_AVAILABLE", ["hyp times missing"]);
  }
  const hypAll = uniqSorted(hypTimes);
  if (!hypAll.length) {
    return emptyPatternScore(kind, gt, "EMPTY", ["hyp times empty"]);
  }

  const hypIn = hypAll.filter(
    (t) => t >= window.startSec - 1e-6 && t <= window.endSec + 1e-6
  );
  const hypIntervals = successiveIntervals(hypIn.length >= 2 ? hypIn : hypAll);
  const hypInterval = median(hypIntervals);
  const hypCv = cv(hypIntervals);

  const periodRel =
    hypInterval != null && gt.intervalSec > 0
      ? Math.abs(hypInterval - gt.intervalSec) / gt.intervalSec
      : null;
  // Prefer octave-corrected relative error for period axis when clear 2x/0.5x
  let periodRelEval = periodRel;
  let oct: 0.5 | 1 | 2 | null = null;
  if (hypInterval != null && gt.intervalSec > 0) {
    oct = octaveHint(gt.intervalSec, hypInterval);
    if (oct === 2 || oct === 0.5) {
      const corrected =
        oct === 2 ? hypInterval / 2 : hypInterval * 2;
      periodRelEval = Math.abs(corrected - gt.intervalSec) / gt.intervalSec;
      notes.push(`octaveHint=${oct} (period scored after correction)`);
    }
  }
  const period = periodScore(periodRelEval);

  const residuals = hypIn.map((t) =>
    gridResidualSec(t, gt.phaseSec, gt.intervalSec)
  );
  const medPhase = median(residuals);
  const phase = phaseScore(medPhase, gt.intervalSec / 2);

  /**
   * Continuity = phase-drift stability (not absolute GT lock).
   * Absolute offset is Phase; Continuity asks whether the offset stays
   * consistent across the evaluation window (no break / wander).
   * This avoids double-counting a constant half-beat phase error.
   */
  const binResiduals: number[] = [];
  if (gt.intervalSec > 1e-6 && hypIn.length >= 2) {
    for (
      let t = window.startSec;
      t < window.endSec - gt.intervalSec * 0.5;
      t += gt.intervalSec
    ) {
      const near = hypIn.filter(
        (h) => Math.abs(h - t) <= gt.intervalSec * 0.55
      );
      if (!near.length) {
        binResiduals.push(Number.POSITIVE_INFINITY);
        continue;
      }
      const best = Math.min(
        ...near.map((h) => gridResidualSec(h, gt.phaseSec, gt.intervalSec))
      );
      binResiduals.push(best);
    }
  }
  const finiteBins = binResiduals.filter((x) => Number.isFinite(x));
  const medBin = median(finiteBins);
  const binsOk = binResiduals.map((r) => {
    if (!Number.isFinite(r) || medBin == null) return false;
    // Stable relative to the song's own median phase offset
    return Math.abs(r - medBin) <= lockTol;
  });
  const lockFraction = binsOk.length
    ? binsOk.filter(Boolean).length / binsOk.length
    : null;
  const continuity = continuityScore(lockFraction);

  const evidence = evidenceScore({
    gtSeedCount: gt.seedCount,
    hypCount: hypIn.length,
    hypCv,
  });

  const axisScores = [
    period.score,
    phase.score,
    continuity.score,
    evidence.score,
  ].filter((x): x is number => x != null);
  const aggregateScore = axisScores.length
    ? mean(axisScores)
    : null;

  if (phase.halfBeatRatio != null && phase.halfBeatRatio >= 0.35) {
    notes.push(
      `phase near half-${kind} (ratio=${phase.halfBeatRatio.toFixed(2)}); treat as phase error not dual-phase GT`
    );
  }
  notes.push(
    `seedDensity ignored for accuracy (gtSeeds=${gt.seedCount}, hypInWindow=${hypIn.length})`
  );

  return {
    status: "OK",
    kind,
    period: {
      gtIntervalSec: gt.intervalSec,
      hypIntervalSec: hypInterval,
      relativeError: periodRel,
      score: period.score,
      verdict: period.verdict,
      octaveHint: oct,
    },
    phase: {
      medianAbsErrorSec: medPhase,
      halfBeatRatio: phase.halfBeatRatio,
      score: phase.score,
      verdict: phase.verdict,
    },
    continuity: {
      lockFraction,
      evaluatedBins: binResiduals.length,
      score: continuity.score,
      verdict: continuity.verdict,
    },
    evidence: {
      gtSeedCount: gt.seedCount,
      hypCountInWindow: hypIn.length,
      hypIntervalCv: hypCv,
      score: evidence.score,
      verdict: evidence.verdict,
    },
    aggregateScore,
    window,
    notes,
  };
}

function emptyPatternScore(
  kind: "beat" | "downbeat",
  gt: DerivedTimingPattern,
  status: "NOT_AVAILABLE" | "EMPTY",
  notes: string[]
): BeatPatternScore {
  return {
    status,
    kind,
    period: {
      gtIntervalSec: gt.intervalSec,
      hypIntervalSec: null,
      relativeError: null,
      score: null,
      verdict: "NOT_AVAILABLE",
      octaveHint: null,
    },
    phase: {
      medianAbsErrorSec: null,
      halfBeatRatio: null,
      score: null,
      verdict: "NOT_AVAILABLE",
    },
    continuity: {
      lockFraction: null,
      evaluatedBins: 0,
      score: null,
      verdict: "NOT_AVAILABLE",
    },
    evidence: {
      gtSeedCount: gt.seedCount,
      hypCountInWindow: 0,
      hypIntervalCv: null,
      score: null,
      verdict: "NOT_AVAILABLE",
    },
    aggregateScore: null,
    window: {
      startSec: gt.patternStartSec,
      endSec: gt.continuationUntilSec,
    },
    notes,
  };
}
