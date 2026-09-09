/**
 * FLY Benchmark module — Phase 4.5
 * NOT re-exported from src/lib/fly/index.ts (production isolation).
 */

export {
  FLY_BENCHMARK_VERSION,
  FLY_GROUND_TRUTH_VERSION,
  FLY_DATASET_VERSION,
  FLY_METRICS_VERSION,
  evidenceConfidenceFromSampleCount,
} from "./versions";
export type * from "./types";
export { assertGroundTruthSong, parseGroundTruthSong } from "./groundTruth";
export {
  scoreTempo,
  scoreBeats,
  scoreOnsets,
  scoreDownbeats,
  scoreSections,
  scoreEightCounts,
  scoreEvents,
  matchTimesGreedy,
} from "./metrics";
export { scoreAnalyzerAgreement } from "./analyzerAgreement";
export {
  conditionKeysFromTags,
  classifyDurationBucket,
} from "./conditionMatrix";
export { buildReliabilityProfiles } from "./reliabilityProfile";
export { scoreSongHypothesis } from "./scoreSong";
export {
  runFlyBenchmark,
  type FlyBenchmarkDatasetEntry,
  type RunFlyBenchmarkInput,
} from "./benchmarkRunner";
export { buildBenchmarkReports } from "./report";
