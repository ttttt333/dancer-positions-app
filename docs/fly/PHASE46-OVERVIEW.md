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

## Human GT sequence (locked — prefer people over code)

1. **Confirm 20 tracks** filling the matrix  
2. **Local authorized audio** → sha256 → manifest (no audio in git)  
3. **Human-first annotation** (SOP: `PHASE46-ANNOTATION-SOP.md`)  
4. **Double-annotate** 002 / 005 / 010 / 013 → agreement → consensus  
5. **Benchmark** librosa & Essentia vs Human GT  
6. **Weakness** → Active Expansion (+10) — still **no** madmom / Fusion / Formation  

After Stage A Benchmark: **Phase 4.6 Benchmark Review** before Phase 5.

## Module isolation
- Code: `src/lib/fly/realSong/` — **not** exported from `src/lib/fly/index.ts`
- Fixtures: `fixtures/fly/real-song/`
- Audio: local/private only (`fixtures/fly/real-song/audio/README.md`)
- Production flag remains OFF; no GT/audio in production bundle
