import type { AiEvaluationOutput, BenchmarkConfig, BenchmarkSummary, MusicStructureCategory } from "../types/EvaluationTypes";
import {
  REALWORLD_VERSION,
  type RealSongAnnotations,
  type RealWorldDataset,
  type TuningCandidate,
  type TuningGrid,
  type TuningHistory,
} from "../types/RealWorldTypes";
import { DEFAULT_CUE_ENGINE_CONFIG } from "../cue/cueConfig";
import { DEFAULT_MUSIC_STRUCTURE_CONFIG } from "../music/structureConfig";
import { DEFAULT_MOVEMENT_ENGINE_CONFIG } from "../movement/movementConfig";
import { DEFAULT_SEQUENCE_WEIGHTS, DEFAULT_BEAM_SEARCH_CONFIG, DEFAULT_CANDIDATE_WEIGHTS } from "../scoring/ScoreWeights";
import {
  annotationsBySong,
  compareBenchmarkRuns,
  evaluateItemAgainstAnnotations,
} from "./RealWorldBenchmark";
import { calculateBenchmarkSummary } from "../evaluation/BenchmarkRunner";
import { resolveBenchmarkConfig } from "../evaluation/EvaluationConfig";

export const TUNABLE_BASELINE: Record<string, number> = {
  sectionBoundaryThreshold: DEFAULT_MUSIC_STRUCTURE_CONFIG.sectionBoundaryThreshold,
  majorEnergyRiseThreshold: DEFAULT_MUSIC_STRUCTURE_CONFIG.majorEnergyRiseThreshold,
  majorEnergyDropThreshold: DEFAULT_MUSIC_STRUCTURE_CONFIG.majorEnergyDropThreshold,
  spectralChangeThreshold: DEFAULT_MUSIC_STRUCTURE_CONFIG.spectralChangeThreshold,
  bassRiseThreshold: DEFAULT_MUSIC_STRUCTURE_CONFIG.bassRiseThreshold,
  majorPriorityThreshold: DEFAULT_CUE_ENGINE_CONFIG.majorPriorityThreshold,
  microShiftThreshold: DEFAULT_CUE_ENGINE_CONFIG.microShiftThreshold,
  anticipationBeats: DEFAULT_CUE_ENGINE_CONFIG.anticipationBeats,
  lowPriorityCooldownBeats: DEFAULT_CUE_ENGINE_CONFIG.lowPriorityCooldownBeats,
  mediumPriorityCooldownBeats: DEFAULT_CUE_ENGINE_CONFIG.mediumPriorityCooldownBeats,
  highPriorityCooldownBeats: DEFAULT_CUE_ENGINE_CONFIG.highPriorityCooldownBeats,
  repetitionPenalty: DEFAULT_CUE_ENGINE_CONFIG.repetitionPenalty,
  musicFit: DEFAULT_CANDIDATE_WEIGHTS.musicFit,
  visualImpact: DEFAULT_CANDIDATE_WEIGHTS.visualImpact,
  transitionWeight: DEFAULT_SEQUENCE_WEIGHTS.transitionQuality,
  futurePotentialWeight: DEFAULT_BEAM_SEARCH_CONFIG.futurePotentialWeight,
  novelty: DEFAULT_CANDIDATE_WEIGHTS.novelty,
  sequenceRepetitionPenalty: DEFAULT_BEAM_SEARCH_CONFIG.repetitionPenalty,
  softViolationRatio: DEFAULT_MOVEMENT_ENGINE_CONFIG.softViolationRatio,
};

export const DEFAULT_TUNING_GRID: TuningGrid = {
  microShiftThreshold: [35, 50, 65],
  majorPriorityThreshold: [70, 80, 90],
};

export function cartesianGrid(grid: TuningGrid, maxCandidates = 27): Record<string, number>[] {
  const keys = Object.keys(grid).sort();
  if (keys.length === 0) return [{}];
  let combos: Record<string, number>[] = [{}];
  for (const key of keys) {
    const values = [...(grid[key] ?? [])].sort((a, b) => a - b);
    const next: Record<string, number>[] = [];
    for (const prev of combos) {
      for (const value of values) {
        next.push({ ...prev, [key]: value });
      }
    }
    combos = next;
  }
  return combos.slice(0, maxCandidates);
}

export function applyParameterChangesToOutput(
  ai: AiEvaluationOutput,
  changes: Record<string, number>
): AiEvaluationOutput {
  let cues = [...ai.cues];
  const micro = changes.microShiftThreshold;
  if (micro !== undefined && micro > DEFAULT_CUE_ENGINE_CONFIG.microShiftThreshold) {
    cues = cues.filter(
      (c) => c.action !== "MICRO_SHIFT" || (c.priority ?? 0) >= micro
    );
  }
  const major = changes.majorPriorityThreshold;
  if (major !== undefined) {
    cues = cues.map((c) => ({
      ...c,
      isMajor: c.isMajor && (c.priority ?? 0) >= major,
    }));
  }
  const anticipation = changes.anticipationBeats;
  if (anticipation !== undefined && anticipation !== DEFAULT_CUE_ENGINE_CONFIG.anticipationBeats) {
    const shift = (DEFAULT_CUE_ENGINE_CONFIG.anticipationBeats - anticipation) * 0.5;
    cues = cues.map((c) => ({ ...c, rawTime: c.rawTime + shift, beatTime: (c.beatTime ?? c.rawTime) + shift }));
  }
  let transitions = [...ai.transitions];
  const soft = changes.softViolationRatio;
  if (soft !== undefined && soft < DEFAULT_MOVEMENT_ENGINE_CONFIG.softViolationRatio) {
    transitions = transitions.map((t) => ({ ...t, unsafe: true, feasible: false }));
  }
  let rankings = [...ai.formationRankings];
  if (changes.novelty !== undefined && changes.novelty > DEFAULT_CANDIDATE_WEIGHTS.novelty) {
    rankings = [...rankings].reverse();
  }
  const keys = Object.keys(changes).sort();
  const noop = keys.length === 0;
  return {
    ...ai,
    cues: noop ? ai.cues : cues,
    transitions: noop ? ai.transitions : transitions,
    formationRankings: noop ? ai.formationRankings : rankings,
    analysisVersion: `${ai.analysisVersion}|tune:${keys.map((k) => `${k}=${changes[k]}`).join(",")}`,
  };
}

function categoryMap(category: string): MusicStructureCategory {
  if (category === "DROP_HEAVY") return "BREAK_DROP_HEAVY";
  if (category === "COMPLEX_STRUCTURE") return "COMPLEX_ARRANGEMENT";
  if (category === "MINIMAL_STABLE") return "DYNAMIC_CONTRAST";
  if (category === "ENERGY_DRIVEN" || category === "BEAT_DRIVEN") return category;
  return "COMPLEX_ARRANGEMENT";
}

export function summarizeAgainstAnnotations(
  dataset: RealWorldDataset,
  annotations: RealSongAnnotations[],
  transform: (ai: AiEvaluationOutput) => AiEvaluationOutput,
  config?: Partial<BenchmarkConfig>
): BenchmarkSummary {
  const cfg = resolveBenchmarkConfig(config);
  const grouped = annotationsBySong(annotations);
  const items = [...dataset.items]
    .filter((i) => i.song.rightsConfirmed)
    .sort((a, b) => a.song.id.localeCompare(b.song.id));
  const results = items.flatMap((item) => {
    const ai = transform(item.ai);
    return evaluateItemAgainstAnnotations({ ...item, ai }, grouped.get(item.song.id) ?? [], cfg);
  });
  const pseudo = {
    annotationVersion: dataset.annotationVersion,
    items: items.map((item) => ({
      song: {
        id: item.song.id,
        title: item.song.title,
        duration: item.song.duration,
        audioHash: item.song.audioHash,
        metadata: {},
      },
      groundTruth: {
        songId: item.song.id,
        annotationVersion: dataset.annotationVersion,
        sections: [],
        cues: [],
        formations: [],
        sequence: [],
      },
      ai: item.ai,
      difficulty: item.song.difficulty,
      category: categoryMap(item.song.category),
    })),
  };
  return calculateBenchmarkSummary(results, pseudo, cfg);
}

export function evaluateTuningCandidate(
  before: BenchmarkSummary,
  after: BenchmarkSummary,
  parameterChanges: Record<string, number>
): TuningCandidate {
  const cmp = compareBenchmarkRuns(before, after);
  const unsafeWorse = after.unsafeRecommendationRate > before.unsafeRecommendationRate + 1e-12;
  let status = cmp.status;
  if (unsafeWorse && status === "IMPROVEMENT") status = "TRADEOFF";
  return {
    parameterChanges,
    score: {
      overall: after.overallScore,
      cueF1: after.cueF1,
      majorCueRecall: after.majorCueRecall,
      formationTop3: after.formationTop3,
      sequenceCorrelation: after.sequenceCorrelation,
      unsafeRate: after.unsafeRecommendationRate,
    },
    deltaFromBaseline: {
      overall: after.overallScore - before.overallScore,
      safety: before.unsafeRecommendationRate - after.unsafeRecommendationRate,
    },
    status,
  };
}

function dominates(a: TuningCandidate, b: TuningCandidate): boolean {
  const av = [a.score.cueF1, a.score.majorCueRecall, a.score.formationTop3, a.score.sequenceCorrelation, -a.score.unsafeRate];
  const bv = [b.score.cueF1, b.score.majorCueRecall, b.score.formationTop3, b.score.sequenceCorrelation, -b.score.unsafeRate];
  let better = false;
  for (let i = 0; i < av.length; i += 1) {
    if (av[i]! < bv[i]! - 1e-12) return false;
    if (av[i]! > bv[i]! + 1e-12) better = true;
  }
  return better;
}

export function paretoFrontier(candidates: TuningCandidate[]): TuningCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    const ak = Object.keys(a.parameterChanges).sort().map((k) => `${k}:${a.parameterChanges[k]}`).join("|");
    const bk = Object.keys(b.parameterChanges).sort().map((k) => `${k}:${b.parameterChanges[k]}`).join("|");
    return ak.localeCompare(bk);
  });
  return sorted.filter((c, i) => !sorted.some((o, j) => j !== i && dominates(o, c)));
}

export function generateTuningCandidates(
  dataset: RealWorldDataset,
  annotations: RealSongAnnotations[],
  baseline: BenchmarkSummary,
  grid: TuningGrid = DEFAULT_TUNING_GRID,
  config?: Partial<BenchmarkConfig>
): TuningCandidate[] {
  const combos = cartesianGrid(grid);
  const out: TuningCandidate[] = [];
  for (const changes of combos) {
    const after = summarizeAgainstAnnotations(
      dataset,
      annotations,
      (ai) => applyParameterChangesToOutput(ai, changes),
      config
    );
    const candidate = evaluateTuningCandidate(baseline, after, changes);
    if (after.unsafeRecommendationRate > baseline.unsafeRecommendationRate + 1e-12) {
      out.push({ ...candidate, status: candidate.status === "INCONCLUSIVE" ? "REGRESSION" : candidate.status === "IMPROVEMENT" ? "TRADEOFF" : candidate.status });
      continue;
    }
    out.push(candidate);
  }
  return out.sort((a, b) => b.deltaFromBaseline.overall - a.deltaFromBaseline.overall || JSON.stringify(a.parameterChanges).localeCompare(JSON.stringify(b.parameterChanges)));
}

export function recordTuningHistory(
  before: BenchmarkSummary,
  after: BenchmarkSummary,
  parametersChanged: Record<string, number>,
  now = new Date()
): TuningHistory {
  const cmp = compareBenchmarkRuns(before, after);
  return {
    baselineVersion: REALWORLD_VERSION,
    candidateVersion: `${REALWORLD_VERSION}-candidate`,
    parametersChanged,
    before,
    after,
    status: cmp.status,
    createdAt: now.toISOString(),
  };
}
