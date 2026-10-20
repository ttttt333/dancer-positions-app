import type {
  AnalyzerAgreementPair,
  AnalyzerReliabilityProfile,
  FlyBenchmarkRunOutput,
  FlyBenchmarkSongResult,
} from "./types";
import {
  FLY_BENCHMARK_VERSION,
  FLY_DATASET_VERSION,
  FLY_GROUND_TRUTH_VERSION,
  FLY_METRICS_VERSION,
} from "./versions";

export function buildBenchmarkReports(input: {
  songResults: FlyBenchmarkSongResult[];
  agreement: AnalyzerAgreementPair[];
  profiles: AnalyzerReliabilityProfile[];
}): { json: string; markdown: string } {
  const payload: FlyBenchmarkRunOutput = {
    benchmarkVersion: FLY_BENCHMARK_VERSION,
    datasetVersion: FLY_DATASET_VERSION,
    groundTruthVersion: FLY_GROUND_TRUTH_VERSION,
    metricsVersion: FLY_METRICS_VERSION,
    songResults: input.songResults,
    agreement: input.agreement,
    profiles: input.profiles,
    reports: { json: "", markdown: "" },
  };

  const json = JSON.stringify(
    {
      ...payload,
      reports: undefined,
    },
    null,
    2
  );

  const lines: string[] = [];
  lines.push(`# FLY Benchmark Report`);
  lines.push(``);
  lines.push(`- benchmark_version: \`${FLY_BENCHMARK_VERSION}\``);
  lines.push(`- dataset_version: \`${FLY_DATASET_VERSION}\``);
  lines.push(`- ground_truth_version: \`${FLY_GROUND_TRUTH_VERSION}\``);
  lines.push(`- metrics_version: \`${FLY_METRICS_VERSION}\``);
  lines.push(`- songs×analyzers: ${input.songResults.length}`);
  lines.push(`- profiles: ${input.profiles.length}`);
  lines.push(``);
  lines.push(`## Per-song aggregates`);
  lines.push(``);
  lines.push(`| song | analyzer | aggregate | evidence | beat F1@40 | section F1 |`);
  lines.push(`|------|----------|-----------|----------|------------|------------|`);
  for (const r of input.songResults) {
    const beat = r.metrics.beat.byThreshold["40"]?.f1;
    const sec = r.metrics.section.labelF1;
    lines.push(
      `| ${r.songId} | ${r.analyzerId} | ${fmt(r.aggregateScore)} | ${r.confidence} | ${fmt(beat)} | ${fmt(sec)} |`
    );
  }
  lines.push(``);
  lines.push(`## Reliability profiles (Accuracy × Condition × Evidence)`);
  lines.push(``);
  lines.push(
    `| analyzer | signal | condition | metric | score | n | evidence |`
  );
  lines.push(`|----------|--------|-----------|--------|-------|---|----------|`);
  for (const p of input.profiles.slice(0, 80)) {
    lines.push(
      `| ${p.analyzerId} | ${p.signalType} | ${p.condition} | ${p.metric} | ${fmt(p.score)} | ${p.sampleCount} | ${p.evidenceConfidence} |`
    );
  }
  if (input.profiles.length > 80) {
    lines.push(``);
    lines.push(`_… ${input.profiles.length - 80} more profiles truncated in MD_`);
  }
  lines.push(``);
  lines.push(`## Analyzer agreement (≠ accuracy)`);
  lines.push(``);
  for (const a of input.agreement) {
    lines.push(
      `- ${a.songId}: ${a.analyzerA} vs ${a.analyzerB} — tempo=${fmt(a.tempoAgreement)} beatF1=${fmt(a.beatAgreement)} section=${fmt(a.sectionAgreement)}`
    );
  }
  lines.push(``);
  lines.push(
    `> Profiles with LOW evidence must not drive Fusion weights. Phase 4.5 does not auto-update weights.`
  );

  return { json, markdown: lines.join("\n") };
}

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(3);
}
