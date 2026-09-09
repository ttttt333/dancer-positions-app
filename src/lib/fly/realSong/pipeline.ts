import type { FlyBenchmarkRunOutput } from "../benchmark/types";
import { runFlyBenchmark } from "../benchmark/benchmarkRunner";
import type { FlyBenchmarkDatasetEntry } from "../benchmark/benchmarkRunner";
import { detectWeaknesses, planActiveExpansion } from "./weakness";
import type { ExpansionPlan, WeaknessFinding } from "./types";
import {
  FLY_REAL_SONG_DATASET_VERSION,
  FLY_WEAKNESS_VERSION,
  PHASE46_FREEZE,
} from "./versions";

export type RealSongBenchmarkBundle = {
  benchmark: FlyBenchmarkRunOutput;
  weaknesses: WeaknessFinding[];
  expansion: ExpansionPlan;
  meta: {
    realSongDatasetVersion: string;
    weaknessVersion: string;
    freeze: readonly string[];
    annotatedSongCount: number;
    lowSampleSize: boolean;
  };
  reports: {
    benchmarkMarkdown: string;
    weaknessMarkdown: string;
    weaknessJson: string;
    reliabilityMapJson: string;
  };
};

export function runRealSongBenchmarkPipeline(
  dataset: FlyBenchmarkDatasetEntry[]
): RealSongBenchmarkBundle {
  const benchmark = runFlyBenchmark({ dataset });
  const weaknesses = detectWeaknesses(benchmark.profiles);
  const expansion = planActiveExpansion(weaknesses);

  const weaknessMarkdown = renderWeaknessReport(weaknesses, expansion, dataset.length);
  const reliabilityMap = {
    version: "reserved-4.6",
    note: "Not wired to Fusion weights",
    freeze: PHASE46_FREEZE,
    profiles: benchmark.profiles,
  };

  return {
    benchmark,
    weaknesses,
    expansion,
    meta: {
      realSongDatasetVersion: FLY_REAL_SONG_DATASET_VERSION,
      weaknessVersion: FLY_WEAKNESS_VERSION,
      freeze: PHASE46_FREEZE,
      annotatedSongCount: dataset.length,
      lowSampleSize: expansion.lowSampleSizeWarning || dataset.length < 20,
    },
    reports: {
      benchmarkMarkdown: prefixRealSongBanner(benchmark.reports.markdown, dataset.length),
      weaknessMarkdown,
      weaknessJson: JSON.stringify(
        { weaknesses, expansion, meta: { version: FLY_WEAKNESS_VERSION } },
        null,
        2
      ),
      reliabilityMapJson: JSON.stringify(reliabilityMap, null, 2),
    },
  };
}

function prefixRealSongBanner(md: string, n: number): string {
  return [
    `# FLY Real-Song Benchmark`,
    ``,
    `> **LOW SAMPLE SIZE** — annotated songs in this run: ${n}. Do not claim production accuracy.`,
    `> Phase 4.6 FREEZE: no Fusion weight / Formation / madmom changes.`,
    ``,
    md,
  ].join("\n");
}

function renderWeaknessReport(
  findings: WeaknessFinding[],
  expansion: ExpansionPlan,
  annotatedN: number
): string {
  const lines: string[] = [];
  lines.push(`# FLY Weakness Report (Phase 4.6)`);
  lines.push(``);
  lines.push(`- weakness_version: \`${FLY_WEAKNESS_VERSION}\``);
  lines.push(`- annotated songs in run: ${annotatedN}`);
  lines.push(
    `- lowSampleSizeWarning: **${expansion.lowSampleSizeWarning ? "YES" : "NO"}**`
  );
  lines.push(``);
  lines.push(`## FREEZE`);
  lines.push(``);
  for (const f of PHASE46_FREEZE) lines.push(`- ${f}`);
  lines.push(``);
  lines.push(`## Findings (WEAK / WATCH first)`);
  lines.push(``);
  lines.push(
    `| severity | analyzer | dimension | condition | score | n | evidence |`
  );
  lines.push(`|----------|----------|-----------|-----------|-------|---|----------|`);
  for (const w of findings.filter((f) => f.severity !== "INFO").slice(0, 40)) {
    lines.push(
      `| ${w.severity} | ${w.analyzer} | ${w.dimension} | ${w.condition} | ${w.score.toFixed(3)} | ${w.sampleCount} | ${w.evidenceConfidence} |`
    );
  }
  lines.push(``);
  lines.push(`## Active Expansion Plan (+${expansion.suggestedSongCount})`);
  lines.push(``);
  if (expansion.targetConditions.length) {
    for (const t of expansion.targetConditions) lines.push(`- ${t}`);
  } else {
    lines.push(`- (no targeted conditions yet — finish Stage A annotations)`);
  }
  lines.push(``);
  lines.push(`### Rationale`);
  lines.push(``);
  for (const r of expansion.rationale) lines.push(`- ${r}`);
  return lines.join("\n");
}
