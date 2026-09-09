# FLY Phase 4.6 — Benchmark

**benchmark_bridge_version:** `1.0.0`

## Rule

**Reuse** Phase 4.5 `runFlyBenchmark` — do not fork a second engine.

```
Real consensus GT → FlyGroundTruthSong
Analyzer hypotheses → FlyBenchmarkHypothesis
runFlyBenchmark({ dataset })
```

Analyzers in 4.6: **librosa**, **Essentia** only.

## Reports

```
docs/fly/reports/
  real-song-benchmark-report.md
  real-song-benchmark-result.json
  weakness-report.md
  weakness-report.json
  analyzer-reliability-map.json   # reserved; no Fusion wiring
```

Always surface **LOW SAMPLE SIZE** when Stage A n is small / mostly unannotated.

## Missing data

`NOT_AVAILABLE` — never coerce to 0 score for missing GT dimensions.
