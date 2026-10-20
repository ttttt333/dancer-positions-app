# FLY Phase 4.6 — Overview

**phase:** `4.6`  
**dataset_stage:** `Stage A`  
**real_song_dataset_version:** `4.6.1-double-consensus`  
**annotation_contract_version:** `1.1.0`

## Roadmap (locked)

```
PHASE 4     Adapter / Normalized / Fusion / Essentia
    ↓
PHASE 4.5   Synthetic Benchmark / Ground Truth Engine
    ↓
🔥 PHASE 4.6  Real-Song GT → Consensus → Benchmark → Weakness Taxonomy
    ↓
★ Experiment B (madmom parallel) — Period↑, Phase still 0/20 → no adoption
    ↓
★ 4.6-C Phase Reference Audit — BOTH_OFF_AGREE 18/20 → Hyp B STRONG
    ↓
★ 4.6-D Dance Phase Model DEFINITION LOCKED
      Music Beat ≠ Dance Phase · Phase Anchor · no Fusion yet
    ↓
★ Origin Audit CONDITIONAL-GO — CountGrid≡Beat (L2/L3 collapsed in current GT)
    ↓
★ 4.6-F Phase Anchor Independence Audit — COMPLETE
      Verdict: A CONDITIONAL-GO
    ↓
★ 4.6-G 013 Reproducibility Pilot — DESIGN LOCKED
      Session A frozen · Session B blind (washout)
      docs/fly/PHASE46-013-REPRODUCIBILITY-PILOT.md
    ↓
★ 4.6-H Reproducibility Audit → PASS / CONDITIONAL / HOLD
══════════════════════
PASS → L3 Data Model design (docs) → then implement decision
HOLD/CONDITIONAL → more annotation, no L3 lock
══════════════════════
    ↓
Fusion / MSAF / Analyzer — only after L3 design GO
    ↓
Choreographic Intent → Formation Intelligence → ChoreoCore
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

**DO NOT (production / Fusion / Formation):**

- replace librosa with madmom
- modify Fusion weights / KEEP_CURRENT
- modify Formation Engine
- add MSAF / Cyanite / Demucs
- train models / ML
- retarget GT to analyzer scores
- convert `musical_change` into `formation_change`

**Offline madmom Experiment B** is allowed only after explicit Implement GO under `PHASE46-MADMOM-EXPERIMENT.md` (parallel hyp + compare; no Fusion).

## Human GT sequence (done → next)

1. ~~Confirm 20 tracks~~  
2. ~~Local authorized audio + sha256~~  
3. ~~Human-first annotation~~  
4. ~~Double-annotate 002/005/010/013 → Consensus~~  
5. ~~Benchmark librosa (pattern axes)~~  
6. ~~Weakness Taxonomy~~  
7. **madmom Experiment Spec locked** — await Implement Experiment B GO  
8. Compare A vs B → then Fusion / MSAF decisions  

## Module isolation
- Code: `src/lib/fly/realSong/` — **not** exported from `src/lib/fly/index.ts`
- Fixtures: `fixtures/fly/real-song/`
- Audio: local/private only (`fixtures/fly/real-song/audio/README.md`)
- Production flag remains OFF; no GT/audio in production bundle
