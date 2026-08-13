import type { HumanCueAnnotation, HumanFormationRating, HumanSequenceRating } from "../types/EvaluationTypes";
import type {
  ConsensusReviewItem,
  HumanCeiling,
  HumanCeilingRatio,
  HumanFormationTop3,
  RealSongAnnotations,
} from "../types/RealWorldTypes";
import { humanCueAgreement, humanFormationAgreement } from "../evaluation/HumanRatingEvaluator";
import { clamp, mean, pearson } from "../evaluation/EvaluationMetrics";

function annotatorIds(annotations: RealSongAnnotations[]): string[] {
  return [...new Set(annotations.map((a) => a.annotatorId))].sort();
}

function byAnnotator(annotations: RealSongAnnotations[]): Map<string, RealSongAnnotations[]> {
  const map = new Map<string, RealSongAnnotations[]>();
  for (const ann of annotations) {
    const list = map.get(ann.annotatorId) ?? [];
    list.push(ann);
    map.set(ann.annotatorId, list);
  }
  return map;
}

function flattenCues(rows: RealSongAnnotations[]): HumanCueAnnotation[] {
  return rows.flatMap((r) => r.cues);
}

function flattenFormations(rows: RealSongAnnotations[]): HumanFormationRating[] {
  return rows.flatMap((r) => r.formations);
}

function flattenSequence(rows: RealSongAnnotations[]): HumanSequenceRating[] {
  return rows.flatMap((r) => r.sequence);
}

function top3Overlap(a: HumanFormationTop3[], b: HumanFormationTop3[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const bByCue = new Map(b.map((row) => [row.cueId, row]));
  const scores: number[] = [];
  for (const left of a) {
    const right = bByCue.get(left.cueId);
    if (!right) continue;
    const topA = [...left.ranks].sort((x, y) => x.rank - y.rank)[0]?.formationType;
    const top3B = new Set(right.ranks.map((r) => r.formationType));
    const topB = [...right.ranks].sort((x, y) => x.rank - y.rank)[0]?.formationType;
    const top3A = new Set(left.ranks.map((r) => r.formationType));
    if (!topA || !topB) continue;
    const ab = top3B.has(topA) ? 1 : 0;
    const ba = top3A.has(topB) ? 1 : 0;
    scores.push((ab + ba) / 2);
  }
  if (scores.length === 0) {
    return humanFormationAgreement(flattenFormationsFromTop3(a), flattenFormationsFromTop3(b)).correlation;
  }
  return mean(scores);
}

function flattenFormationsFromTop3(rows: HumanFormationTop3[]): HumanFormationRating[] {
  return rows.flatMap((row) =>
    row.ranks.map((rank) => ({
      songId: row.songId,
      cueId: row.cueId,
      annotatorId: row.annotatorId,
      formationType: rank.formationType,
      score: rank.score,
      musicFit: row.musicFit,
      visualImpact: row.visualImpact,
      transitionQuality: row.transitionQuality,
      execution: row.execution,
      originality: row.originality,
      overall: row.overall,
    }))
  );
}

function sequenceAgreement(a: HumanSequenceRating[], b: HumanSequenceRating[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  if (n === 1) {
    const gap = Math.abs(a[0]!.overall - b[0]!.overall);
    return clamp(1 - gap / 50, 0, 1);
  }
  return clamp((pearson(
    a.slice(0, n).map((r) => r.overall),
    b.slice(0, n).map((r) => r.overall)
  ) + 1) / 2, 0, 1);
}

export function pairwiseAnnotators(ids: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairs.push([ids[i]!, ids[j]!]);
    }
  }
  return pairs;
}

export function calculateHumanCeiling(
  annotations: RealSongAnnotations[],
  bpm = 120,
  matchingBeats = 1
): HumanCeiling {
  const songs = [...new Set(annotations.map((a) => a.songId))].sort();
  const cueRates: number[] = [];
  const formRates: number[] = [];
  const seqRates: number[] = [];
  let pairs = 0;
  for (const songId of songs) {
    const rows = annotations.filter((a) => a.songId === songId);
    const ids = annotatorIds(rows);
    const grouped = byAnnotator(rows);
    for (const [leftId, rightId] of pairwiseAnnotators(ids)) {
      const left = grouped.get(leftId) ?? [];
      const right = grouped.get(rightId) ?? [];
      cueRates.push(humanCueAgreement(flattenCues(left), flattenCues(right), bpm, matchingBeats).matchRate);
      const top3A = left.flatMap((r) => r.formationTop3 ?? []);
      const top3B = right.flatMap((r) => r.formationTop3 ?? []);
      if (top3A.length > 0 || top3B.length > 0) {
        formRates.push(top3Overlap(top3A, top3B));
      } else {
        formRates.push(humanFormationAgreement(flattenFormations(left), flattenFormations(right)).correlation);
      }
      seqRates.push(sequenceAgreement(flattenSequence(left), flattenSequence(right)));
      pairs += 1;
    }
  }
  if (pairs === 0) {
    return { cueMatchRate: 0, formationTop3: 0, sequenceCorrelation: 0, overall: 0, pairs: 0 };
  }
  const cueMatchRate = mean(cueRates);
  const formationTop3 = mean(formRates);
  const sequenceCorrelation = mean(seqRates);
  return {
    cueMatchRate,
    formationTop3,
    sequenceCorrelation,
    overall: mean([cueMatchRate, formationTop3, sequenceCorrelation]),
    pairs,
  };
}

export function calculateHumanCeilingRatio(
  aiHuman: { cue: number; formationTop3: number; sequence: number; overall: number },
  ceiling: HumanCeiling
): HumanCeilingRatio {
  const ratio = (ai: number, human: number) => (human <= 1e-9 ? (ai <= 1e-9 ? 1 : 0) : ai / human);
  return {
    cue: ratio(aiHuman.cue, ceiling.cueMatchRate),
    formationTop3: ratio(aiHuman.formationTop3, ceiling.formationTop3),
    sequence: ratio(aiHuman.sequence, ceiling.sequenceCorrelation),
    overall: ratio(aiHuman.overall, ceiling.overall),
  };
}

export function groundTruthConfidence(ceilingOverall: number): "HIGH" | "MEDIUM" | "LOW" {
  if (ceilingOverall >= 0.8) return "HIGH";
  if (ceilingOverall >= 0.5) return "MEDIUM";
  return "LOW";
}

export function findConsensusReviews(annotations: RealSongAnnotations[]): ConsensusReviewItem[] {
  const out: ConsensusReviewItem[] = [];
  const songs = [...new Set(annotations.map((a) => a.songId))].sort();
  for (const songId of songs) {
    const rows = annotations.filter((a) => a.songId === songId);
    const cueIds = [...new Set(rows.flatMap((r) => (r.formationTop3 ?? []).map((t) => t.cueId)))].sort();
    for (const cueId of cueIds) {
      const choices: Array<{ annotatorId: string; formationType: string; score: number }> = [];
      for (const row of rows) {
        const top = (row.formationTop3 ?? []).find((t) => t.cueId === cueId);
        const first = top ? [...top.ranks].sort((a, b) => a.rank - b.rank)[0] : undefined;
        if (first) {
          choices.push({ annotatorId: row.annotatorId, formationType: first.formationType, score: first.score });
        }
      }
      const types = new Set(choices.map((c) => c.formationType));
      if (types.size > 1 && choices.length >= 2) {
        out.push({ songId, cueId, humanChoices: choices.sort((a, b) => a.annotatorId.localeCompare(b.annotatorId)) });
      }
    }
  }
  return out;
}
