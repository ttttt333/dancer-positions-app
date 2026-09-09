/**
 * Offline report writer — Node only (tsconfig.node).
 * Usage: npx vite-node scripts/write-fly-benchmark-reports.ts
 * Fallback: npm run test:fly-benchmark && (reports regenerated here when vite-node available)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFlyBenchmark } from "../src/lib/fly/benchmark/benchmarkRunner";
import { loadFlyBenchmarkGoldenDataset } from "../fixtures/fly/benchmark/dataset";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/fly/reports");

const out = runFlyBenchmark({ dataset: loadFlyBenchmarkGoldenDataset() });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "benchmark-result.json"), out.reports.json, "utf8");
writeFileSync(join(outDir, "benchmark-report.md"), out.reports.markdown, "utf8");
console.log(`Wrote ${out.songResults.length} song×analyzer results → ${outDir}`);
