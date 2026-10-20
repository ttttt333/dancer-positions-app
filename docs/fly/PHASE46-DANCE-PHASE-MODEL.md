# PHASE 4.6-D — Music Beat → Dance Phase Model

**Status:** DEFINITION LOCKED — implementation **not** started  
**Spec ID:** `4.6-d-dance-phase-model-v1`  
**Date locked:** 2026-09-13  
**Prerequisite:** 4.6-C Phase Reference Audit (`phase-reference-audit.*`) — Hyp B STRONG

---

## 0. Why this phase exists

Experiment B + 4.6-C showed:

| Evidence | Value |
|----------|-------|
| BOTH_OFF_AGREE | 18/20 |
| mean \|librosa − madmom\| | ≈25ms |
| mean \|phase\| vs GT | ≈123–124ms |
| Phase PASS | 0/20 |
| Hyp B (Phase Reference) | **STRONG** |

**Locked conclusion:**

> FLY’s dominant failure is not “which Beat Analyzer to use.”  
> It is **how Music Beat is interpreted as a dance timing axis.**

```
Music Beat  ≠  Dance Phase
```

Therefore: **do not add analyzers / Fusion / MSAF now.**  
First lock the **Dance Phase model** (definition, data shapes, GT eval method).

---

## 1. Three layers (binding)

### Layer 1 — Music Time

What is happening in the *music*.

```
Audio
  → Beat / Downbeat / Tempo
  → Section
  → Musical Change
  → (later) Energy / onset families
```

Role: **musical evidence**, not choreography timing.

### Layer 2 — Musical Beat Reference

Time axis *candidates* estimated by analyzers / humans.

```
librosa Beat / Downbeat
madmom Beat / Downbeat
Human Beat Pattern (GT seeds + continuation)
CountGrid (phrase “count 1” checkpoints)
```

Role: **reference candidates**.  
Still **does not** decide where the dancer should move.

### Layer 3 — Dance Phase (FLY-native)

```
Musical Beat Reference (+ other Music Time cues)
        ↓
   Dance Phase Model
        ↓
     Dance Phase
```

Role: **the timing axis ChoreoCore actually uses** for counts, hits, transitions, formations.

**Rule:** Never equate Layer 2 Beat arrays with Layer 3 Dance Phase by identity.

---

## 2. Core concept — Phase Anchor

### Definition

**Phase Anchor** = a time point chosen as the **dance-facing origin** (or strong cue) for local timing.

Not automatically “nearest Music Beat.”

### Anchor candidate families (v1 catalog — measurement only)

| Family | Examples | Layer |
|--------|----------|-------|
| Pulse | Music Beat, Downbeat | L2 |
| Percussive | Kick / Snare / Hi-hat onset (future) | L1→L2 |
| Vocal | Vocal onset / lyric stress (future) | L1 |
| Energy | Local energy peak | L1 |
| Form | Section boundary | L1 |
| Change | Musical Change time | L1 |
| Human | Annotator CountGrid start / marked hit | L2/L3 GT |

### Dance Phase Anchor (chosen)

From candidates, the model (later) or human GT (now) selects:

```
DancePhaseAnchor {
  timeSec
  sourceFamily
  confidence
  role: "ORIGIN" | "HIT" | "RELEASE" | "TRANSITION" | "OTHER"
}
```

**v1 rule:** Beat is a *candidate*, not the default identity of Dance Phase.

---

## 3. Three Dance Phase kinds (binding vocabulary)

### A. `MUSIC_BEAT_PHASE`

Phase expressed on the musical pulse grid.

```
0.00, 0.25, 0.50, 0.75   // within a bar (4/4 default)
```

Derived from Musical Beat Reference + chosen bar phase.  
Useful for counting, but **not sufficient** for choreography alone.

### B. `DANCE_PHASE`

Phase of **choreographic placement** relative to music — may include:

- anticipation (move starts before musical hit)
- hit (align with anchor)
- release (resolve after hit)

This is the primary FLY Layer 3 object for Stage D definition.

### C. `DANCE_ACTION_PHASE` (later / Stage E+)

Phase of **body mechanics** relative to Dance Phase / music:

```
music hit
   → (+δ) body peak velocity / shape peak
   → movement settle
```

Out of scope for first GT pass; vocabulary reserved so Formation Intelligence does not overload `DANCE_PHASE`.

---

## 4. Data model (contract draft — not wired to production)

```ts
// Spec types — implement only after Implement GO

type MusicTimeEvidence = {
  songId: string;
  bpm: number | null;
  beats?: number[] | null;       // analyzer or human seeds
  downbeats?: number[] | null;
  sections?: Array<{ startSec: number; endSec: number; label: string }>;
  musicalChanges?: Array<{ timeSec: number; reasons: string[] }>;
};

type MusicalBeatReference = {
  songId: string;
  source: "human-gt" | "librosa" | "madmom" | string;
  intervalSec: number;
  phase0Sec: number;             // Layer 2 phase lock
  continuationUntilSec: number;
  countGridStartSec?: number | null;
};

type PhaseAnchor = {
  timeSec: number;
  sourceFamily:
    | "MUSIC_BEAT"
    | "DOWNBEAT"
    | "COUNT_GRID"
    | "SECTION_BOUNDARY"
    | "MUSICAL_CHANGE"
    | "ENERGY_PEAK"
    | "KICK"
    | "SNARE"
    | "VOCAL_ONSET"
    | "HUMAN_MARK"
    | "OTHER";
  role: "ORIGIN" | "HIT" | "RELEASE" | "TRANSITION" | "OTHER";
  confidence: number;
};

type DancePhaseModel = {
  songId: string;
  version: "4.6-d-v1";
  /** Chosen origin for dance timing (not necessarily Music Beat[0]) */
  originAnchor: PhaseAnchor;
  /** Optional supporting anchors */
  anchors: PhaseAnchor[];
  /** How MUSIC_BEAT_PHASE maps into DANCE_PHASE locally */
  mapping: {
    kind: "IDENTITY" | "OFFSET" | "ANTICIPATION" | "CUSTOM";
    /** DancePhase time ≈ MusicBeatReference time + offsetSec (v1) */
    offsetSec?: number;
    notes?: string;
  };
  dancePhaseKind: "DANCE_PHASE";
};
```

### Relationship to existing GT (no silent rewrite)

| Existing field | Layer | Role in 4.6-D |
|----------------|-------|----------------|
| `beats[]` / pattern | L2 (+ human Music Beat) | Candidate / Music Beat Reference |
| `downbeats[]` | L2 | Candidate |
| `countGrid` | L2→L3 bridge | Strong human Phase Anchor candidate |
| `sections` / `musicalChanges` | L1 | Anchor families |
| Consensus Beat | L2 human | **Not** automatically Dance Phase Origin |

**song-013 policy remains:** half-beat dual Music Beat GT is rejected; Dance Phase may still *intentionally* anticipate Music Beat — that must be annotated as `mapping.kind = ANTICIPATION|OFFSET`, not as dual Beat GT.

---

## 5. GT evaluation method for 4.6-D (measurement plan)

**No new analyzers.** Use existing Golden-20 annotations + librosa/madmom hyps as L1/L2 only.

For each song, compare **human Dance Phase origin candidates** (when present) against:

| Probe | Question |
|-------|----------|
| **A. Beat** | GT origin − Music Beat phase0 |
| **B. Half Beat** | GT origin − Beat ± ½ IOI |
| **C. Quarter Beat** | GT origin − Beat ± ¼ IOI |
| **D. Downbeat** | GT origin − Downbeat phase0 |
| **E. Musical Change** | GT origin − nearest MC |
| **F. Section boundary** | GT origin − nearest section edge |
| **G. CountGrid** | GT CountGrid start vs Beat / Downbeat / MC |

### Interim human Dance Phase proxy (until dedicated annotation)

v1 audit may use, in order of preference:

1. Explicit future `dancePhase.originAnchor` (when annotated)
2. Else `countGrid.startSec` as provisional Dance Phase origin
3. Else Consensus/human Beat phase0 — labeled **`PROXY_MUSIC_BEAT_ONLY`** (must not be treated as proven Dance Phase)

### Success criteria for the *definition* (not product accuracy)

- Vocabulary L1/L2/L3 used consistently in docs + types
- Audit can say for each song: “Dance Phase origin closest to {Beat|½|¼|Down|MC|Section|CountGrid}”
- song-013 explained without “just average analyzers”
- Fusion still unjustified unless L3 needs multi-L2 evidence *after* definition lock

---

## 6. Absolute non-goals (this stage)

| Action | Status |
|--------|--------|
| librosa+madmom Fusion / average Phase | **FORBIDDEN** |
| Treat analyzer agreement as correctness | **FORBIDDEN** |
| Replace librosa with madmom in production | **FORBIDDEN** |
| MSAF add for Phase | **FORBIDDEN** |
| Formation Engine / KEEP_CURRENT changes | **FORBIDDEN** |
| Retarget Consensus Beat GT to analyzer | **FORBIDDEN** |
| Implement Dance Phase runtime in ChoreoCore | **WAIT** for Implement GO after definition review |

---

## 7. Target stack (directional — not build order)

```
Music
  → FLY
      Music Structure (L1)
      Music Beat / Reference (L2)
      Musical Change / Energy (L1)
      Dance Phase (L3)          ← 4.6-D center
      Choreographic Intent      ← later
  → ChoreoCore
      Formation / Transition timed by Dance Phase Anchors
```

ChoreoCore should move from:

> “bar 4 → move”

toward:

> “strong Dance Phase Anchor + post–Section Change → high value Formation Transition”

---

## 8. Evaluation scorecard (current)

| Item | State |
|------|--------|
| Beat detection | 🟢 strong enough for L2 |
| Period | 🟢 improved with madmom (still offline) |
| Analyzer compare | 🟢 enough evidence |
| Fusion | 🔴 too early |
| MSAF | 🔴 not needed for this failure |
| Music Structure | 🟡 later |
| **Dance Phase definition** | 🔴 **most important now** |
| Choreographic Intent | 🟡 next after L3 |
| Formation Intelligence | 🟡 after Intent |

---

## 9. Deliverables when Implement GO is given (later)

1. Types under `src/lib/fly/realSong/dancePhase.ts` (isolated; not production export)
2. ~~Audit script `fly:dance-phase-origin-audit` (probes A–G on Golden 20)~~ **DONE** → `CONDITIONAL-GO`
3. Reports `dance-phase-origin-audit.{md,json}` **DONE**
4. **Next:** Optional annotation fields / workbench marks for Phase Anchor — **human-first**, independent of Beat/CountGrid identity
5. **Still no** Fusion / MSAF / Formation wiring

### Origin Audit headline (locked)

> CountGrid is largely identical to Beat phase0 (and often Downbeat) in current Golden-20 GT.  
> Therefore the Dance Phase Origin cannot be validated as distinct from Music Beat using CountGrid alone.  
> ±1/4 and ±1/2 fits were **not** required — good (no post-hoc gaming).  
> **CONDITIONAL-GO:** proceed to dedicated Phase Anchor annotation, not Fusion.

---

## 10. One-sentence contract

> FLY will treat **Music Beat** as evidence and **Dance Phase** as the choreographic timing axis; Phase Anchor selection is a first-class model, and analyzer agreement must never be mistaken for Dance Phase truth.
