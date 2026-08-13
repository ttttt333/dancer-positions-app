import type {
  BenchmarkConfig,
  BenchmarkDataset,
  BenchmarkHistory,
  BenchmarkProgress,
  BenchmarkStatus,
  BenchmarkSummary,
  EvaluationResult,
  FailureAnalysis,
  FailureBucket,
  MusicStructureCategory,
  QualityGrade,
  SongDifficulty,
} from "../types/EvaluationTypes";
import { ANNOTATION_VERSION, EVALUATION_VERSION } from "../types/EvaluationTypes";
import { resolveBenchmarkConfig } from "./EvaluationConfig";
import { evaluateSong } from "./EvaluationRunner";
import { applySafetyCap, meanMetrics, qualityGrade } from "./QualityGrade";
import { ENGINE_VERSIONS } from "./EvaluationRunner";

export class AnalysisCache {
  private readonly store = new Map<string, unknown>();
  hits = 0;
  misses = 0;

  key(audioHash: string, analysisVersion: string): string {
    return `${audioHash}|${analysisVersion}`;
  }

  get<T>(audioHash: string, analysisVersion: string): T | undefined {
    const k = this.key(audioHash, analysisVersion);
    if (this.store.has(k)) {
      this.hits += 1;
      return this.store.get(k) as T;
    }
    this.misses += 1;
    return undefined;
  }

  set(audioHash: string, analysisVersion: string, value: unknown): void {
    this.store.set(this.key(audioHash, analysisVersion), value);
  }
}

export const defaultAnalysisCache = new AnalysisCache();

export function qualityStatus(grade: QualityGrade, gatesOk: boolean): BenchmarkStatus {
  if (!gatesOk) return "NOT_READY";
  if (grade === "A+") return "PRODUCTION_READY";
  if (grade === "A") return "PRODUCTION_CANDIDATE";
  if (grade === "B") return "PROMISING";
  return "NOT_READY";
}

export function evaluateQualityGates(
  summary: Pick<
    BenchmarkSummary,
    "majorCueRecall" | "unsafeRecommendationRate" | "formationTop3" | "sequenceCorrelation" | "cueF1"
  >,
  config: BenchmarkConfig
): Record<string, boolean> {
  return {
    GATE_A_MAJOR_RECALL: summary.majorCueRecall >= config.gates.majorCueRecall,
    GATE_B_UNSAFE: summary.unsafeRecommendationRate <= config.gates.unsafeRecommendationRate,
    GATE_C_FORMATION_TOP3: summary.formationTop3 >= config.gates.formationTop3,
    GATE_D_SEQUENCE: summary.sequenceCorrelation >= config.gates.sequenceCorrelation,
    GATE_E_CUE_F1: summary.cueF1 >= config.gates.cueF1,
  };
}

export function analyzeFailures(results: EvaluationResult[]): FailureAnalysis[] {
  const buckets: Record<FailureBucket, { songs: Set<string>; errors: number }> = {
    TIMING: { songs: new Set(), errors: 0 },
    STRUCTURE: { songs: new Set(), errors: 0 },
    ENERGY: { songs: new Set(), errors: 0 },
    CUE_DENSITY: { songs: new Set(), errors: 0 },
    FORMATION: { songs: new Set(), errors: 0 },
    MOVEMENT: { songs: new Set(), errors: 0 },
    COLLISION: { songs: new Set(), errors: 0 },
    VARIETY: { songs: new Set(), errors: 0 },
    SEQUENCE: { songs: new Set(), errors: 0 },
    SAFETY: { songs: new Set(), errors: 0 },
  };
  const mapType: Record<string, FailureBucket> = {
    TIMING_MISS: "TIMING",
    WRONG_SECTION: "STRUCTURE",
    EXCESSIVE_CHANGES: "CUE_DENSITY",
    MUSIC_MISMATCH: "FORMATION",
    UNSAFE_MOVEMENT: "SAFETY",
    UNREALISTIC_FORMATION: "MOVEMENT",
    VISUAL_MONOTONY: "VARIETY",
    LOW_IMPACT: "SEQUENCE",
  };
  for (const r of results) {
    if (r.cueMetrics.timingErrorMean > 0.6) {
      buckets.TIMING.songs.add(r.songId);
      buckets.TIMING.errors += r.cueMetrics.timingErrorMean;
    }
    if (r.cueMetrics.overgenerationRate > 0.3) {
      buckets.CUE_DENSITY.songs.add(r.songId);
      buckets.CUE_DENSITY.errors += r.cueMetrics.overgenerationRate;
    }
    for (const err of r.criticalErrors) {
      const bucket = mapType[err.type] ?? "SEQUENCE";
      buckets[bucket].songs.add(r.songId);
      buckets[bucket].errors += 1;
    }
  }
  const causes: Partial<Record<FailureBucket, string>> = {
    TIMING: "cue matching window or beat snap too aggressive",
    CUE_DENSITY: "cooldown too short or over-triggering on hits",
    SAFETY: "feasibility gate not applied to recommended sequence",
    STRUCTURE: "section classifier confusion",
    FORMATION: "visual score dominating music fit",
  };
  const out: FailureAnalysis[] = [];
  for (const category of Object.keys(buckets) as FailureBucket[]) {
    const b = buckets[category];
    if (b.songs.size === 0) continue;
    const avg = b.errors / b.songs.size;
    out.push({
      category,
      severity: b.songs.size >= 5 || avg > 1 ? "HIGH" : b.songs.size >= 2 ? "MEDIUM" : "LOW",
      affectedSongs: b.songs.size,
      averageError: avg,
      probableCause: causes[category] ?? "see per-song critical errors",
    });
  }
  out.sort((a, b) => a.category.localeCompare(b.category));
  return out;
}

export function calculateBenchmarkSummary(
  results: EvaluationResult[],
  dataset: BenchmarkDataset,
  config: BenchmarkConfig
): BenchmarkSummary {
  const agg = meanMetrics(results);
  const gates = evaluateQualityGates(agg, config);
  const gatesOk = Object.values(gates).every(Boolean);
  const grade = applySafetyCap(qualityGrade(agg.overallScore), agg.unsafeRecommendationRate, config.safetyCaps);
  const byDifficulty: BenchmarkSummary["byDifficulty"] = {};
  const byCategory: BenchmarkSummary["byCategory"] = {};
  for (const item of dataset.items) {
    const result = results.find((r) => r.songId === item.song.id);
    if (!result) continue;
    const d = byDifficulty[item.difficulty] ?? { count: 0, overallScore: 0 };
    d.count += 1;
    d.overallScore += result.overallScore;
    byDifficulty[item.difficulty] = d;
    const c = byCategory[item.category] ?? { count: 0, overallScore: 0 };
    c.count += 1;
    c.overallScore += result.overallScore;
    byCategory[item.category] = c;
  }
  for (const key of Object.keys(byDifficulty) as SongDifficulty[]) {
    const row = byDifficulty[key]!;
    row.overallScore = row.count ? row.overallScore / row.count : 0;
  }
  for (const key of Object.keys(byCategory) as MusicStructureCategory[]) {
    const row = byCategory[key]!;
    row.overallScore = row.count ? row.overallScore / row.count : 0;
  }
  const cats = Object.entries(byCategory) as Array<[string, { count: number; overallScore: number }]>;
  cats.sort((a, b) => a[1].overallScore - b[1].overallScore);
  return {
    songsEvaluated: results.length,
    overallScore: agg.overallScore,
    grade,
    status: qualityStatus(grade, gatesOk),
    cuePrecision: agg.cuePrecision,
    cueRecall: agg.cueRecall,
    cueF1: agg.cueF1,
    majorCueRecall: agg.majorCueRecall,
    sectionAccuracy: agg.sectionAccuracy,
    formationTop1: agg.formationTop1,
    formationTop3: agg.formationTop3,
    transitionCorrelation: agg.transitionCorrelation,
    unsafeRecommendationRate: agg.unsafeRecommendationRate,
    sequenceCorrelation: agg.sequenceCorrelation,
    hardestCategory: cats[0]?.[0],
    strongestCategory: cats[cats.length - 1]?.[0],
    criticalFailureCount: results.reduce((s, r) => s + r.criticalErrors.length, 0),
    qualityGates: gates,
    failures: analyzeFailures(results),
    byDifficulty,
    byCategory,
  };
}

export function detectRegression(
  previous: BenchmarkSummary,
  next: BenchmarkSummary,
  config?: Partial<BenchmarkConfig>
): { isRegression: boolean; reasons: string[] } {
  const cfg = resolveBenchmarkConfig(config);
  const reasons: string[] = [];
  if (next.overallScore <= previous.overallScore - cfg.regression.overallDrop) {
    reasons.push("OVERALL");
  }
  if (next.majorCueRecall <= previous.majorCueRecall - cfg.regression.majorRecallDrop) {
    reasons.push("MAJOR_RECALL");
  }
  if (next.unsafeRecommendationRate >= previous.unsafeRecommendationRate + cfg.regression.unsafeRise) {
    reasons.push("UNSAFE");
  }
  return { isRegression: reasons.length > 0, reasons };
}

export function recordHistory(summary: BenchmarkSummary, now = new Date()): BenchmarkHistory {
  return {
    engineVersion: Object.values(ENGINE_VERSIONS).join("/"),
    annotationVersion: ANNOTATION_VERSION,
    date: now.toISOString(),
    summary,
  };
}

export async function runBenchmark(
  dataset: BenchmarkDataset,
  config?: Partial<BenchmarkConfig>,
  options: {
    onProgress?: (progress: BenchmarkProgress) => void;
    cache?: AnalysisCache;
    analyze?: (item: BenchmarkDataset["items"][number]) => BenchmarkDataset["items"][number]["ai"];
  } = {}
): Promise<BenchmarkSummary> {
  const cfg = resolveBenchmarkConfig(config);
  const cache = options.cache ?? new AnalysisCache();
  const items = [...dataset.items].sort((a, b) => a.song.id.localeCompare(b.song.id));
  const results: EvaluationResult[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    options.onProgress?.({
      completed: i,
      total: items.length,
      currentSongId: item.song.id,
    });
    const version = item.ai.analysisVersion || EVALUATION_VERSION;
    let ai = cache.get<typeof item.ai>(item.song.audioHash, version);
    if (!ai) {
      ai = options.analyze ? options.analyze(item) : item.ai;
      cache.set(item.song.audioHash, version, ai);
    }
    results.push(
      evaluateSong({
        songId: item.song.id,
        duration: item.song.duration,
        groundTruth: item.groundTruth,
        ai,
        config: cfg,
      })
    );
  }
  options.onProgress?.({
    completed: items.length,
    total: items.length,
    currentSongId: items[items.length - 1]?.song.id ?? "",
  });
  return calculateBenchmarkSummary(results, { ...dataset, items }, cfg);
}
