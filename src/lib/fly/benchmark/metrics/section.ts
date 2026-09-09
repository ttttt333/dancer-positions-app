import type { SectionMetrics } from "../types";
import { evidenceConfidenceFromSampleCount } from "../versions";
import { f1, mean } from "./matching";

export type SectionSpan = {
  startTime: number;
  endTime: number;
  label: string;
};

function iou(a: SectionSpan, b: SectionSpan): number {
  const start = Math.max(a.startTime, b.startTime);
  const end = Math.min(a.endTime, b.endTime);
  const inter = Math.max(0, end - start);
  const union =
    Math.max(a.endTime, b.endTime) - Math.min(a.startTime, b.startTime);
  if (union <= 0) return 0;
  return inter / union;
}

function normalizeLabel(l: string): string {
  return l.trim().toUpperCase().replace(/-/g, "_");
}

/**
 * Match each ref section to best-IoU hyp section (1:1 greedy by IoU desc).
 */
export function scoreSections(
  ref: SectionSpan[] | null | undefined,
  hyp: SectionSpan[] | null | undefined
): SectionMetrics {
  if (!ref?.length) {
    return {
      status: "NOT_AVAILABLE",
      labelPrecision: null,
      labelRecall: null,
      labelF1: null,
      meanBoundaryError: null,
      meanIoU: null,
      nRef: 0,
      nHyp: hyp?.length ?? 0,
      sampleCount: 0,
      evidenceConfidence: "NONE",
    };
  }
  if (!hyp?.length) {
    return {
      status: "EMPTY",
      labelPrecision: 0,
      labelRecall: 0,
      labelF1: 0,
      meanBoundaryError: null,
      meanIoU: 0,
      nRef: ref.length,
      nHyp: 0,
      sampleCount: ref.length,
      evidenceConfidence: evidenceConfidenceFromSampleCount(ref.length),
    };
  }

  const candidates: Array<{ ri: number; hi: number; iou: number }> = [];
  for (let ri = 0; ri < ref.length; ri++) {
    for (let hi = 0; hi < hyp.length; hi++) {
      candidates.push({ ri, hi, iou: iou(ref[ri]!, hyp[hi]!) });
    }
  }
  candidates.sort((a, b) => b.iou - a.iou);
  const usedR = new Set<number>();
  const usedH = new Set<number>();
  const matches: typeof candidates = [];
  for (const c of candidates) {
    if (c.iou <= 0) break;
    if (usedR.has(c.ri) || usedH.has(c.hi)) continue;
    usedR.add(c.ri);
    usedH.add(c.hi);
    matches.push(c);
  }

  let labelHits = 0;
  const boundaryErrors: number[] = [];
  const ious: number[] = [];
  for (const m of matches) {
    const r = ref[m.ri]!;
    const h = hyp[m.hi]!;
    if (normalizeLabel(r.label) === normalizeLabel(h.label)) labelHits++;
    boundaryErrors.push(
      (Math.abs(r.startTime - h.startTime) + Math.abs(r.endTime - h.endTime)) / 2
    );
    ious.push(m.iou);
  }

  const precision = hyp.length > 0 ? labelHits / hyp.length : 0;
  const recall = ref.length > 0 ? labelHits / ref.length : 0;

  return {
    status: "OK",
    labelPrecision: precision,
    labelRecall: recall,
    labelF1: f1(precision, recall),
    meanBoundaryError: mean(boundaryErrors),
    meanIoU: mean(ious),
    nRef: ref.length,
    nHyp: hyp.length,
    sampleCount: Math.max(ref.length, hyp.length),
    evidenceConfidence: evidenceConfidenceFromSampleCount(
      Math.max(ref.length, hyp.length)
    ),
  };
}
