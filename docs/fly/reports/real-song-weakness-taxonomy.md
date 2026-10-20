# PHASE 4.6 Weakness Taxonomy Audit

**Status:** COMPLETE — measurement only  
**Dataset:** `4.6.1-double-consensus`  
**Analyzer under test:** librosa (`beat_track` batch hyp)  
**Essentia:** NOT_AVAILABLE  
**Source:** `real-song-benchmark-result.json`  
**Machine dump:** `real-song-weakness-taxonomy.json`

## Policy (binding until review)

- **Do not** add madmom / MSAF / Fusion from this audit alone
- Use the **current Golden 20** as the failure laboratory
- **Do not** expand the dataset before a minimal analyzer delta + re-benchmark
- Loop: Benchmark → **Failure taxonomy** → Analyzer selection → same GT re-benchmark

---

## Headline

| Beat class | n | Read |
|------------|---|------|
| PASS | 0 | — |
| WEAK | 9 | Phase pathology with recoverable continuity |
| ANALYZER-LIMIT | 11 | Phase + continuity jointly broken (or period break) |
| GT-AMBIGUITY | **0** | Consensus held; failures are Analyzer-side |

This is **not** a broken GT. It is librosa’s limit exposed with Evidence.

---

## Failure taxonomy (Beat primary)

| Failure type | Typical symptom | Suspect | n |
|--------------|-----------------|---------|---|
| **PHASE_HALFBEAT_STABLE** | Period OK; phase ~half-beat; continuity holds enough | beat tracking (phase) | 7 |
| **PHASE_HALFBEAT_UNSTABLE** | Period often OK; half-beat phase **and** continuity break | beat tracking (phase+drift) | 11 |
| **PERIOD_BREAK** | Interval vs GT fails (often syncopation) | beat/tempo under complex rhythm | 1 |
| **PHASE_DRIFT** | Period OK; moderate phase; continuity fails | grid drift / soft pulse | 1 |
| BPM_OCTAVE (secondary) | 0.5× / 2× BPM equivalence | tempo octave | see JSON |
| DOWNBEAT_UNSTABLE (secondary) | Bar starts unstable (every-4th proxy) | downbeat model | nearly all |
| SECTION_STUB (secondary) | Low labelF1 on **energy stub** hyp | **not** MSAF evidence yet | all |

---

## ① ANALYZER-LIMIT (11) — by cause

### A. Phase + continuity break — `PHASE_HALFBEAT_UNSTABLE` (10)

| songId | Title | Period | Phase ms | halfBeat | Cont lock | Notes |
|--------|-------|--------|----------|----------|-----------|-------|
| 002 | ダンスホール | WEAK | 116 | 0.43 | 0.51 | groove; Consensus GT |
| 003 | 唱 | PASS | 120 | 0.52 | 0.57 | complex-rhythm |
| 004 | ポリリズム | PASS | 116 | 0.50 | 0.58 | electronic pulse |
| 008 | God's Menu | PASS | 105 | 0.55 | 0.40 | + BPM ~0.5× octave |
| 010 | Still D.R.E. | PASS | 173 | 0.54 | 0.50 | Consensus; stable-groove ironically |
| 015 | Bangarang | PASS | 129 | 0.47 | 0.55 | EDM drop material |
| 016 | 24K Magic | PASS | 140 | 0.50 | 0.47 | funk groove |
| 017 | Billie Jean | PASS | 152 | 0.60 | 0.60 | classic pulse still phase-fails |
| 018 | Thinkin Bout You | PASS | 104 | 0.45 | 0.58 | R&B sparse |
| 019 | カタオモイ | PASS | 114 | 0.36 | 0.49 | ballad-lean |

**probableCause:** `beat_tracker_phase_plus_drift`  
**analyzerCapability:** librosa cannot hold a dance-facing phase lock; residual near half-beat and lock fraction collapses.  
**candidateFix:** madmom-class **beat** tracker (evaluate later). **Not MSAF. Not Fusion weights.**

### B. Period break — `PERIOD_BREAK` (1)

| songId | Title | Evidence |
|--------|-------|----------|
| **009** | Get Ur Freak On | Period FAIL + Phase FAIL; flags include **syncopation**; BPM rel≈30% |

**probableCause:** `tempo_period_confusion_under_syncopation`  
**candidateFix:** multi-hypothesis tempo/beat (ensemble / madmom). Still **not** MSAF-first.

---

## ② WEAK (9) — by cause

### A. Half-beat phase, continuity still usable — `PHASE_HALFBEAT_STABLE` (7)

| songId | Title | Period | Phase ms | halfBeat | Cont |
|--------|-------|--------|----------|----------|------|
| 001 | アイドル | WEAK | 81 | 0.45 | WEAK |
| 005 | Super Shy | PASS | 96 | 0.49 | WEAK |
| 006 | MIC Drop | PASS | 174 | 0.49 | WEAK |
| 011 | HUMBLE. | PASS | 108 | 0.53 | WEAK |
| 012 | SICKO MODE | WEAK | 106 | 0.50 | WEAK |
| **013** | **One More Time** | **PASS** | **166** | **0.68** | **WEAK** |
| 014 | Omen | PASS | 126 | 0.59 | WEAK |

**006 secondary:** BPM equivalence **2×** (octave) — tag `BPM_OCTAVE`.

### B. Borderline unstable (still WEAK class) — 1

| songId | Type | Note |
|--------|------|------|
| 007 | PHASE_HALFBEAT_UNSTABLE | Phase WEAK / Cont FAIL at lock≈0.65 — edge of LIMIT |

### C. Soft-pulse drift — `PHASE_DRIFT` (1)

| songId | Title | Note |
|--------|-------|------|
| 020 | Cornfield Chase | Period PASS; phase WEAK (~94ms); continuity FAIL — instrumental / ambient pulse |

---

## ③ Golden Case — song-013

```
Period PASS · Phase FAIL (~166ms, halfBeat≈0.68) · Continuity WEAK · Evidence PASS
findingClass = WEAK
GT-AMBIGUITY = no
```

Consensus policy held: half-beat is **Analyzer phase error**, not dual-phase GT.  
Any future Beat upgrade is judged on **Phase** (and Continuity), **never BPM-alone**.

---

## ④ What librosa alone cannot solve

| Problem | Songs (illustrative) | First candidate | Explicitly not first |
|---------|----------------------|-----------------|----------------------|
| Absolute phase / half-beat | 18/20 phase-halfbeat-* | madmom-class beat | MSAF, Fusion weights |
| Phase + continuity joint fail | 10 LIMIT + 007 | madmom-class beat | “just average more seeds” |
| Syncopation period break | 009 | multi-hypothesis beat/tempo | MSAF |
| Tempo octave | 006 (2×), 008 (0.5×) | octave-aware tempo / 2nd analyzer | Formation Engine |
| True section structure | all (stub hyp) | MSAF **later**, dedicated Section GO | using stub F1 as MSAF license |
| Downbeat | nearly all | dedicated downbeat (often with beat stack) | blaming Section tools |

---

## ⑤ Decision matrix (pre-implementation)

| Question | Verdict now |
|----------|-------------|
| madmom needed? | **CANDIDATE** — Spec locked in `PHASE46-MADMOM-EXPERIMENT.md`; **implementation not started** |
| MSAF needed? | **NOT justified from this Beat GO** (Section = energy stub, confidence LOW) |
| Both now? | **NO** — would confound attribution |
| Fusion needed? | **NOT YET** — only one real Beat hyp; Essentia missing |

---

## ⑥ Recommended scientific loop (next)

```
taxonomy review (this doc)
        ↓
minimal ONE analyzer add (likely Beat/madmom-class)  ← only after human GO
        ↓
same 20 · same Consensus GT · same Period/Phase/Continuity/Evidence
        ↓
failure resolved?  (especially 013 Phase, LIMIT half-beat set, 009 period)
        ↓
then Section/MSAF measurement (separate)
        ↓
only then Fusion — when ≥2 complementary Beat hyps exist
```

---

## Per-song schema

Each entry in `real-song-weakness-taxonomy.json` includes:

`songId` · `findingClass` · `axis` · `failureType` · `symptom` · `evidence` · `probableCause` · `analyzerCapability` · `confidence` · `candidateFix` (+ `secondary[]`)

---

## FREEZE (unchanged)

no_madmom · no_msaf · no_cyanite · no_demucs · no_fusion_weight_change · no_formation_engine_change · no_keep_current · no_ml_training · no_musical_change_to_formation_change

**This audit does not lift the freeze.**
