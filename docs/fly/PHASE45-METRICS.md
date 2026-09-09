# FLY Phase 4.5 — Metrics Spec

**metrics_version:** `1.0.0`  
**benchmark_version:** `1.0.0`

## Uncertainty (mandatory)

Every aggregate score carries:

| Field | Meaning |
|-------|---------|
| sampleCount | n observations / songs contributing |
| evidenceConfidence | `NONE` \| `LOW` \| `MEDIUM` \| `HIGH` |
| status | `OK` \| `NOT_AVAILABLE` \| `EMPTY` |

**Never treat F1=0.91 with n=3 the same as F1=0.91 with n=100.**

Evidence bands (v1):

- HIGH: n ≥ 30
- MEDIUM: n ≥ 10
- LOW: n ≥ 1
- NONE: n = 0

## Tempo

- absoluteErrorBpm
- relativeErrorPercent
- tempoClassError (false if 0.5× / 1× / 2× equivalent within 4%)
- equivalenceRatio: 0.5 \| 1 \| 2 \| null

## Beat / Onset / Downbeat

Thresholds evaluated separately: ±20 / ±40 / ±60 / ±100 ms (onset: 20/50/100).  
precision, recall, F1, meanTimingError, medianTimingError  
Downbeat / events without GT → `NOT_AVAILABLE`

## Section

Separated:

1. Boundary timing error (matched segments)
2. Label precision/recall/F1
3. Mean IoU (overlap)

## 8-count

startTimingError, endTimingError, countBoundaryError, phraseAlignmentScore  
Detect off-by-one-count (≈ one beatDuration shift).

## Agreement vs Accuracy

Analyzer–analyzer agreement is **separate** from GT accuracy.  
Agreement ≠ correctness.

## Reliability profile

`AnalyzerReliabilityProfile`: analyzerId × signalType × condition × metric → score + sampleCount + evidenceConfidence  
**No invented numbers** — only computed from runs.
