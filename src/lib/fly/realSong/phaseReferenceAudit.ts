/**
 * PHASE 4.6-C — Common Phase Reference Audit helpers.
 * Measurement only: signed phase, half-beat bins, analyzer agreement.
 * No Fusion / MSAF / GT edits.
 */

export type HalfBeatBin =
  | "NEAR_0"
  | "NEAR_PLUS_HALF"
  | "NEAR_MINUS_HALF"
  | "NEAR_QUARTER"
  | "OTHER";

export type PhaseRelationClass =
  | "BOTH_NEAR_GT"
  | "BOTH_OFF_AGREE" // librosa ≈ madmom, both off GT → reference/definition suspect
  | "LIBROSA_CLOSER"
  | "MADMOM_CLOSER"
  | "BOTH_OFF_DISAGREE"
  | "INSUFFICIENT";

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

function successiveIntervals(times: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < times.length; i++) out.push(times[i]! - times[i - 1]!);
  return out;
}

/** Fold into (-interval/2, interval/2] */
export function signedPhaseResidualSec(
  t: number,
  phase0: number,
  interval: number
): number {
  if (interval <= 1e-9) return t - phase0;
  let r = ((t - phase0) % interval) + interval;
  r = r % interval;
  if (r > interval / 2) r -= interval;
  if (r <= -interval / 2) r += interval;
  return r;
}

export function classifyHalfBeatBin(
  signedSec: number,
  interval: number
): HalfBeatBin {
  if (interval <= 1e-9) return "OTHER";
  const ratio = signedSec / interval; // (-0.5, 0.5]
  const a = Math.abs(ratio);
  if (a <= 0.12) return "NEAR_0";
  // half-beat band: |offset| ≳ 0.35 of IOI (≈ ≥170ms at 120BPM)
  if (a >= 0.35) {
    return ratio >= 0 ? "NEAR_PLUS_HALF" : "NEAR_MINUS_HALF";
  }
  if (Math.abs(a - 0.25) <= 0.07) return "NEAR_QUARTER";
  return "OTHER";
}

export type PhaseOffsetSummary = {
  phase0Sec: number;
  intervalSec: number;
  /** Median of signed residuals (direction; can cancel if phase wanders) */
  medianSignedSec: number | null;
  /** Median of |signed residuals| — magnitude of phase error */
  medianAbsSec: number | null;
  /** medianSigned / interval */
  medianSignedBeats: number | null;
  halfBeatBin: HalfBeatBin | "EMPTY";
  sampleCount: number;
  /** Circular std-ish of signed residuals / interval */
  phaseSpreadBeats: number | null;
  signMix: { plus: number; minus: number; near0: number };
};

export function summarizePhaseOffset(
  hypTimes: number[],
  phase0: number,
  interval: number,
  window?: { startSec: number; endSec: number }
): PhaseOffsetSummary {
  const all = uniqSorted(hypTimes);
  const times = window
    ? all.filter((t) => t >= window.startSec - 1e-6 && t <= window.endSec + 1e-6)
    : all;
  const residuals = times.map((t) =>
    signedPhaseResidualSec(t, phase0, interval)
  );
  const absResiduals = residuals.map((r) => Math.abs(r));
  const med = median(residuals);
  const absMed = median(absResiduals);
  let spread: number | null = null;
  if (residuals.length >= 2 && interval > 0) {
    const m = med ?? 0;
    const var_ =
      residuals.reduce((a, r) => a + (r - m) ** 2, 0) / residuals.length;
    spread = Math.sqrt(var_) / interval;
  }
  const pos = residuals.filter((r) => r > 0.04).length;
  const neg = residuals.filter((r) => r < -0.04).length;
  return {
    phase0Sec: phase0,
    intervalSec: interval,
    medianSignedSec: med,
    medianAbsSec: absMed,
    medianSignedBeats: med == null || interval <= 0 ? null : med / interval,
    halfBeatBin:
      // Prefer abs-median for half-beat magnitude; signed for direction label
      absMed == null
        ? "EMPTY"
        : classifyHalfBeatBin(
            // reconstruct directional half using signed median sign
            (med ?? 0) >= 0 ? absMed : -absMed,
            interval
          ),
    sampleCount: residuals.length,
    phaseSpreadBeats: spread,
    signMix: { plus: pos, minus: neg, near0: residuals.length - pos - neg },
  };
}

export function deriveIntervalAndPhase0(seeds: number[], bpm: number | null): {
  intervalSec: number;
  phase0Sec: number;
  seedCount: number;
} | null {
  const times = uniqSorted(seeds);
  if (!times.length) return null;
  const intervals = successiveIntervals(times);
  const fromBpm = bpm != null && bpm > 0 ? 60 / bpm : null;
  const intervalSec =
    intervals.length > 0
      ? median(intervals) ?? fromBpm ?? 0.5
      : fromBpm ?? 0.5;
  return {
    intervalSec,
    phase0Sec: times[0]!,
    seedCount: times.length,
  };
}

/** Circular distance between two signed phase offsets (same interval) */
export function circularPhaseDistanceSec(
  a: number,
  b: number,
  interval: number
): number {
  return Math.abs(signedPhaseResidualSec(a, b, interval));
}

export function classifyAnalyzerRelation(opts: {
  librosaAbsSec: number | null;
  madmomAbsSec: number | null;
  analyzerAgreeSec: number | null;
  nearGtSec?: number;
  agreeSec?: number;
}): PhaseRelationClass {
  const near = opts.nearGtSec ?? 0.04;
  const agree = opts.agreeSec ?? 0.05;
  const L = opts.librosaAbsSec;
  const M = opts.madmomAbsSec;
  const AM = opts.analyzerAgreeSec;
  if (L == null || M == null || AM == null) return "INSUFFICIENT";

  const lNear = L <= near;
  const mNear = M <= near;
  if (lNear && mNear) return "BOTH_NEAR_GT";
  if (AM <= agree && !lNear && !mNear) return "BOTH_OFF_AGREE";
  if (lNear && !mNear) return "LIBROSA_CLOSER";
  if (mNear && !lNear) return "MADMOM_CLOSER";
  if (L + 0.02 < M) return "LIBROSA_CLOSER";
  if (M + 0.02 < L) return "MADMOM_CLOSER";
  if (AM <= agree) return "BOTH_OFF_AGREE";
  return "BOTH_OFF_DISAGREE";
}

export type CountGridPhaseLink = {
  countGridStartSec: number | null;
  offsetFromGtBeatSec: number | null;
  offsetBeats: number | null;
  halfBeatBin: HalfBeatBin | "EMPTY" | "NO_COUNTGRID";
};
