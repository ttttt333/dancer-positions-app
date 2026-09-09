# FLY Phase 4.6 — Overview

**phase:** `4.6`  
**dataset_stage:** `Stage A`  
**real_song_dataset_version:** `4.6.0-stage-a`  
**annotation_contract_version:** `1.0.0`

## Roadmap (locked)

```
PHASE 4     Adapter / Normalized / Fusion / Essentia
    ↓
PHASE 4.5   Synthetic Benchmark / Ground Truth Engine
    ↓
🔥 PHASE 4.6  Real-Song Ground Truth + Weakness Detection
    ↓         (Active Expansion: 20 → +10 targeted → …)
══════════════════════
BENCHMARK REVIEW
══════════════════════
    ↓
PHASE 5     madmom   (only if evidence says Beat/Downbeat weak)
    ↓
PHASE 6     MSAF
    ↓
Cyanite / Stem → FLY Fusion → Dance Intelligence → ChoreoCore
```

## Mission

**Discover where current FLY analyzers fail on real dance music** — not fix them.

```
REAL AUDIO → Human GT → librosa/Essentia hypotheses
  → Benchmark (reuse 4.5) → Weakness Detection
  → Active Dataset Expansion (+10 targeted)
```

## PHASE 4.6 FREEZE

This phase is **measurement-first**.

**DO NOT:**

- add madmom / MSAF / Cyanite / Demucs
- modify Fusion weights
- modify Formation Engine
- add KEEP_CURRENT / formation recommendation
- train models / ML
- optimize based on benchmark results
- convert `musical_change` into `formation_change`

All analyzer improvements wait until **Benchmark Review** after 4.6.

## Stage A focus

Selecting the first **20 songs by difficulty matrix** matters more than collecting 20 random tracks.

See `PHASE46-DATASET.md`.

## Module isolation

- Code: `src/lib/fly/realSong/` — **not** exported from `src/lib/fly/index.ts`
- Fixtures: `fixtures/fly/real-song/`
- Audio: local/private only (`fixtures/fly/real-song/audio/README.md`)
- Production flag remains OFF; no GT/audio in production bundle
