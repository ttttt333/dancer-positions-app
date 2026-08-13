import type { SongDifficulty } from "../types/EvaluationTypes";
import type {
  FailedAtLayer,
  LayerScores,
  RealWorldFailureBucket,
  TuningRecommendation,
} from "../types/RealWorldTypes";
import { FAILURE_BUCKETS } from "./FailureMatrix";
import { SONG_DIFFICULTIES } from "../types/RealWorldTypes";

const LAYER_HINT: Record<keyof LayerScores, { layer: FailedAtLayer; title: string; hint: string }> = {
  phase1Audio: {
    layer: "PHASE_1_AUDIO",
    title: "Beat / energy tracking",
    hint: "review hop size and onset sensitivity",
  },
  phase2Structure: {
    layer: "PHASE_2_STRUCTURE",
    title: "Section boundary detection",
    hint: "sectionBoundaryThreshold / bar snapping",
  },
  phase3Cue: {
    layer: "PHASE_3_CUE",
    title: "Cue density and timing",
    hint: "microShiftThreshold / cooldown / anticipationBeats",
  },
  phase4Formation: {
    layer: "PHASE_4_FORMATION",
    title: "Formation diversity",
    hint: "template novelty weight / intent weights",
  },
  phase5Movement: {
    layer: "PHASE_5_MOVEMENT",
    title: "Movement safety",
    hint: "collision thresholds / pushing limit tolerance",
  },
  phase6Sequence: {
    layer: "PHASE_6_SEQUENCE",
    title: "Sequence story scoring",
    hint: "musicFit / futurePotential / repetitionPenalty",
  },
};

const BUCKET_TO_LAYER: Partial<Record<RealWorldFailureBucket, keyof LayerScores>> = {
  TIMING: "phase3Cue",
  STRUCTURE: "phase2Structure",
  ENERGY: "phase2Structure",
  HIT: "phase3Cue",
  CUE_DENSITY: "phase3Cue",
  FORMATION: "phase4Formation",
  MOVEMENT: "phase5Movement",
  COLLISION: "phase5Movement",
  VARIETY: "phase6Sequence",
  SEQUENCE: "phase6Sequence",
  SAFETY: "phase5Movement",
};

export function generateTuningRecommendations(
  scores: LayerScores,
  bucketTotals: Partial<Record<RealWorldFailureBucket, number>> = {},
  extras: { meanBoundaryError?: number; overgenerationRate?: number } = {}
): TuningRecommendation[] {
  const layerRank = (Object.keys(scores) as Array<keyof LayerScores>).sort(
    (a, b) => scores[a] - scores[b] || a.localeCompare(b)
  );
  const bucketRank = FAILURE_BUCKETS.filter((b) => (bucketTotals[b] ?? 0) > 0).sort(
    (a, b) => (bucketTotals[b] ?? 0) - (bucketTotals[a] ?? 0) || a.localeCompare(b)
  );
  const keys: Array<keyof LayerScores> = [];
  for (const bucket of bucketRank) {
    const key = BUCKET_TO_LAYER[bucket];
    if (key && !keys.includes(key)) keys.push(key);
  }
  for (const key of layerRank) {
    if (!keys.includes(key)) keys.push(key);
  }
  const recs: TuningRecommendation[] = [];
  for (const key of keys) {
    if (recs.length >= 3) break;
    const meta = LAYER_HINT[key];
    let detail = `Layer score ${scores[key].toFixed(1)}`;
    if (key === "phase2Structure" && extras.meanBoundaryError !== undefined) {
      detail = `平均誤差 ${extras.meanBoundaryError.toFixed(2)}s → ${meta.hint}`;
    }
    if (key === "phase3Cue" && extras.overgenerationRate !== undefined && extras.overgenerationRate > 0.05) {
      detail = `Cue overgeneration ${(extras.overgenerationRate * 100).toFixed(0)}% → ${meta.hint}`;
    }
    recs.push({
      rank: recs.length + 1,
      title: meta.title,
      detail,
      layer: meta.layer,
      parameterHint: meta.hint,
    });
  }
  return recs.slice(0, 3);
}

export function bucketTotalsFromMatrix(
  buckets: Record<RealWorldFailureBucket, Record<SongDifficulty, number>>
): Partial<Record<RealWorldFailureBucket, number>> {
  const out: Partial<Record<RealWorldFailureBucket, number>> = {};
  for (const b of FAILURE_BUCKETS) {
    out[b] = SONG_DIFFICULTIES.reduce((s, d) => s + buckets[b][d], 0);
  }
  return out;
}
