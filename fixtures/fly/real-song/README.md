# Real-Song fixtures (Phase 4.6)

## Layout

```
real-song/
  manifest.ts              # Stage A 20-slot registry
  annotations/             # per-song human GT (JSON)
  hypotheses/              # analyzer outputs (never GT)
  audio/                   # LOCAL ONLY — see audio/README.md
  examples/                # schema examples for tests (not production claims)
```

## Rules

1. Do **not** commit copyrighted audio.
2. Do **not** copy analyzer hypotheses into annotations.
3. `musical_change` ≠ formation change.
4. Until humans annotate, status stays `UNANNOTATED`.
