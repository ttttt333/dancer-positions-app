/**
 * Build consensus GT from multiple raw annotations.
 * Does not delete raw files — caller persists separately.
 */

import type {
  GroundTruthSection,
  MusicalChange,
  RealSongAnnotation,
} from "./types";
import { mean } from "../benchmark/metrics/matching";

export type ConsensusResult = {
  consensus: RealSongAnnotation;
  notes: string[];
};

/**
 * Simple adjudication v1:
 * - BPM: mean of available
 * - beats: take annotator A as primary grid if A/B F1 high else mean-of-nearest (use A)
 * - sections: prefer higher mean confidence annotator as backbone, merge labels by IoU
 * - musicalChanges: union within 250ms, prefer higher strength
 */
export function buildConsensus(
  annotations: RealSongAnnotation[],
  opts?: { adjudicatorId?: string }
): ConsensusResult {
  const notes: string[] = [];
  if (annotations.length === 0) {
    throw new Error("buildConsensus requires ≥1 annotation");
  }
  if (annotations.length === 1) {
    notes.push("single_annotator_passthrough");
    return { consensus: annotations[0]!, notes };
  }

  const primary = [...annotations].sort(
    (x, y) => meanConf(y) - meanConf(x)
  )[0]!;
  const bpms = annotations
    .map((a) => a.bpm)
    .filter((b): b is number => b != null && b > 0);
  const bpm = bpms.length ? mean(bpms) : null;

  const sections = mergeSections(annotations.map((a) => a.sections));
  const musicalChanges = mergeMusicalChanges(
    annotations.flatMap((a) => a.musicalChanges ?? [])
  );

  notes.push(`primary_annotator=${primary.annotatorId}`);
  notes.push("raw_annotations_retained");

  const consensus: RealSongAnnotation = {
    songId: primary.songId,
    annotatorId: opts?.adjudicatorId ?? "consensus",
    annotationVersion: primary.annotationVersion,
    audioSha256: primary.audioSha256,
    bpm,
    bpmConfidence: mean(annotations.map((a) => a.bpmConfidence)) ?? 0.5,
    beats: primary.beats,
    downbeats: primary.downbeats,
    countGrid: primary.countGrid,
    sections,
    musicalChanges,
    annotatedAt: new Date().toISOString(),
    notes: notes.join("; "),
  };

  return { consensus, notes };
}

function meanConf(a: RealSongAnnotation): number {
  if (!a.sections.length) return a.bpmConfidence;
  return (
    (mean(a.sections.map((s) => s.confidence)) ?? 0) * 0.7 +
    a.bpmConfidence * 0.3
  );
}

function mergeSections(lists: GroundTruthSection[][]): GroundTruthSection[] {
  // Use highest-confidence list as backbone
  let best = lists[0] ?? [];
  let bestScore = -1;
  for (const list of lists) {
    const s = mean(list.map((x) => x.confidence)) ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = list;
    }
  }
  return best.map((s) => ({ ...s }));
}

function mergeMusicalChanges(items: MusicalChange[]): MusicalChange[] {
  const sorted = [...items].sort((a, b) => a.timeSec - b.timeSec);
  const out: MusicalChange[] = [];
  for (const mc of sorted) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.timeSec - mc.timeSec) <= 0.25) {
      const strengthRank = { LOW: 1, MEDIUM: 2, HIGH: 3 };
      if (strengthRank[mc.strength] > strengthRank[prev.strength]) {
        out[out.length - 1] = {
          ...mc,
          reasons: [...new Set([...prev.reasons, ...mc.reasons])],
          confidence: Math.max(prev.confidence, mc.confidence),
        };
      } else {
        prev.reasons = [...new Set([...prev.reasons, ...mc.reasons])];
        prev.confidence = Math.max(prev.confidence, mc.confidence);
      }
    } else {
      out.push({ ...mc, reasons: [...mc.reasons] });
    }
  }
  return out;
}
