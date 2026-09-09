/**
 * Reliability profiles: Accuracy × Condition × Evidence (sampleCount).
 * Never invent scores — only aggregate from FlyBenchmarkSongResult.
 */

import type {
  AnalyzerReliabilityProfile,
  FlyBenchmarkSongResult,
} from "./types";
import { conditionKeysFromTags } from "./conditionMatrix";
import { evidenceConfidenceFromSampleCount } from "./versions";

type Acc = {
  sum: number;
  n: number;
  analyzerVersion: string;
};

function add(
  map: Map<string, Acc>,
  key: string,
  score: number | null | undefined,
  analyzerVersion: string,
  weight = 1
): void {
  if (score == null || !Number.isFinite(score)) return;
  const cur = map.get(key) ?? { sum: 0, n: 0, analyzerVersion };
  cur.sum += score * weight;
  cur.n += weight;
  cur.analyzerVersion = analyzerVersion;
  map.set(key, cur);
}

export function buildReliabilityProfiles(
  results: FlyBenchmarkSongResult[]
): AnalyzerReliabilityProfile[] {
  const map = new Map<string, Acc>();

  for (const r of results) {
    const conditions = conditionKeysFromTags(r.conditions);
    const ver = r.analyzerVersion;
    const id = r.analyzerId;

    const beatF1 = r.metrics.beat.byThreshold["40"]?.f1;
    const sectionF1 = r.metrics.section.labelF1;
    const tempoOk =
      r.metrics.tempo.status === "OK"
        ? r.metrics.tempo.tempoClassError
          ? 0
          : 1
        : null;
    const eight = r.metrics.eightCount.phraseAlignmentScore;

    for (const cond of conditions) {
      add(map, `${id}|beat|${cond}|f1@40ms`, beatF1, ver);
      add(map, `${id}|section|${cond}|labelF1`, sectionF1, ver);
      add(map, `${id}|tempo|${cond}|classCorrect`, tempoOk, ver);
      add(map, `${id}|eightCount|${cond}|phraseAlignment`, eight, ver);
    }
    // global "all" condition
    add(map, `${id}|beat|all|f1@40ms`, beatF1, ver);
    add(map, `${id}|section|all|labelF1`, sectionF1, ver);
    add(map, `${id}|tempo|all|classCorrect`, tempoOk, ver);
    add(map, `${id}|eightCount|all|phraseAlignment`, eight, ver);
  }

  const profiles: AnalyzerReliabilityProfile[] = [];
  for (const [key, acc] of map) {
    const [analyzerId, signalType, condition, metric] = key.split("|");
    const score = acc.n > 0 ? acc.sum / acc.n : null;
    profiles.push({
      analyzerId: analyzerId!,
      analyzerVersion: acc.analyzerVersion,
      signalType: signalType!,
      condition: condition!,
      metric: metric!,
      score,
      sampleCount: acc.n,
      evidenceConfidence: evidenceConfidenceFromSampleCount(acc.n),
      status: acc.n > 0 ? "OK" : "EMPTY",
    });
  }

  return profiles.sort((a, b) =>
    `${a.analyzerId}:${a.signalType}:${a.condition}:${a.metric}`.localeCompare(
      `${b.analyzerId}:${b.signalType}:${b.condition}:${b.metric}`
    )
  );
}
