import { scoreBeats } from "../benchmark/metrics";
import type {
  GroundTruthSection,
  HumanAgreementReport,
  MusicalChange,
  RealSongAnnotation,
} from "./types";
import { median } from "../benchmark/metrics/matching";

function normalizeLabel(l: string): string {
  return l.trim().toUpperCase();
}

function matchSectionBoundaries(
  a: GroundTruthSection[],
  b: GroundTruthSection[]
): number[] {
  const errors: number[] = [];
  const used = new Set<number>();
  for (const sa of a) {
    let best = -1;
    let bestErr = Infinity;
    for (let j = 0; j < b.length; j++) {
      if (used.has(j)) continue;
      const err = Math.abs(sa.startSec - b[j]!.startSec);
      if (err < bestErr) {
        bestErr = err;
        best = j;
      }
    }
    if (best >= 0) {
      used.add(best);
      errors.push(bestErr * 1000);
    }
  }
  return errors;
}

function sectionLabelAgreement(
  a: GroundTruthSection[],
  b: GroundTruthSection[]
): number | null {
  if (!a.length || !b.length) return null;
  const used = new Set<number>();
  let hits = 0;
  let compared = 0;
  for (const sa of a) {
    let best = -1;
    let bestIou = 0;
    for (let j = 0; j < b.length; j++) {
      if (used.has(j)) continue;
      const sb = b[j]!;
      const start = Math.max(sa.startSec, sb.startSec);
      const end = Math.min(sa.endSec, sb.endSec);
      const inter = Math.max(0, end - start);
      const union =
        Math.max(sa.endSec, sb.endSec) - Math.min(sa.startSec, sb.startSec);
      const iou = union > 0 ? inter / union : 0;
      if (iou > bestIou) {
        bestIou = iou;
        best = j;
      }
    }
    if (best >= 0 && bestIou > 0) {
      used.add(best);
      compared++;
      if (normalizeLabel(sa.label) === normalizeLabel(b[best]!.label)) hits++;
    }
  }
  return compared > 0 ? hits / compared : null;
}

function musicalChangeAgreement(
  a: MusicalChange[] | undefined,
  b: MusicalChange[] | undefined,
  tolSec = 0.25
): number | null {
  if (!a?.length && !b?.length) return null;
  if (!a?.length || !b?.length) return 0;
  let matched = 0;
  const used = new Set<number>();
  for (const x of a) {
    let best = -1;
    let bestErr = Infinity;
    for (let j = 0; j < b.length; j++) {
      if (used.has(j)) continue;
      const err = Math.abs(x.timeSec - b[j]!.timeSec);
      if (err <= tolSec && err < bestErr) {
        bestErr = err;
        best = j;
      }
    }
    if (best >= 0) {
      used.add(best);
      matched++;
    }
  }
  return matched / Math.max(a.length, b.length);
}

export function computeHumanAgreement(
  a: RealSongAnnotation,
  b: RealSongAnnotation
): HumanAgreementReport {
  const boundaryMs = matchSectionBoundaries(a.sections, b.sections);
  const beat = scoreBeats(a.beats, b.beats);
  const bpmErr =
    a.bpm != null && b.bpm != null ? Math.abs(a.bpm - b.bpm) : null;

  return {
    songId: a.songId,
    annotatorA: a.annotatorId,
    annotatorB: b.annotatorId,
    sectionBoundaryMedianMs: median(boundaryMs),
    sectionLabelAgreement: sectionLabelAgreement(a.sections, b.sections),
    beatAgreementF1At40ms: beat.byThreshold["40"]?.f1 ?? null,
    bpmAbsoluteError: bpmErr,
    musicalChangeAgreement: musicalChangeAgreement(
      a.musicalChanges,
      b.musicalChanges
    ),
  };
}
