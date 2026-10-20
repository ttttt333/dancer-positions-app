# FLY Phase 4.6 — Beat / Downbeat as Representative Patterns

**Status:** LOCKED (annotation semantics)  
**annotation_contract_version:** `1.1.0` (additive; existing `beats[]` / `downbeats[]` files remain valid)  
**Last Updated:** 2026-09-12  

---

## 1. Correction to prior audit framing

Earlier Data Quality Audit treated “~20 beats on a 3-minute song” as **coverage failure**.

That framing is **wrong** for Phase 4.6 Golden 20 as annotated:

> Humans intentionally mark a **representative pulse train**, not every beat in the file,  
> because the same period/phase is assumed to **continue**.

Sparse beat lists are therefore **not INVALID by count alone**.

---

## 2. Role split (binding)

| Field | Role | Scope |
|-------|------|--------|
| **Beat Pattern** (`beats[]`) | Period + phase of the main pulse | Representative window; may continue |
| **Downbeat Pattern** (`downbeats[]`) | Period + phase of bar starts | Representative window; **independent** of beat window |
| **BPM** | Global tempo hypothesis for the pattern | Song-level |
| **8-count** (`countGrid`) | Dance phrase “count 1” | Point + expand rule |
| **Section** | Formal structure | **Full song** |
| **musical_change** | Musical event points | **Full song** |

Beat window ≠ Downbeat window is **allowed** (e.g. song-009).

---

## 3. Semantics of `beats[]` / `downbeats[]`

### Storage (unchanged on disk)

```text
beats: number[]      // observed onsets in the representative window (seconds)
downbeats: number[]  // observed bar-starts in their representative window
```

### Derived Beat Pattern (evaluation view)

From sorted unique `beats` and song `bpm`:

| Field | Definition |
|-------|------------|
| `patternStartSec` | `min(beats)` |
| `patternEndSec` | `max(beats)` |
| `bpm` | Annotation `bpm` (primary) |
| `intervalSec` | Median Δt of consecutive beats (fallback `60/bpm`) |
| `phaseSec` | `patternStartSec % intervalSec` (or equiv. locked to first beat) |
| `continuation` | Default **`true`** in Phase 4.6 unless notes / override say otherwise |
| `continuationUntilSec` | Default **`durationSec`** when `continuation=true` |
| `patternConfidence` | Default from interval CV vs BPM (or `bpmConfidence`) |

Same derivation for **Downbeat Pattern**, with `barIntervalSec` ≈ median Δt of downbeats (expect ~`4 * beatInterval` in 4/4).

---

## 4. Continuation policy (must be explicit)

When the annotator’s intent is “ほぼこの流れでずっと続く”:

```text
patternStartSec = first marked beat
patternEndSec   = last marked beat   // observed evidence window
continuation    = true
continuationUntilSec = song duration // unless broken earlier
```

### Same pattern means

Within `[patternStartSec, continuationUntilSec]`, an analyzer beat grid is judged by:

1. **Period** — interval within tolerance of GT `intervalSec` / BPM  
2. **Phase** — extrapolated from GT seed (first beat / downbeat) within tolerance  
3. **Continuity** — no sustained break of the lock (see scoring docs / Benchmark)

### When continuation stops early

Document in `notes` and/or set future optional fields:

- `beatPattern.continuation = false`
- `beatPattern.continuationUntilSec = <break time>`

Typical break cues: half/double-time feel change, clear `musical_change` with `BEAT_CHANGE` / `RHYTHM_CHANGE`, section that abandons the pulse.

**Default for current Golden 20 files:** `continuation=true` → end of song, unless notes contradict.

---

## 5. Annotation guidance (replaces “mark the whole song”)

### Beat Pattern

1. Find a clear groove stretch (often after intro silence).  
2. Mark **≥ 8** consecutive main-pulse onsets (prefer ≥ 2 bars; ~16–32 is plenty).  
3. Do **not** paste analyzer arrays.  
4. Do **not** require marking through outro if the pattern is stable.  
5. If the pulse **changes**, either mark a second window later (future multi-pattern) or end continuation in notes.

### Downbeat Pattern

1. Mark clear bar-1 hits in a representative stretch.  
2. Window may differ from Beat Pattern.  
3. Sparse is OK when bar start is ambiguous — prefer honesty over dense wrong downs.

### Still required full-song

- Sections (no overlaps; cover form)  
- musical_change (events that matter; may align with section bounds)

---

## 6. Benchmark implication

```text
❌ Old: GT beats = every beat in [0, T]; F1 vs analyzer full list
✅ New: GT = seed pattern + continuation; score period / phase / lock
        on [patternStart, continuationUntil]
```

`annotationToFlyGroundTruth` / beat scorers **must** adopt pattern semantics before Beat F1 is trusted.  
Until scorers are updated, Benchmark reports must label Beat dimension as **pattern-eval pending** or use the new scorer only.

Section / musical_change / 8-count scoring unchanged in intent.

### Beat Pattern Score (evaluation contract — implement at Benchmark step)

Do **not** score “N seed hits matched out of N”.

```text
Beat Pattern Score
├─ Period Accuracy      — |GT median interval − analyzer median interval| (rel or ms)
├─ Phase Accuracy       — phase offset of analyzer grid vs GT seed lock
├─ Continuity Accuracy  — how far analyzer keeps period+phase on
│                         [patternStart, continuationUntil]
└─ Confidence / Evidence — sample support / stability flags
```

Downbeat Pattern Score uses the same four axes with bar interval / bar phase.

**Analyzer code stays frozen** until Section snap + annotator-b + Agreement/Consensus + this Benchmark run produce Weakness evidence.

---

## 7. Audit criteria (revised)

| Dimension | PASS | REVIEW | FAIL |
|-----------|------|--------|------|
| Beat Pattern | ≥8 beats; median IOI ≈ 60/BPM (±~3%); span ≥ ~4 beats | Weak IOI/BPM match; very short span; notes of feel change | &lt;8 beats; chaotic IOI; no bpm |
| Downbeat Pattern | ≥1 downs; bar IOI sane vs beat×4 when 4/4 | Window ≫ or ≪ beat window (OK but check); feel ambiguity | Downs contradict BPM badly with high confidence claim |
| Section | Full-song labels; **no overlaps** | Large head/trail gaps | Overlaps; empty |
| musical_change | Present as needed; times in range | Mostly section-linked only | Out-of-range / schema break |
| Double (002/005/010/013) | A+B present | A only | — |

**Beat count ≪ expected full-song count is not FAIL.**

---

## 8. Code pointers

- Types / derive: `src/lib/fly/realSong/beatPattern.ts`  
- Contract: this doc + `PHASE46-ANNOTATION-CONTRACT.md`  
- SOP: `PHASE46-ANNOTATION-SOP.md` § Beat / Downbeat  

---

## Constitution reminder

> Measure first. Improve later.  
> Human first. Analyzer second.  
> Evidence before architecture.

Pattern GT reduces human load **without** weakening measurement — it changes **what** is measured (period/phase/continuity), not whether we measure.
