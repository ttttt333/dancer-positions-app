# FLY Phase 4 — Benchmark notes

**Date:** 2026-09-09  
**Fusion version:** `fly-fusion-v0.2.0`  
**Essentia adapter:** `fly-essentia-adapter-v0.1.0`

## Runtime under test

| Mode | Used in CI | Notes |
|------|------------|--------|
| `mock` Essentia runtime | **Yes** | Deterministic beats from configured BPM; no WASM |
| `essentia.js` WASM | Optional local | Dynamic import; AGPL; not a hard dependency |
| Edge | **No** | Incompatible (see PHASE4-AUDIT.md) |

## Measured (mock runtime, Node/vitest)

Synthetic 4s @ 44.1 kHz mono Float32, BPM=120 mock.

| Metric | Approx |
|--------|--------|
| Adapter init | &lt; 1 ms (mock) |
| Analysis time | &lt; 5 ms (mock) |
| Peak extra memory | ~duration × 4 bytes PCM only (input) |
| Output JSON size (mapped result) | ~1–3 KB for short clip |
| Bundle impact (default flag OFF) | **0** — no essentia.js in deps |

## Real essentia.js (when optionally installed)

Expect:

- WASM init: hundreds of ms – few s (cold)
- Analysis: tens–hundreds of ms depending on duration
- Bundle: large (WASM + glue) — keep dynamic / flag-gated

Re-run locally after `npm install essentia.js` with `VITE_FLY_ESSENTIA_ENABLED=true` and `preferWasm: true`.

## Determinism keys stored by Fusion

- `audioHash`
- `analyzerVersions[]`
- `adapterVersions[]`
- `fusionVersion`

## Analysis Lab readiness

Provenance keeps per-source tempo/beat/onset so Lab can render:

```
BEAT @ ~12.48s
  librosa:  12.477
  essentia: 12.481
```

Phase 4 does **not** score which source is “correct” — that is **Phase 4.5 Benchmark / Ground Truth**.
