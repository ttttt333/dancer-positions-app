# FLY Phase 4.5 — Audit

**audit_version:** `1.0.0`  
**benchmark_version:** `1.0.0`  
**Date:** 2026-09-09  
**Baseline:** `917e52d` (Phase 4 Essentia adapter)

## 1. Phase 4 contracts (intact — do not break)

| Item | Location | Notes |
|------|----------|--------|
| `FlyAnalyzerAdapter` | `src/lib/fly/adapters/types.ts` | `analyze(FlyAudioInput) → FlyAnalyzerResult` |
| `FlyAnalyzerResult` | same | tempo / beat / downbeats / onsets + provenance; **no sections field yet** |
| Tempo | `Partial<TempoAnalysis>` | estimatedBpm, candidates, confidence; half/double may be undefined |
| Beat | `Partial<BeatAnalysis>` + optional `beatConfidences` | beats: number[] times |
| Provenance | `FlyMetricProvenance` | metric + sources[{analyzer, confidence, value}] |
| Fusion | `fusionMulti.ts` | `FlyFusionInput.analyzers[]` → provenance + sourceAgreement |
| Feature flag | `VITE_FLY_ESSENTIA_ENABLED` default false | production path unchanged when off |
| Versions | `fly-fusion-v0.2.0`, adapter versions | |
| Formation path | `StructureResultV2` via `toStructureV2` | **unchanged in 4.5** |

## 2. Gaps for Benchmark (by design, not bugs)

1. **Sections / 8-count / events** are on `FlyAnalysisResult` / `StructureResultV2`, not on `FlyAnalyzerResult`.  
   → Benchmark uses a separate **`FlyBenchmarkHypothesis`** that can wrap adapter output **plus** optional section/eight/event hypotheses (fixture or projected from V2). Does **not** mutate adapter contract.

2. **No Ground Truth model** yet → Phase 4.5 creates it under `src/lib/fly/benchmark/`.

3. **No audio fixtures** for FLY → synthetic annotated fixtures under `fixtures/fly/benchmark/` (human GT explicit; never copy analyzer → GT).

4. **Edge** — Benchmark must not depend on Supabase Edge / Fly remote. Offline fixtures only.

5. **Production public API** (`src/lib/fly/index.ts`) must **not** re-export benchmark (bundle isolation).

## 3. Existing related code (do not merge into production path)

- `src/lib/choreocore/engine/annotation/*` — formation annotation sessions (different domain).
- `musicAccuracyFixtures` etc. — engine calibration, not FLY Ensemble.

Reuse patterns only; keep FLY Benchmark namespace separate.

## 4. Test helpers

- Vitest: `src/**/*.test.{ts,tsx}`
- Phase 4 tests: `src/lib/fly/adapters/essentia/tests/*`, `fusion.test.ts`
- No shared audio decode fixture required for 4.5 metrics (time-series arrays in JSON/TS).

## 5. Non-negotiables confirmed

- Formation Engine: **no edits**
- StructureResultV2 type: **no edits**
- Phase 4 adapters/fusion: **read-only** from benchmark (import types/helpers only)
- No automatic Fusion weight updates
- No madmom / MSAF / dance KEEP_CURRENT

## 6. Implementation plan (this phase)

`src/lib/fly/benchmark/**` + `fixtures/fly/benchmark/**` + docs `PHASE45-*.md`  
Runner: test + `runFlyBenchmark()` → JSON/MD objects (optional write under `docs/fly/reports/` when scripted).
