/**
 * PHASE 4.6-D — Dance Phase Origin Audit helpers (probes A–G).
 * Hypothesis testing only — never auto-adopt lowest error as truth.
 */

import { signedPhaseResidualSec } from "./phaseReferenceAudit";

export type OriginProbeId =
  | "A_BEAT_AS_0"
  | "B_DOWNBEAT_AS_0"
  | "C_COUNTGRID_AS_0"
  | "D_QUARTER_BEAT"
  | "E_HALF_BEAT"
  | "F_SECTION_OR_MC"
  | "G_PER_SONG_STRUCTURE";

export type ProbeFit = {
  probeId: OriginProbeId;
  /** Signed residual DancePhaseProxy − candidate (seconds), folded when circular */
  signedSec: number | null;
  absSec: number | null;
  absBeats: number | null;
  /** Human-readable detail */
  detail: string;
  available: boolean;
};

export type QuarterHalfFit = {
  bestSignedSec: number | null;
  bestAbsSec: number | null;
  bestAbsBeats: number | null;
  bestOffsetBeats: number | null; // -0.5,-0.25,0.25,0.5 etc.
  detail: string;
};

function nearestAbs(
  candidates: Array<{ signed: number; label: string; offsetBeats?: number }>
): QuarterHalfFit {
  if (!candidates.length) {
    return {
      bestSignedSec: null,
      bestAbsSec: null,
      bestAbsBeats: null,
      bestOffsetBeats: null,
      detail: "none",
    };
  }
  let best = candidates[0]!;
  for (const c of candidates.slice(1)) {
    if (Math.abs(c.signed) < Math.abs(best.signed)) best = c;
  }
  return {
    bestSignedSec: best.signed,
    bestAbsSec: Math.abs(best.signed),
    bestAbsBeats: null,
    bestOffsetBeats: best.offsetBeats ?? null,
    detail: best.label,
  };
}

/** Circular distance from danceOrigin to refPhase0 */
export function offsetFromRef(
  danceOriginSec: number,
  refPhase0Sec: number,
  intervalSec: number
): { signedSec: number; absSec: number; absBeats: number } {
  const signed = signedPhaseResidualSec(
    danceOriginSec,
    refPhase0Sec,
    intervalSec
  );
  return {
    signedSec: signed,
    absSec: Math.abs(signed),
    absBeats: intervalSec > 0 ? Math.abs(signed) / intervalSec : 0,
  };
}

/** Probe D/E: dance origin vs beat phase0 ± k * interval */
export function fitFractionalBeat(
  danceOriginSec: number,
  beatPhase0Sec: number,
  intervalSec: number,
  fractions: number[]
): QuarterHalfFit {
  const cands = fractions.map((f) => {
    const target = beatPhase0Sec + f * intervalSec;
    const signed = signedPhaseResidualSec(
      danceOriginSec,
      target,
      intervalSec
    );
    return {
      signed,
      label: `Beat${f >= 0 ? "+" : ""}${f}`,
      offsetBeats: f,
    };
  });
  const fit = nearestAbs(cands);
  if (fit.bestAbsSec != null && intervalSec > 0) {
    fit.bestAbsBeats = fit.bestAbsSec / intervalSec;
  }
  return fit;
}

/** Nearest section boundary or musical change to dance origin */
export function nearestFormCue(
  danceOriginSec: number,
  sectionBounds: number[],
  mcTimes: number[]
): {
  kind: "SECTION_BOUNDARY" | "MUSICAL_CHANGE" | "NONE";
  timeSec: number | null;
  absSec: number | null;
  detail: string;
} {
  const pool: Array<{ t: number; kind: "SECTION_BOUNDARY" | "MUSICAL_CHANGE" }> =
    [
      ...sectionBounds.map((t) => ({
        t,
        kind: "SECTION_BOUNDARY" as const,
      })),
      ...mcTimes.map((t) => ({ t, kind: "MUSICAL_CHANGE" as const })),
    ];
  if (!pool.length) {
    return {
      kind: "NONE",
      timeSec: null,
      absSec: null,
      detail: "no section/MC cues",
    };
  }
  let best = pool[0]!;
  let bestAbs = Math.abs(danceOriginSec - best.t);
  for (const p of pool.slice(1)) {
    const a = Math.abs(danceOriginSec - p.t);
    if (a < bestAbs) {
      best = p;
      bestAbs = a;
    }
  }
  return {
    kind: best.kind,
    timeSec: best.t,
    absSec: bestAbs,
    detail: `${best.kind}@${best.t.toFixed(3)} Δ=${(bestAbs * 1000).toFixed(0)}ms`,
  };
}

export type OriginHypothesisLabel =
  | "COUNTGRID_EQUALS_BEAT" // proxy collapses into Music Beat phase0
  | "COUNTGRID_NEAR_BEAT"
  | "COUNTGRID_NEAR_DOWNBEAT"
  | "COUNTGRID_QUARTER_OFFSET"
  | "COUNTGRID_HALF_OFFSET"
  | "COUNTGRID_NEAR_FORM_CUE"
  | "COUNTGRID_BEAT_AND_DOWN_ALIGNED" // Beat≈Down≈CountGrid (common when count1 is bar1)
  | "MIXED_OR_UNCLEAR"
  | "PROXY_ONLY";

/**
 * Suggest a *hypothesis label* for human review — NOT auto-adoption.
 * Thresholds are diagnostic, not production policy.
 */
export function hypothesizeOriginStructure(opts: {
  beatAbsBeats: number | null;
  downAbsBeats: number | null;
  quarterAbsBeats: number | null;
  halfAbsBeats: number | null;
  formAbsSec: number | null;
  nearBeats?: number;
  equalBeats?: number;
  nearFormSec?: number;
}): { label: OriginHypothesisLabel; rationale: string } {
  const near = opts.nearBeats ?? 0.12;
  const equal = opts.equalBeats ?? 0.02;
  const nearForm = opts.nearFormSec ?? 0.15;

  const beatEq =
    opts.beatAbsBeats != null && opts.beatAbsBeats <= equal;
  const downEq =
    opts.downAbsBeats != null && opts.downAbsBeats <= equal;
  const beatNear =
    opts.beatAbsBeats != null && opts.beatAbsBeats <= near;
  const downNear =
    opts.downAbsBeats != null && opts.downAbsBeats <= near;

  // Meta: CountGrid is encoded as Music Beat phase0 → L3 proxy cannot separate layers
  if (beatEq && downEq) {
    return {
      label: "COUNTGRID_BEAT_AND_DOWN_ALIGNED",
      rationale:
        "CountGrid ≈ Beat phase0 ≈ Downbeat phase0 — dance count-1 is currently identical to musical bar/beat origin; L2/L3 not separable from this proxy alone",
    };
  }
  if (beatEq) {
    return {
      label: "COUNTGRID_EQUALS_BEAT",
      rationale:
        "CountGrid ≈ Beat phase0 (≤0.02 beat) — provisional Dance Phase origin collapses into Music Beat Reference",
    };
  }

  const scores: Array<{
    label: OriginHypothesisLabel;
    score: number;
    why: string;
  }> = [];

  if (beatNear) {
    scores.push({
      label: "COUNTGRID_NEAR_BEAT",
      score: 1 - (opts.beatAbsBeats ?? 1),
      why: `CountGrid within ${opts.beatAbsBeats!.toFixed(2)} beat of Beat phase0`,
    });
  }
  if (downNear) {
    scores.push({
      label: "COUNTGRID_NEAR_DOWNBEAT",
      score: 1 - (opts.downAbsBeats ?? 1),
      why: `CountGrid within ${opts.downAbsBeats!.toFixed(2)} beat of Downbeat phase0`,
    });
  }
  if (
    opts.quarterAbsBeats != null &&
    opts.quarterAbsBeats <= near &&
    !beatNear
  ) {
    scores.push({
      label: "COUNTGRID_QUARTER_OFFSET",
      score: 0.85 - opts.quarterAbsBeats,
      why: `Best explained as ±1/4 beat from Beat (${opts.quarterAbsBeats.toFixed(2)} beat residual)`,
    });
  }
  if (
    opts.halfAbsBeats != null &&
    opts.halfAbsBeats <= near &&
    !beatNear
  ) {
    scores.push({
      label: "COUNTGRID_HALF_OFFSET",
      score: 0.8 - opts.halfAbsBeats,
      why: `Best explained as ±1/2 beat from Beat (${opts.halfAbsBeats.toFixed(2)} beat residual)`,
    });
  }
  if (opts.formAbsSec != null && opts.formAbsSec <= nearForm) {
    scores.push({
      label: "COUNTGRID_NEAR_FORM_CUE",
      score: 0.55 - opts.formAbsSec,
      why: `CountGrid near Section/MC (Δ=${(opts.formAbsSec * 1000).toFixed(0)}ms)`,
    });
  }

  if (!scores.length) {
    return {
      label: "MIXED_OR_UNCLEAR",
      rationale:
        "No single probe clearly explains CountGrid as Dance Phase origin under diagnostic thresholds",
    };
  }
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0]!;
  const second = scores[1];
  if (second && top.score - second.score < 0.05) {
    return {
      label: "MIXED_OR_UNCLEAR",
      rationale: `Ambiguous between ${top.label} and ${second.label}`,
    };
  }
  return { label: top.label, rationale: top.why };
}
