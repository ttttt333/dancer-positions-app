# FLY Phase 4.5 — Ground Truth Contract

**ground_truth_version:** `1.0.0`  
**benchmark_version:** `1.0.0`

## Principle

Ground Truth is a **human-annotated reference**, not absolute truth.

- Multiple annotators allowed → consensus + disagreement retained
- Inter-annotator agreement is a future metric input
- Analyzer outputs must never be copied into GT

## Song

| Field | Type | Required |
|-------|------|----------|
| songId | string | yes |
| audioHash | string | yes |
| durationSeconds | number | yes |
| genre | string | yes |
| tempoCategory | `"slow" \| "medium" \| "fast" \| "variable"` | yes |
| datasetVersion | string | yes |
| conditions | ConditionTags | yes |
| bpm | number \| null | recommended |
| title | string | optional |

## Section

| Field | Notes |
|-------|--------|
| startTime / endTime | seconds |
| label | INTRO \| VERSE \| PRE_CHORUS \| CHORUS \| BRIDGE \| BREAK \| OUTRO \| OTHER (+ extensible string) |
| confidence | annotator confidence 0–1 |
| annotatorId | required |
| annotationVersion | required |

## Beat / Downbeat / 8-count / Event

See TypeScript: `src/lib/fly/benchmark/types.ts`  
`FlyGroundTruthSong` is the canonical schema.

## Events (optional layer)

Types: BREAK, DROP, IMPACT, ENERGY_RISE, ENERGY_FALL, VOCAL_ENTRY, VOCAL_EXIT, DRUM_ENTRY, DRUM_BREAK, SECTION_CHANGE  
Missing events → metric status `NOT_AVAILABLE` (not zero).

## Consensus

When multiple annotators present:

```
agreement = fraction agreeing within tolerance
disagreement = 1 - agreement
confidence = mean annotator confidence × agreement
```

Consensus tracks are optional in v1 fixtures (single annotator OK).
