import type { EightCountMetrics } from "../types";
import { evidenceConfidenceFromSampleCount } from "../versions";
import { matchTimesGreedy, mean } from "./matching";

export type EightSpan = {
  startTime: number;
  endTime: number;
};

/**
 * Align 8-count phrases by start times; detect off-by-one-count vs beatDuration.
 */
export function scoreEightCounts(
  ref: EightSpan[] | null | undefined,
  hyp: EightSpan[] | null | undefined,
  beatDurationSec?: number | null
): EightCountMetrics {
  if (!ref?.length) {
    return {
      status: "NOT_AVAILABLE",
      startTimingError: null,
      endTimingError: null,
      countBoundaryError: null,
      phraseAlignmentScore: null,
      offByOneCountRate: null,
      sampleCount: 0,
      evidenceConfidence: "NONE",
    };
  }
  if (!hyp?.length) {
    return {
      status: "EMPTY",
      startTimingError: null,
      endTimingError: null,
      countBoundaryError: null,
      phraseAlignmentScore: 0,
      offByOneCountRate: null,
      sampleCount: ref.length,
      evidenceConfidence: evidenceConfidenceFromSampleCount(ref.length),
    };
  }

  const tol = beatDurationSec && beatDurationSec > 0 ? beatDurationSec * 2 : 0.5;
  const refStarts = ref.map((r) => r.startTime);
  const hypStarts = hyp.map((h) => h.startTime);
  const pairs = matchTimesGreedy(refStarts, hypStarts, tol);

  const startErrs: number[] = [];
  const endErrs: number[] = [];
  let offByOne = 0;
  const bd = beatDurationSec && beatDurationSec > 0 ? beatDurationSec : null;

  for (const p of pairs) {
    const r = ref[p.refIndex]!;
    const h = hyp[p.hypIndex]!;
    startErrs.push(Math.abs(r.startTime - h.startTime));
    endErrs.push(Math.abs(r.endTime - h.endTime));
    if (bd) {
      const drift = Math.abs(r.startTime - h.startTime);
      // one count ≈ one beat; off-by-one if ~1 beat and not near 0
      if (drift > bd * 0.4 && drift < bd * 1.6) offByOne++;
    }
  }

  const aligned = pairs.length / Math.max(ref.length, 1);
  const boundary =
    mean(
      pairs.map((p) => {
        const r = ref[p.refIndex]!;
        const h = hyp[p.hypIndex]!;
        return (
          (Math.abs(r.startTime - h.startTime) +
            Math.abs(r.endTime - h.endTime)) /
          2
        );
      })
    ) ?? null;

  return {
    status: "OK",
    startTimingError: mean(startErrs),
    endTimingError: mean(endErrs),
    countBoundaryError: boundary,
    phraseAlignmentScore: aligned,
    offByOneCountRate: pairs.length ? offByOne / pairs.length : null,
    sampleCount: Math.max(ref.length, hyp.length),
    evidenceConfidence: evidenceConfidenceFromSampleCount(
      Math.max(ref.length, hyp.length)
    ),
  };
}
