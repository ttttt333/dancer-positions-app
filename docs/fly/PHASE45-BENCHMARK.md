# FLY Phase 4.5 — Benchmark Engine

**benchmark_version:** `1.0.0`  
**dataset_version:** `1.0.0`  
**ground_truth_version:** `1.0.0`  
**metrics_version:** `1.0.0`

## Mission

Measure **which analyzer is trustworthy under which conditions**, with **uncertainty**.  
Do **not** auto-update Fusion weights. Do **not** change Formation Engine.

## Module

`src/lib/fly/benchmark/` — **not** exported from `src/lib/fly/index.ts` (production isolation).

## Pipeline

```
load dataset → hypotheses + GT
  → per-song metrics
  → analyzer agreement
  → condition matrix rollup
  → reliability profiles (score × n × evidenceConfidence)
  → JSON + Markdown report objects
```

## API

```ts
import { runFlyBenchmark } from "../lib/fly/benchmark";

const out = runFlyBenchmark({ dataset });
// out.results, out.profiles, out.agreement, out.reports.json, out.reports.markdown
```

## Success

See implementation checklist in PHASE45-AUDIT + runner tests.  
Phase 5 madmom only after reviewing these profiles (placeholders remain `?`).
