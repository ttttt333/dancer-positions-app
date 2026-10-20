# FLY Phase 4 — Audit

**Date:** 2026-09-09  
**Baseline commit:** `47c3771` (FLY Phase 1–3)

## 1. Existing FLY surface

| Path | Role |
|------|------|
| `src/lib/fly/types.ts` | `FlyAnalysisResult`, Tempo/Beat/CountGrid/Sections/Events |
| `src/lib/fly/fromStructureV2.ts` | StructureResultV2 → FLY projection |
| `src/lib/fly/toStructureV2.ts` | FLY → StructureResultV2 (Formation Engine safe) |
| `src/lib/fly/fusion.ts` | Single-source passthrough fusion |
| `src/lib/fly/client.ts` | `analyzeSongWithFly()` |
| `backend/analyzer/fly_music_intelligence/` | versions + `attach_fly_meta` |

## 2. Formation Engine boundary (DO NOT BREAK)

- Input remains `StructureResultV2` + legacy change points
- `runEngineAppSuggest` / `pickFormationPushingLimit` untouched in Phase 4
- Essentia must never feed Formation Engine directly

## 3. Audio / Edge path

- Client: `songAnalyzeClient` → Edge `analyze-song` → Fly `/api/v2/analyze-structure`
- Cache: `audio_hash` + `analyzer_version` (`algo-v1.5.0`)
- Browser fallback: `songStructureAnalysis.ts`

## 4. Essentia runtime feasibility

| Runtime | Feasible? | Notes |
|---------|-----------|--------|
| **Browser (WASM)** | Yes | `essentia.js` 0.1.3 — Essentia WASM via Emscripten |
| **Node.js** | Yes | Same package; needs decoded PCM (Float32), no built-in mp3 decode |
| **Supabase / Vercel Edge** | **No** | No reliable WASM+large binary / Python; cold start & memory risk |
| **Fly Python backend** | Optional later | Native Essentia C++ install is heavy; not required for Phase 4 adapter contract |
| **Bundle size** | High | WASM glue + `.wasm` — must stay **optional / dynamic**, default OFF |

**Decision for Phase 4:**

1. Implement **Adapter Interface** + **Essentia Adapter** in TypeScript under `src/lib/fly/adapters/`.
2. Default **`VITE_FLY_ESSENTIA_ENABLED=false`** — no change to user path.
3. Runtime is **pluggable**:
   - `mock` — deterministic tests / CI (no WASM)
   - `essentia.js` — dynamic import when flag ON and package present
   - `unavailable` — clean error → Fusion fallback to existing librosa/AIO path
4. Do **not** add `essentia.js` as a hard dependency (AGPL-3.0 + size). Document optional install for local enablement.
5. Edge Functions must **not** call Essentia.

## 5. Capabilities planned for mapping

From Essentia.js (when runtime available): tempo/BPM, beats, onsets, loudness/spectral helpers.  
Downbeat: capability declared but **not invented** if algorithm unavailable.  
Segmentation/key/chords: capability stubs only if not reliably exposed in 0.1.3 API used by adapter.

## 6. Phase 4.5 note (out of scope now)

After Phase 4: **FLY Benchmark / Ground Truth** before madmom/MSAF — compare analyzers vs human labels per condition.
