/**
 * Phase 4.6 — derive Beat / Downbeat representative patterns from seed arrays.
 * See docs/fly/PHASE46-BEAT-PATTERN-GT.md
 */

import type { RealSongAnnotation } from "./types";

export type TimingPatternKind = "beat" | "downbeat";

export type DerivedTimingPattern = {
  kind: TimingPatternKind;
  patternStartSec: number;
  patternEndSec: number;
  /** Primary tempo from annotation bpm when available */
  bpm: number | null;
  /** Median successive interval in the observed window */
  intervalSec: number;
  /** Phase lock reference = first onset */
  phaseSec: number;
  /** Observed onset count */
  seedCount: number;
  /** Coefficient of variation of successive intervals (0 if <2 intervals) */
  intervalCv: number;
  /**
   * Phase 4.6 default: pattern continues past patternEndSec.
   * Override later via notes / explicit fields if needed.
   */
  continuation: boolean;
  continuationUntilSec: number;
  patternConfidence: number;
};

function uniqSorted(times: number[]): number[] {
  return [...new Set(times.map((t) => Number(t)))]
    .filter((t) => Number.isFinite(t) && t >= 0)
    .sort((a, b) => a - b);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
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
  for (let i = 1; i < times.length; i++) {
    out.push(times[i]! - times[i - 1]!);
  }
  return out;
}

function cv(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  if (m <= 1e-9) return 0;
  const v = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(v) / m;
}

export function deriveTimingPattern(
  kind: TimingPatternKind,
  seeds: number[],
  opts: {
    bpm: number | null;
    durationSec: number;
    bpmConfidence?: number;
    continuation?: boolean;
    continuationUntilSec?: number | null;
  }
): DerivedTimingPattern | null {
  const times = uniqSorted(seeds);
  if (!times.length) return null;

  const intervals = successiveIntervals(times);
  const bpm = opts.bpm != null && opts.bpm > 0 ? opts.bpm : null;
  const fromBpm = bpm != null ? 60 / bpm : null;
  const intervalSec =
    intervals.length > 0 ? median(intervals) : fromBpm ?? 0.5;
  const start = times[0]!;
  const end = times[times.length - 1]!;
  const continuation = opts.continuation !== false;
  const until =
    opts.continuationUntilSec != null && opts.continuationUntilSec > end
      ? opts.continuationUntilSec
      : continuation
        ? opts.durationSec
        : end;

  const iCv = cv(intervals);
  // Confidence: stable intervals + agreement with BPM
  let conf = opts.bpmConfidence ?? 0.85;
  if (intervals.length >= 3) {
    conf = Math.max(0.4, Math.min(0.99, conf * (1 - Math.min(0.5, iCv))));
  }
  if (fromBpm != null && intervalSec > 0) {
    const rel = Math.abs(intervalSec - fromBpm) / fromBpm;
    if (rel > 0.08) conf = Math.min(conf, 0.55);
  }

  return {
    kind,
    patternStartSec: start,
    patternEndSec: end,
    bpm,
    intervalSec,
    phaseSec: start,
    seedCount: times.length,
    intervalCv: iCv,
    continuation,
    continuationUntilSec: Math.min(until, opts.durationSec),
    patternConfidence: conf,
  };
}

export function deriveBeatPattern(
  annotation: RealSongAnnotation,
  durationSec: number
): DerivedTimingPattern | null {
  return deriveTimingPattern("beat", annotation.beats, {
    bpm: annotation.bpm,
    durationSec,
    bpmConfidence: annotation.bpmConfidence,
  });
}

export function deriveDownbeatPattern(
  annotation: RealSongAnnotation,
  durationSec: number
): DerivedTimingPattern | null {
  return deriveTimingPattern("downbeat", annotation.downbeats, {
    bpm: annotation.bpm,
    durationSec,
    bpmConfidence: annotation.bpmConfidence,
  });
}

/** Relative error of median beat IOI vs 60/bpm; null if cannot compare */
export function beatIntervalVsBpmError(
  pattern: DerivedTimingPattern
): number | null {
  if (pattern.bpm == null || pattern.bpm <= 0 || pattern.intervalSec <= 0) {
    return null;
  }
  const expect = 60 / pattern.bpm;
  return Math.abs(pattern.intervalSec - expect) / expect;
}

export type PatternAuditStatus = "PASS" | "REVIEW" | "FAIL";

export function auditBeatPattern(
  pattern: DerivedTimingPattern | null
): { status: PatternAuditStatus; reasons: string[] } {
  if (!pattern) return { status: "FAIL", reasons: ["no beats"] };
  const reasons: string[] = [];
  if (pattern.seedCount < 8) {
    reasons.push(`seedCount ${pattern.seedCount} < 8`);
    return { status: "FAIL", reasons };
  }
  const err = beatIntervalVsBpmError(pattern);
  if (err != null && err > 0.08) {
    reasons.push(`IOI vs BPM relErr ${(err * 100).toFixed(1)}%`);
    return { status: "REVIEW", reasons };
  }
  if (pattern.intervalCv > 0.2) {
    reasons.push(`interval CV ${pattern.intervalCv.toFixed(3)} high`);
    return { status: "REVIEW", reasons };
  }
  if (pattern.seedCount < 12) {
    reasons.push("short seed (ok if stable)");
    return { status: "REVIEW", reasons };
  }
  return { status: "PASS", reasons: ["representative pattern"] };
}

export function auditDownbeatPattern(
  pattern: DerivedTimingPattern | null,
  beat: DerivedTimingPattern | null
): { status: PatternAuditStatus; reasons: string[] } {
  if (!pattern) return { status: "FAIL", reasons: ["no downbeats"] };
  const reasons: string[] = [];
  if (pattern.seedCount < 1) {
    return { status: "FAIL", reasons: ["empty"] };
  }
  if (beat && beat.intervalSec > 0 && pattern.intervalSec > 0) {
    const ratio = pattern.intervalSec / beat.intervalSec;
    // 4/4 bar ≈ 4 beats; allow 2 (half-bar feel) or 8
    const near4 = Math.abs(ratio - 4) / 4;
    const near2 = Math.abs(ratio - 2) / 2;
    const near8 = Math.abs(ratio - 8) / 8;
    if (Math.min(near4, near2, near8) > 0.2) {
      reasons.push(`bar/beat ratio ${ratio.toFixed(2)} unusual`);
      return { status: "REVIEW", reasons };
    }
  }
  // Different observed windows vs Beat Pattern are allowed (PHASE46-BEAT-PATTERN-GT).
  if (pattern.seedCount < 4) {
    reasons.push("sparse downbeats");
    return { status: "REVIEW", reasons };
  }
  return { status: "PASS", reasons: ["representative bar pattern"] };
}
