import type { EvaluationResult, SongDifficulty } from "../types/EvaluationTypes";
import type { RealWorldFailureBucket, FailureMatrix } from "../types/RealWorldTypes";
import { SONG_DIFFICULTIES } from "../types/RealWorldTypes";

export const FAILURE_BUCKETS: RealWorldFailureBucket[] = [
  "TIMING",
  "STRUCTURE",
  "ENERGY",
  "HIT",
  "CUE_DENSITY",
  "FORMATION",
  "MOVEMENT",
  "COLLISION",
  "VARIETY",
  "SEQUENCE",
  "SAFETY",
];

function emptyRow(): Record<SongDifficulty, number> {
  return { EASY: 0, MEDIUM: 0, HARD: 0, VERY_HARD: 0 };
}

export function emptyFailureMatrix(): FailureMatrix {
  const buckets = {} as FailureMatrix["buckets"];
  for (const b of FAILURE_BUCKETS) buckets[b] = emptyRow();
  return { buckets };
}

export function generateFailureMatrix(
  results: EvaluationResult[],
  difficultyOf: (songId: string) => SongDifficulty
): FailureMatrix {
  const matrix = emptyFailureMatrix();
  const seen = new Map<string, Set<RealWorldFailureBucket>>();
  for (const result of results) {
    const diff = difficultyOf(result.songId);
    const mark = (bucket: RealWorldFailureBucket) => {
      const key = result.songId;
      const set = seen.get(key) ?? new Set();
      if (set.has(bucket)) return;
      set.add(bucket);
      seen.set(key, set);
      matrix.buckets[bucket][diff] += 1;
    };
    if (result.cueMetrics.timingErrorMean > 0.6 || result.cueMetrics.beatErrorMean > 1) mark("TIMING");
    if (result.sectionMetrics.classificationAccuracy < 0.7 || result.sectionMetrics.meanBoundaryError > 0.5) {
      mark("STRUCTURE");
    }
    if (result.cueMetrics.underGenerationRate > 0.35) mark("ENERGY");
    if (result.cueMetrics.overgenerationRate > 0.25 && result.cueMetrics.precision < 0.85) mark("HIT");
    if (result.cueMetrics.overgenerationRate > 0.3) mark("CUE_DENSITY");
    if (result.formationMetrics.top3Agreement < 1) mark("FORMATION");
    if (result.transitionMetrics.mae > 12) mark("MOVEMENT");
    if (result.criticalErrors.some((e) => e.type === "UNSAFE_MOVEMENT")) mark("COLLISION");
    if (result.sequenceMetrics.topSequenceAgreement < 1 && result.sequenceMetrics.absoluteGap > 8) mark("VARIETY");
    if (result.sequenceMetrics.correlation < 0.75 || result.sequenceMetrics.absoluteGap > 12) mark("SEQUENCE");
    if (result.transitionMetrics.unsafeRecommendationRate > 0) mark("SAFETY");
  }
  return matrix;
}

export function weakestBucket(matrix: FailureMatrix): RealWorldFailureBucket | "NONE" {
  let best: RealWorldFailureBucket | "NONE" = "NONE";
  let max = 0;
  for (const bucket of FAILURE_BUCKETS) {
    const total = SONG_DIFFICULTIES.reduce((s, d) => s + matrix.buckets[bucket][d], 0);
    if (total > max || (total === max && best !== "NONE" && bucket.localeCompare(best) < 0 && total > 0)) {
      if (total > 0) {
        max = total;
        best = bucket;
      }
    }
  }
  return best;
}

export function strongestBucket(matrix: FailureMatrix): RealWorldFailureBucket | "NONE" {
  let best: RealWorldFailureBucket | "NONE" = "NONE";
  let min = Infinity;
  for (const bucket of FAILURE_BUCKETS) {
    const total = SONG_DIFFICULTIES.reduce((s, d) => s + matrix.buckets[bucket][d], 0);
    if (total < min || (total === min && (best === "NONE" || bucket.localeCompare(best) < 0))) {
      min = total;
      best = bucket;
    }
  }
  return best === "NONE" ? "SAFETY" : best;
}
