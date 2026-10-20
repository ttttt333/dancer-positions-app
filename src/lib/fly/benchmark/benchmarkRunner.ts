import type {
  FlyBenchmarkHypothesis,
  FlyBenchmarkRunOutput,
  FlyGroundTruthSong,
} from "./types";
import { scoreAnalyzerAgreement } from "./analyzerAgreement";
import { buildReliabilityProfiles } from "./reliabilityProfile";
import { buildBenchmarkReports } from "./report";
import { scoreSongHypothesis } from "./scoreSong";
import {
  FLY_BENCHMARK_VERSION,
  FLY_DATASET_VERSION,
  FLY_GROUND_TRUTH_VERSION,
  FLY_METRICS_VERSION,
} from "./versions";

export type FlyBenchmarkDatasetEntry = {
  groundTruth: FlyGroundTruthSong;
  /** Offline hypotheses — never treat as GT */
  hypotheses: FlyBenchmarkHypothesis[];
};

export type RunFlyBenchmarkInput = {
  dataset: FlyBenchmarkDatasetEntry[];
};

/**
 * Deterministic offline benchmark. Does not touch Formation Engine or Fusion weights.
 */
export function runFlyBenchmark(
  input: RunFlyBenchmarkInput
): FlyBenchmarkRunOutput {
  const songResults = [];
  const agreement = [];

  for (const entry of input.dataset) {
    const gt = entry.groundTruth;
    for (const hyp of entry.hypotheses) {
      songResults.push(scoreSongHypothesis(gt, hyp));
    }
    for (let i = 0; i < entry.hypotheses.length; i++) {
      for (let j = i + 1; j < entry.hypotheses.length; j++) {
        agreement.push(
          scoreAnalyzerAgreement(
            gt.songId,
            entry.hypotheses[i]!,
            entry.hypotheses[j]!
          )
        );
      }
    }
  }

  // Stable sort for determinism
  songResults.sort((a, b) =>
    `${a.songId}:${a.analyzerId}`.localeCompare(`${b.songId}:${b.analyzerId}`)
  );
  agreement.sort((a, b) =>
    `${a.songId}:${a.analyzerA}:${a.analyzerB}`.localeCompare(
      `${b.songId}:${a.analyzerA}:${a.analyzerB}`
    )
  );

  const profiles = buildReliabilityProfiles(songResults);
  const reports = buildBenchmarkReports({ songResults, agreement, profiles });

  return {
    benchmarkVersion: FLY_BENCHMARK_VERSION,
    datasetVersion: FLY_DATASET_VERSION,
    groundTruthVersion: FLY_GROUND_TRUTH_VERSION,
    metricsVersion: FLY_METRICS_VERSION,
    songResults,
    agreement,
    profiles,
    reports,
  };
}
