# PHASE 4.6 — madmom Beat/Downbeat Experiment Spec

**Status:** EXPERIMENT B COMPLETE — formal adoption **not** recommended from B alone  
**Experiment ID:** `4.6-exp-madmom-beat-v1`  
**Date locked:** 2026-09-13 · **B completed:** 2026-09-13  
**Prerequisite:** Weakness Taxonomy Audit complete (`real-song-weakness-taxonomy.*`)

---

## 1. Why this experiment (Evidence, not hype)

Taxonomy showed librosa failures are **not** “BPM wrong”:

| Failure type | n |
|--------------|---|
| PHASE_HALFBEAT_UNSTABLE | 11 |
| PHASE_HALFBEAT_STABLE | 7 |
| PERIOD_BREAK | 1 (song-009) |
| PHASE_DRIFT | 1 (song-020) |
| GT-AMBIGUITY | **0** |

ChoreoCore needs more than “this song is ~90 BPM.” It needs:

> **this phase is count 1 → carve 8-counts → cue formation / blocking**

song-013 Golden Case proves the split:

```
Period PASS · Phase FAIL · Continuity WEAK · Evidence PASS
→ BPM/period skill ≠ dance-usable Beat Phase skill
```

**Conclusion:** madmom Beat/Downbeat is the **first minimal analyzer add candidate**.  
**Not yet:** MSAF, Fusion weights, Formation Engine, GT edits.

---

## 2. Absolute locks (must not change)

| Lock | Value |
|------|--------|
| Songs | Golden **20** only (no expansion) |
| GT | Consensus for 002/005/010/013; annotator-a otherwise |
| GT / dataset version | `4.6.1-double-consensus` |
| Annotation contract | `1.1.0` (pattern + continuation) |
| Beat axes | **Period / Phase / Continuity / Evidence** only |
| Thresholds | Same as librosa GO (`scoreBeatPattern.ts` constants) |
| Eval scripts | Same runner path; analyzer id is the only hyp switch |
| song-013 phase policy | Half-beat ≠ dual-phase GT; Consensus seed = B |
| Pointwise Beat F1 | **Forbidden** |
| Seed-density-as-accuracy | **Forbidden** |
| Retarget GT to analyzer | **Forbidden** |

**Only allowed delta:** add madmom Beat (+ Downbeat) hypothesis files and score them.

---

## 3. Architecture (parallel — do not replace librosa)

```
Audio (analysis/*.wav)
        │
        ├──────────────────────┐
        ▼                      ▼
   librosa (KEEP)          madmom (ADD — experiment only)
   ├─ BPM                  ├─ Beat
   ├─ Beat                 └─ Downbeat
   └─ existing signals
        │                      │
        └──────────┬───────────┘
                   ▼
         FLY Beat Candidate Layer
         (store both hyps; NO Fusion yet)
                   │
                   ▼
         Pattern scorer
         Period / Phase / Continuity / Evidence
                   │
                   ▼
         Compare report: librosa vs madmom
```

### Rules

1. **Do not** delete or disable librosa Beat for this experiment.  
2. **Do not** wire madmom into production Fusion / Formation.  
3. **Do not** average phase scores (“1.0 + 0.5 → 0.75”).  
4. madmom may emit BPM for provenance, but **primary comparison** is Beat Pattern axes (+ Downbeat Pattern axes).  
5. Downstream “Existing FLY” stays frozen; Candidate Layer is **offline hyp storage + benchmark only**.

---

## 4. Experiments

### Experiment A — baseline (already run)

- Analyzer: **librosa only**
- Artifacts: `hypotheses/song-XXX/librosa.json`
- Report: `real-song-benchmark-result.json` (gate GO)

### Experiment B — madmom alone (to run after implement GO)

- Analyzer: **madmom Beat + Downbeat only** (no librosa mix in the scored hyp)
- Artifacts: `hypotheses/song-XXX/madmom.json`
- Same GT, same scorer, same thresholds
- Report: `real-song-benchmark-madmom-result.json` (+ comparison doc)

### Explicitly deferred

| Item | Status |
|------|--------|
| Experiment C — Fusion / ensemble of librosa+madmom | **OUT OF SCOPE** until A vs B comparison reviewed |
| MSAF / structure | **OUT OF SCOPE** until Section LIMIT appears under a real structure hyp |
| Essentia | Optional later; not required for B |
| Dataset +10 | **OUT OF SCOPE** |

---

## 5. madmom scope (minimal)

### In scope

- Offline batch over `~/ChoreoCoreDatasets/fly-real-song/analysis/{001..020}.wav`
- Outputs per song: `beats[]`, `downbeats[]`, optional `bpm`
- Write `AnalyzerHypothesisFile` with `analyzerId: "madmom"`
- Version stamp: `analyzerVersion` must be pinned (exact package / model id in JSON)

### Out of scope

- Replacing librosa in app runtime
- Changing Fusion weights / KEEP_CURRENT
- Section / MSAF / Musical-change models
- Retraining / fine-tuning madmom
- Touching Formation Engine

### Suggested madmom surface (implementation may choose exact API, but must document)

- Beat tracker + Downbeat tracker from madmom’s standard DBN / RNN pipeline  
- One deterministic config for all 20 songs (no per-song tuning during Experiment B)  
- If GPU/CPU differ, record `runtimeNotes` in hyp meta — do not retune to chase scores

---

## 6. Comparison metrics (fixed)

Per song, per analyzer:

| Axis | Verdict bands | Same as GO |
|------|---------------|------------|
| Period | PASS / WEAK / FAIL | yes |
| Phase | PASS / WEAK / FAIL (+ halfBeatRatio) | yes |
| Continuity | PASS / WEAK / FAIL | yes |
| Evidence | PASS / WEAK / FAIL | yes |
| Finding class | PASS / WEAK / GT-AMBIGUITY / ANALYZER-LIMIT | yes |

### Headline comparison table (required deliverable)

```
                 librosa (A)     madmom (B)
Period PASS        n/20            n/20
Phase PASS         n/20            n/20
Continuity PASS    n/20            n/20
Evidence PASS      n/20            n/20
Beat WEAK          n               n
Beat ANALYZER-LIMIT n              n
GT-AMBIGUITY       0 (expect)      0 (expect)
```

Also required:

- Per-song delta table (especially **013**, **009**, PHASE_HALFBEAT_* sets)
- Taxonomy re-cluster for madmom (`failureType` counts)
- **Do not** declare success from BPM-only improvement

---

## 7. Decision rules (after Experiment B)

### Promote madmom to “adoption candidate” if **all** hold:

1. **Phase:** clear lift vs librosa on Golden 20 (more PASS/WEAK-up, fewer half-beat FAILs)  
2. **song-013:** Phase improves without breaking Period PASS (or Period stays ≥ WEAK)  
3. **PHASE_HALFBEAT_UNSTABLE** cluster shrinks meaningfully (document n→n′)  
4. GT-AMBIGUITY remains **0** (no GT edits)  
5. Continuity does not collapse as a trade for Phase (watch song-020 / long tracks)

### Do **not** adopt / do not Fusion if:

- Only BPM/Period improves; Phase flat  
- Phase improves on a few songs but LIMIT cluster unchanged  
- Gains require per-song knobs or GT nudges  
- Downbeat improves only because of trivial every-4th from better beats without true bar model evidence — still report, but don’t overclaim

### Next step after B (choose one):

| Outcome | Next |
|---------|------|
| Clear Phase/Continuity win | Adoption candidate → **then** design Fusion experiment (separate spec) |
| Mixed / complementary errors | Fusion experiment becomes justified |
| No Phase win | madmom alone insufficient → next analyzer / approach; **still no MSAF-for-Beat** |

**MSAF** only when Section boundary/structure is a primary ANALYZER-LIMIT under a **real** structure hyp — not from energy stubs.

---

## 8. Deliverables (when implementation is approved)

```
~/ChoreoCoreDatasets/fly-real-song/hypotheses/song-XXX/madmom.json   ×20

docs/fly/reports/
  real-song-benchmark-madmom-result.json
  real-song-benchmark-madmom-report.md
  real-song-librosa-vs-madmom.md          # comparison
  real-song-librosa-vs-madmom.json
```

Optional: regenerate taxonomy for madmom as `real-song-weakness-taxonomy-madmom.*`  
**Do not** overwrite librosa baseline reports.

---

## 9. Implementation checklist (for Cursor — only after explicit implement GO)

1. Install/pin madmom in analyzer venv; record versions in hyp JSON  
2. Batch script `generate-fly-real-song-hypotheses-madmom.py` (or extend existing with `--analyzer madmom`)  
3. Ensure `write-fly-real-song-benchmark.ts` can select analyzer id (`librosa` | `madmom`) without changing scorer  
4. Run Experiment B → write madmom reports  
5. Write comparison report (A vs B)  
6. **Stop.** No Fusion. No MSAF. No production wiring. Await human decision.

---

## 10. Freeze interaction

Production `PHASE46_FREEZE` still lists `no_madmom` until Experiment B is reviewed and a **separate** “lift freeze for offline hyp only” note is accepted.

Interpretation for this experiment:

- `no_madmom` in **production / Fusion / Formation** remains  
- Offline **measurement** madmom hyps are allowed **only** after an explicit **Implement Experiment B GO** (this spec alone is not that GO)

---

## 11. One-sentence contract

> Add madmom Beat/Downbeat as a **parallel offline hypothesis**, score it with the **same Golden-20 Consensus GT and same Period/Phase/Continuity/Evidence contract** as librosa, and decide adoption only from that comparison — never by replacing librosa or inventing Fusion early.
