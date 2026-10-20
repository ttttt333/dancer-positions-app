# FLY Phase 4.6 — Benchmark

**benchmark_bridge_version:** `1.0.0`  
**Gate:** **GO** (2026-09-13) — Consensus locked `4.6.1-double-consensus`

## Rule

**Reuse** Phase 4.5 metric helpers where possible — Beat uses **pattern scorer**, not pointwise F1.

```
Real consensus GT → pattern derive
Analyzer hypotheses → Period / Phase / Continuity / Evidence
Finding class → PASS | WEAK | GT-AMBIGUITY | ANALYZER-LIMIT
```

Analyzers in 4.6: **librosa**, **Essentia** only (Essentia may be `NOT_AVAILABLE`).

## Beat dimension (Phase 4.6 pattern GT)

Reuse Stage A annotations as **Beat Pattern** seeds (`PHASE46-BEAT-PATTERN-GT.md`).

Report:

| Sub-metric | Meaning |
|------------|---------|
| Period Accuracy | GT interval vs analyzer median interval |
| Phase Accuracy | Analyzer phase vs GT seed lock |
| Continuity Accuracy | Stability of phase offset (drift), not absolute lock |
| Confidence / Evidence | Stability / support |

**Forbidden:** pointwise F1 of ~20 human seeds vs full-song analyzer beat lists.

**song-013:** Consensus phase policy locked — ~half-beat offset is **phase error**, never dual-phase GT / GT-AMBIGUITY.

## Commands

```bash
npm run fly:real-song-hypotheses   # librosa batch → ~/ChoreoCoreDatasets/.../hypotheses
npm run fly:real-song-benchmark    # pattern-aware GO reports
```

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
