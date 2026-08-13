import type { EvaluationResult } from "../types/EvaluationTypes";
import type { LayerScores } from "../types/RealWorldTypes";
import { clamp, correlationToScore, mean } from "../evaluation/EvaluationMetrics";

export function layerScoresFromResult(result: EvaluationResult, phraseAccuracy?: number): LayerScores {
  const cue = result.cueMetrics;
  const section = result.sectionMetrics;
  const formation = result.formationMetrics;
  const transition = result.transitionMetrics;
  const sequence = result.sequenceMetrics;
  const structureBase = section.classificationAccuracy * 70 + section.within2BeatRate * 30;
  const structure =
    phraseAccuracy === undefined ? structureBase : structureBase * 0.7 + phraseAccuracy * 100 * 0.3;
  return {
    phase1Audio: clamp(100 - cue.beatErrorMean * 25, 0, 100),
    phase2Structure: clamp(structure, 0, 100),
    phase3Cue: clamp(
      cue.f1 * 50 + cue.majorCueRecall * 35 + (1 - Math.min(1, cue.overgenerationRate)) * 15,
      0,
      100
    ),
    phase4Formation: clamp(
      ((formation.top1Agreement + formation.top3Agreement + formation.top5Agreement) / 3) * 100,
      0,
      100
    ),
    phase5Movement: clamp(
      (1 - transition.unsafeRecommendationRate) * 70 + correlationToScore(transition.correlation) * 0.3,
      0,
      100
    ),
    phase6Sequence: clamp(
      correlationToScore(sequence.correlation) * 0.7 + sequence.topSequenceAgreement * 30,
      0,
      100
    ),
  };
}

export function meanLayerScores(
  results: EvaluationResult[],
  phraseBySong?: Record<string, number>
): LayerScores {
  if (results.length === 0) {
    return {
      phase1Audio: 0,
      phase2Structure: 0,
      phase3Cue: 0,
      phase4Formation: 0,
      phase5Movement: 0,
      phase6Sequence: 0,
    };
  }
  const all = results.map((r) => layerScoresFromResult(r, phraseBySong?.[r.songId]));
  return {
    phase1Audio: mean(all.map((s) => s.phase1Audio)),
    phase2Structure: mean(all.map((s) => s.phase2Structure)),
    phase3Cue: mean(all.map((s) => s.phase3Cue)),
    phase4Formation: mean(all.map((s) => s.phase4Formation)),
    phase5Movement: mean(all.map((s) => s.phase5Movement)),
    phase6Sequence: mean(all.map((s) => s.phase6Sequence)),
  };
}

export function weakestLayer(scores: LayerScores): keyof LayerScores {
  return (Object.keys(scores) as Array<keyof LayerScores>).sort(
    (a, b) => scores[a] - scores[b] || a.localeCompare(b)
  )[0]!;
}

export function strongestLayer(scores: LayerScores): keyof LayerScores {
  return (Object.keys(scores) as Array<keyof LayerScores>).sort(
    (a, b) => scores[b] - scores[a] || a.localeCompare(b)
  )[0]!;
}
