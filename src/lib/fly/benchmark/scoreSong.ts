import type {
  FlyBenchmarkHypothesis,
  FlyBenchmarkSongResult,
  FlyGroundTruthSong,
} from "./types";
import {
  scoreBeats,
  scoreDownbeats,
  scoreEightCounts,
  scoreEvents,
  scoreOnsets,
  scoreSections,
  scoreTempo,
} from "./metrics";
import {
  FLY_BENCHMARK_VERSION,
  FLY_DATASET_VERSION,
  FLY_GROUND_TRUTH_VERSION,
  FLY_METRICS_VERSION,
  evidenceConfidenceFromSampleCount,
} from "./versions";

export function scoreSongHypothesis(
  gt: FlyGroundTruthSong,
  hyp: FlyBenchmarkHypothesis
): FlyBenchmarkSongResult {
  const beatTimes = gt.beats.map((b) => b.beatTime);
  const downRef = gt.downbeats?.map((d) => d.downbeatTime) ?? null;
  // Onset GT: optional — use dedicated field if we add later; v1: no onset GT → NOT_AVAILABLE
  const onsetRef: number[] | null = null;

  const tempo = scoreTempo(gt.bpm, hyp.bpm ?? null);
  const beat = scoreBeats(beatTimes, hyp.beats ?? null);
  const downbeat = scoreDownbeats(downRef, hyp.downbeats ?? null);
  const onset = scoreOnsets(onsetRef, hyp.onsets ?? null);
  const section = scoreSections(gt.sections, hyp.sections ?? null);
  const beatDur =
    gt.bpm && gt.bpm > 0 ? 60 / gt.bpm : null;
  const eightCount = scoreEightCounts(
    gt.eightCounts ?? null,
    hyp.eightCounts ?? null,
    beatDur
  );
  const event = scoreEvents(gt.events ?? null, hyp.events ?? null);

  const parts: number[] = [];
  if (tempo.status === "OK") {
    parts.push(tempo.tempoClassError ? 0 : 1);
  }
  if (beat.status === "OK") {
    parts.push(beat.byThreshold["40"]?.f1 ?? 0);
  }
  if (section.status === "OK" && section.labelF1 != null) {
    parts.push(section.labelF1);
  }
  if (eightCount.status === "OK" && eightCount.phraseAlignmentScore != null) {
    parts.push(eightCount.phraseAlignmentScore);
  }

  const aggregateScore =
    parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
  const sampleCount = parts.length;
  const confidence = evidenceConfidenceFromSampleCount(
    Math.max(
      beat.sampleCount,
      section.sampleCount,
      tempo.sampleCount,
      sampleCount
    )
  );

  return {
    benchmarkVersion: FLY_BENCHMARK_VERSION,
    datasetVersion: gt.datasetVersion || FLY_DATASET_VERSION,
    groundTruthVersion: gt.groundTruthVersion || FLY_GROUND_TRUTH_VERSION,
    metricsVersion: FLY_METRICS_VERSION,
    audioHash: gt.audioHash,
    songId: gt.songId,
    analyzerId: hyp.analyzerId,
    analyzerVersion: hyp.analyzerVersion,
    conditions: gt.conditions,
    metrics: {
      tempo,
      beat,
      downbeat,
      onset,
      section,
      eightCount,
      event,
    },
    aggregateScore,
    confidence,
    provenance: [
      {
        metric: "tempo",
        sources: [
          { analyzer: "ground_truth", value: gt.bpm },
          { analyzer: hyp.analyzerId, value: hyp.bpm ?? null },
        ],
      },
      {
        metric: "beat",
        sources: [
          { analyzer: "ground_truth", value: beatTimes[0] ?? null },
          {
            analyzer: hyp.analyzerId,
            value: hyp.beats?.[0] ?? null,
          },
        ],
      },
    ],
  };
}
