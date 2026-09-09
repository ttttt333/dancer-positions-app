#!/usr/bin/env node
/**
 * Offline FLY Benchmark runner (dev/test only).
 * Does not import into production client bundle.
 *
 * Usage: node --experimental-strip-types scripts/run-fly-benchmark.mjs
 * Prefer: npx vitest run src/lib/fly/benchmark/benchmark.test.ts
 * Or: npm run test:fly-benchmark
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/fly/reports");

async function main() {
  // Dynamic import via vitest-transpiled path is awkward in plain node.
  // This script documents the intended output location; actual generation
  // runs inside the vitest suite writeReport.test helper below if executed.
  console.log(
    JSON.stringify(
      {
        note: "Use npm run test:fly-benchmark — reports also written by writeReports side test",
        outDir,
      },
      null,
      2
    )
  );
}

main();
