# FLY Phase 4.6 — Audit (vs 4.5)

**audit_version:** `1.0.0`  
**baseline_commit:** `a08657c` (Phase 4.5)

## Reviewed 4.5 artifacts

| File | Finding |
|------|---------|
| `docs/fly/reports/benchmark-report.md` | Synthetic 5×2=10 rows; almost all F1=1.0 — **not** real accuracy |
| `docs/fly/reports/benchmark-result.json` | Full metrics; evidence mostly **LOW** (n≤5) — correct caution |
| `fixtures/fly/benchmark/dataset.ts` | Synthetic GT + fixture hypotheses; complex/librosa half-time case useful |

## Contract reuse

| 4.5 | 4.6 |
|-----|-----|
| `runFlyBenchmark` | Reused — do not rewrite |
| `FlyGroundTruthSong` | Bridge target from real annotations |
| `AnalyzerReliabilityProfile` | Input to weakness detection |
| Evidence bands LOW/MED/HIGH | Unchanged |
| `NOT_AVAILABLE` | Unchanged |

## Contract extensions (4.6 only)

- `RealSongManifest` + provenance / audioSha256 / sourceType
- Multi-annotator raw → agreement → consensus
- `musical_change` (≠ formation_change)
- `WeaknessFinding` + Active Expansion planner
- Stage A 20-slot condition matrix (mostly `UNANNOTATED` until humans label)

## Explicit non-claims

4.5 report scores must **not** be cited as production analyzer accuracy.  
4.6 Stage A registration ≠ completed human GT.
