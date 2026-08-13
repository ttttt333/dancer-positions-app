import type {
  AiEvaluationOutput,
  BenchmarkConfig,
  BenchmarkDataset,
  BenchmarkProgress,
  BenchmarkSummary,
  EvaluationResult,
  MusicStructureCategory,
  SongGroundTruth,
} from "../types/EvaluationTypes";
import { ANNOTATION_VERSION } from "../types/EvaluationTypes";
import {
  REALWORLD_VERSION,
  type BenchmarkRunComparison,
  type DiagnosticFinding,
  type RealSongAnnotations,
  type RealSongCategory,
  type RealWorldBenchmarkResult,
  type RealWorldDataset,
  type RealWorldDatasetItem,
  type SliceMetrics,
  type TuningCandidateStatus,
} from "../types/RealWorldTypes";
import {
  AnalysisCache,
  calculateBenchmarkSummary,
  evaluateQualityGates,
  qualityStatus,
} from "../evaluation/BenchmarkRunner";
import { evaluateSong } from "../evaluation/EvaluationRunner";
import { resolveBenchmarkConfig } from "../evaluation/EvaluationConfig";
import { mean } from "../evaluation/EvaluationMetrics";
import { applySafetyCap, meanMetrics, qualityGrade } from "../evaluation/QualityGrade";
import { attributeErrors } from "./ErrorAttribution";
import { generateFailureMatrix, strongestBucket, weakestBucket } from "./FailureMatrix";
import {
  calculateHumanCeiling,
  calculateHumanCeilingRatio,
  findConsensusReviews,
  groundTruthConfidence,
} from "./HumanCeiling";
import { meanLayerScores, strongestLayer, weakestLayer } from "./LayerDiagnostics";
import { evaluatePhrases } from "./PhraseEvaluator";
import { assertRealWorldDataset, bpmBucket } from "./RealDatasetValidator";
import { bucketTotalsFromMatrix, generateTuningRecommendations } from "./TuningRecommendations";

function mapCategory(category: RealSongCategory): MusicStructureCategory {
  if (category === "DROP_HEAVY") return "BREAK_DROP_HEAVY";
  if (category === "COMPLEX_STRUCTURE") return "COMPLEX_ARRANGEMENT";
  if (category === "MINIMAL_STABLE") return "DYNAMIC_CONTRAST";
  return category;
}

function toGroundTruth(ann: RealSongAnnotations): SongGroundTruth {
  return {
    songId: ann.songId,
    annotationVersion: ann.annotationVersion || ANNOTATION_VERSION,
    sections: ann.sections,
    cues: ann.cues,
    formations: ann.formations,
    sequence: ann.sequence,
  };
}

function blendResults(songId: string, rows: EvaluationResult[]): EvaluationResult {
  const first = rows[0]!;
  if (rows.length === 1) return { ...first, songId };
  const m = meanMetrics(rows);
  return {
    ...first,
    songId,
    overallScore: m.overallScore,
    cueMetrics: {
      ...first.cueMetrics,
      precision: m.cuePrecision,
      recall: m.cueRecall,
      f1: m.cueF1,
      majorCueRecall: m.majorCueRecall,
      timingErrorMean: mean(rows.map((r) => r.cueMetrics.timingErrorMean)),
      timingErrorMedian: mean(rows.map((r) => r.cueMetrics.timingErrorMedian)),
      beatErrorMean: mean(rows.map((r) => r.cueMetrics.beatErrorMean)),
      overgenerationRate: mean(rows.map((r) => r.cueMetrics.overgenerationRate)),
      underGenerationRate: mean(rows.map((r) => r.cueMetrics.underGenerationRate)),
    },
    sectionMetrics: {
      ...first.sectionMetrics,
      classificationAccuracy: m.sectionAccuracy,
      meanBoundaryError: mean(rows.map((r) => r.sectionMetrics.meanBoundaryError)),
      medianBoundaryError: mean(rows.map((r) => r.sectionMetrics.medianBoundaryError)),
      within1BeatRate: mean(rows.map((r) => r.sectionMetrics.within1BeatRate)),
      within2BeatRate: mean(rows.map((r) => r.sectionMetrics.within2BeatRate)),
    },
    formationMetrics: {
      top1Agreement: m.formationTop1,
      top3Agreement: m.formationTop3,
      top5Agreement: mean(rows.map((r) => r.formationMetrics.top5Agreement)),
      rankCorrelation: mean(rows.map((r) => r.formationMetrics.rankCorrelation)),
    },
    transitionMetrics: {
      mae: mean(rows.map((r) => r.transitionMetrics.mae)),
      rmse: mean(rows.map((r) => r.transitionMetrics.rmse)),
      correlation: m.transitionCorrelation,
      unsafeRecommendationRate: m.unsafeRecommendationRate,
    },
    sequenceMetrics: {
      ...first.sequenceMetrics,
      mae: mean(rows.map((r) => r.sequenceMetrics.mae)),
      rmse: mean(rows.map((r) => r.sequenceMetrics.rmse)),
      correlation: m.sequenceCorrelation,
      topSequenceAgreement: mean(rows.map((r) => r.sequenceMetrics.topSequenceAgreement)),
      humanOverall: mean(rows.map((r) => r.sequenceMetrics.humanOverall)),
      normalizedAiScore: mean(rows.map((r) => r.sequenceMetrics.normalizedAiScore)),
      absoluteGap: mean(rows.map((r) => r.sequenceMetrics.absoluteGap)),
    },
    criticalErrors: rows.flatMap((r) => r.criticalErrors),
  };
}

function sliceOf(results: EvaluationResult[]): SliceMetrics {
  const m = meanMetrics(results);
  return {
    count: results.length,
    overall: m.overallScore,
    cueF1: m.cueF1,
    majorCueRecall: m.majorCueRecall,
    formationTop3: m.formationTop3,
    sequenceCorrelation: m.sequenceCorrelation,
    unsafeRate: m.unsafeRecommendationRate,
  };
}

export function annotationsBySong(annotations: RealSongAnnotations[]): Map<string, RealSongAnnotations[]> {
  const map = new Map<string, RealSongAnnotations[]>();
  for (const ann of [...annotations].sort((a, b) => a.songId.localeCompare(b.songId) || a.annotatorId.localeCompare(b.annotatorId))) {
    const list = map.get(ann.songId) ?? [];
    list.push(ann);
    map.set(ann.songId, list);
  }
  return map;
}

export function evaluateItemAgainstAnnotations(
  item: RealWorldDatasetItem,
  anns: RealSongAnnotations[],
  config?: Partial<BenchmarkConfig>
): EvaluationResult[] {
  return [...anns]
    .sort((a, b) => a.annotatorId.localeCompare(b.annotatorId))
    .map((ann) =>
      evaluateSong({
        songId: item.song.id,
        duration: item.song.duration,
        groundTruth: toGroundTruth(ann),
        ai: item.ai,
        config,
      })
    );
}

export async function runRealWorldBenchmark(
  dataset: RealWorldDataset,
  annotations: RealSongAnnotations[],
  config?: Partial<BenchmarkConfig>,
  options: {
    onProgress?: (progress: BenchmarkProgress) => void;
    cache?: AnalysisCache;
    analyze?: (item: RealWorldDatasetItem) => AiEvaluationOutput;
    concurrency?: number;
  } = {}
): Promise<RealWorldBenchmarkResult> {
  const cfg = resolveBenchmarkConfig(config);
  if ((options.concurrency ?? 1) < 1) {
    throw new Error("concurrency must be >= 1");
  }
  if (dataset.items.length === 0) {
    const emptySummary = calculateBenchmarkSummary([], { annotationVersion: dataset.annotationVersion, items: [] }, cfg);
    const emptyLayers = meanLayerScores([]);
    return {
      songsEvaluated: 0,
      annotatorCount: 0,
      humanHumanAgreement: 0,
      aiHumanAgreement: 0,
      humanCeiling: { cueMatchRate: 0, formationTop3: 0, sequenceCorrelation: 0, overall: 0, pairs: 0 },
      humanCeilingRatio: { cue: 0, formationTop3: 0, sequence: 0, overall: 0 },
      overall: 0,
      grade: "F",
      status: "NOT_READY",
      summary: emptySummary,
      layerScores: emptyLayers,
      weakestBucket: "NONE",
      strongestBucket: "NONE",
      weakestLayer: "phase2Structure",
      strongestLayer: "phase1Audio",
      categoryBreakdown: {},
      difficultyBreakdown: {},
      bpmBreakdown: {},
      failureMatrix: generateFailureMatrix([], () => "EASY"),
      diagnostics: [],
      consensusReviews: [],
      groundTruthConfidence: {},
      recommendations: generateTuningRecommendations(emptyLayers, {}),
      evaluationVersion: REALWORLD_VERSION,
    };
  }

  const eligible = assertRealWorldDataset(dataset, annotations);
  const items = [...eligible].sort((a, b) => a.song.id.localeCompare(b.song.id));
  const cache = options.cache ?? new AnalysisCache();
  const grouped = annotationsBySong(annotations);
  const blended: EvaluationResult[] = [];
  const allRows: EvaluationResult[] = [];
  const diagnostics: DiagnosticFinding[] = [];
  const confidence: Record<string, ReturnType<typeof groundTruthConfidence>> = {};
  const phraseBySong: Record<string, number> = {};
  const eligibleAnns = annotations.filter((a) => items.some((i) => i.song.id === a.songId));

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    options.onProgress?.({ completed: i, total: items.length, currentSongId: item.song.id });
    const version = item.ai.analysisVersion || REALWORLD_VERSION;
    let ai = cache.get<AiEvaluationOutput>(item.song.audioHash, version);
    if (!ai) {
      ai = options.analyze ? options.analyze(item) : item.ai;
      cache.set(item.song.audioHash, version, ai);
    }
    const resolved: RealWorldDatasetItem = { ...item, ai };
    const anns = grouped.get(item.song.id) ?? [];
    const rows = evaluateItemAgainstAnnotations(resolved, anns, cfg);
    allRows.push(...rows);
    const songResult = blendResults(item.song.id, rows);
    const songCeiling = calculateHumanCeiling(anns, item.song.bpm ?? item.ai.bpm, cfg.matchingBeats);
    const conf = songCeiling.pairs === 0 ? "LOW" : groundTruthConfidence(songCeiling.overall);
    confidence[item.song.id] = conf;
    if (conf === "LOW") {
      songResult.overallScore *= 0.85;
    }
    blended.push(songResult);
    const bpm = item.song.bpm ?? item.ai.bpm;
    phraseBySong[item.song.id] = mean(
      anns.map((a) => evaluatePhrases(item.phrases ?? [], a.phrases, bpm).classificationAccuracy)
    );
    diagnostics.push(
      ...attributeErrors(
        songResult,
        ai,
        anns.flatMap((a) => a.formations),
        anns.flatMap((a) => a.cues.map((c) => c.time))
      )
    );
  }
  options.onProgress?.({
    completed: items.length,
    total: items.length,
    currentSongId: items[items.length - 1]?.song.id ?? "",
  });

  const pseudo: BenchmarkDataset = {
    annotationVersion: dataset.annotationVersion,
    items: items.map((item) => ({
      song: {
        id: item.song.id,
        title: item.song.title,
        bpm: item.song.bpm,
        duration: item.song.duration,
        audioHash: item.song.audioHash,
        metadata: { artist: item.song.artist, notes: item.song.notes, source: "real-world" },
      },
      groundTruth: toGroundTruth((grouped.get(item.song.id) ?? [])[0]!),
      ai: item.ai,
      difficulty: item.song.difficulty,
      category: mapCategory(item.song.category),
    })),
  };
  const summary = calculateBenchmarkSummary(blended, pseudo, cfg);
  const layers = meanLayerScores(blended, phraseBySong);
  const matrix = generateFailureMatrix(blended, (id) => items.find((s) => s.song.id === id)?.song.difficulty ?? "MEDIUM");
  const ceiling = calculateHumanCeiling(eligibleAnns, 120, cfg.matchingBeats);
  const agg = meanMetrics(allRows.length > 0 ? allRows : blended);
  const aiHuman = {
    cue: agg.cueF1,
    formationTop3: agg.formationTop3,
    sequence: agg.sequenceCorrelation,
    overall: agg.overallScore / 100,
  };
  const ratio = calculateHumanCeilingRatio(aiHuman, ceiling);
  const annotatorCount = new Set(eligibleAnns.map((a) => a.annotatorId)).size;

  const categoryBreakdown: RealWorldBenchmarkResult["categoryBreakdown"] = {};
  const difficultyBreakdown: RealWorldBenchmarkResult["difficultyBreakdown"] = {};
  const bpmBreakdown: RealWorldBenchmarkResult["bpmBreakdown"] = {};
  for (const item of items) {
    const cat = item.song.category;
    categoryBreakdown[cat] = sliceOf(
      blended.filter((r) => items.find((it) => it.song.id === r.songId)?.song.category === cat)
    );
    const diff = item.song.difficulty;
    difficultyBreakdown[diff] = sliceOf(
      blended.filter((r) => items.find((it) => it.song.id === r.songId)?.song.difficulty === diff)
    );
    const bucket = bpmBucket(item.song.bpm);
    if (bucket) {
      bpmBreakdown[bucket] = sliceOf(
        blended.filter((r) => bpmBucket(items.find((it) => it.song.id === r.songId)?.song.bpm) === bucket)
      );
    }
  }

  const totals = bucketTotalsFromMatrix(matrix.buckets);
  const recs = generateTuningRecommendations(layers, totals, {
    meanBoundaryError: mean(blended.map((r) => r.sectionMetrics.meanBoundaryError)),
    overgenerationRate: mean(blended.map((r) => r.cueMetrics.overgenerationRate)),
  });

  diagnostics.sort((a, b) => a.songId.localeCompare(b.songId) || a.failedAt.localeCompare(b.failedAt));

  const gates = evaluateQualityGates(summary, cfg);
  const gatesOk = Object.values(gates).every(Boolean);
  const grade = applySafetyCap(qualityGrade(summary.overallScore), summary.unsafeRecommendationRate, cfg.safetyCaps);

  return {
    songsEvaluated: blended.length,
    annotatorCount,
    humanHumanAgreement: ceiling.overall,
    aiHumanAgreement: aiHuman.overall,
    humanCeiling: ceiling,
    humanCeilingRatio: ratio,
    overall: summary.overallScore,
    grade,
    status: qualityStatus(grade, gatesOk),
    summary,
    layerScores: layers,
    weakestBucket: weakestBucket(matrix),
    strongestBucket: strongestBucket(matrix),
    weakestLayer: weakestLayer(layers),
    strongestLayer: strongestLayer(layers),
    categoryBreakdown,
    difficultyBreakdown,
    bpmBreakdown,
    failureMatrix: matrix,
    diagnostics,
    consensusReviews: findConsensusReviews(eligibleAnns),
    groundTruthConfidence: confidence,
    recommendations: recs,
    evaluationVersion: REALWORLD_VERSION,
  };
}

export function compareBenchmarkRuns(
  before: BenchmarkSummary,
  after: BenchmarkSummary
): BenchmarkRunComparison {
  const overallDelta = after.overallScore - before.overallScore;
  const safetyDelta = before.unsafeRecommendationRate - after.unsafeRecommendationRate;
  const cueF1Delta = after.cueF1 - before.cueF1;
  const majorCueRecallDelta = after.majorCueRecall - before.majorCueRecall;
  const formationTop3Delta = after.formationTop3 - before.formationTop3;
  const sequenceDelta = after.sequenceCorrelation - before.sequenceCorrelation;
  let status: TuningCandidateStatus = "INCONCLUSIVE";
  const unsafeWorse = after.unsafeRecommendationRate > before.unsafeRecommendationRate + 1e-12;
  if (unsafeWorse && overallDelta < -0.5) status = "REGRESSION";
  else if (unsafeWorse && overallDelta > 0.5) status = "TRADEOFF";
  else if (!unsafeWorse && overallDelta > 0.5) status = "IMPROVEMENT";
  else if (overallDelta < -0.5) status = "REGRESSION";
  else if (Math.abs(overallDelta) <= 0.5 && Math.abs(safetyDelta) <= 1e-9) status = "INCONCLUSIVE";
  else if (unsafeWorse) status = "TRADEOFF";
  else status = overallDelta > 0 ? "IMPROVEMENT" : "INCONCLUSIVE";
  return {
    overallDelta,
    safetyDelta,
    cueF1Delta,
    majorCueRecallDelta,
    formationTop3Delta,
    sequenceDelta,
    status,
  };
}
