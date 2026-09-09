# FLY Phase 4.5 — Dataset Contract

**dataset_version:** `1.0.0`  
**benchmark_version:** `1.0.0`  
**ground_truth_version:** `1.0.0`

## Location

```
fixtures/fly/benchmark/
  dataset.ts          # registry
  songs/*.ts          # per-song GT + hypotheses
```

## Song entry

Each song provides:

1. **Ground truth** (human) — explicit annotations
2. **Hypotheses** per analyzerId — fixture predictions for offline scoring  
   (stand-ins for librosa/Essentia until live analyzers are wired; **not** GT)

## Initial golden set (v1)

| songId | genre | tempo | role |
|--------|-------|-------|------|
| gt-simple-pop | pop | medium | simple structure |
| gt-hiphop | hip-hop | medium | sparse beats |
| gt-edm | edm | fast | drop/break events |
| gt-slow-ballad | ballad | slow | slow timing |
| gt-complex | complex | variable | half-time risk + complex sections |

## Rules

- Analyzer result must never become GT
- Expandable: add songs without schema break
- Production analysis must not load this dataset
