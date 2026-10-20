# PHASE 4.6-E — Independent Phase Anchor Annotation

**Status:** GATE OPEN for **pilot annotation** (5 songs) — not full Golden-20 yet  
**Spec ID:** `4.6-e-phase-anchor-annotation-v1`  
**Date locked:** 2026-09-13  
**Prerequisite:** Origin Audit `CONDITIONAL-GO` (`dance-phase-origin-audit.*`)

---

## 0. Why this gate exists

Origin Audit showed current GT collapses:

```
CountGrid  ≈  Beat phase0  ≈  Downbeat
```

So L2 Musical Beat Reference was being reused as if it were L3 Dance Phase.

**Improving analyzers toward that GT only proves:**

> Analyzer ≈ current (collapsed) GT

**It does not prove:**

> FLY understands a dance timing axis

Therefore the next step is **human Independent Phase Anchor GT** — not Fusion, not MSAF, not madmom adoption.

---

## 1. Layer diagram (binding)

```
L1 Music Time
    ↓
L2 Musical Beat Reference
    ↓
★ Phase Anchor   ← independent human observation (this gate)
    ↓
L3 Dance Phase
    ↓
DANCE_ACTION_PHASE (future)
```

**Phase Anchor** = dance-facing timing reference point(s) a choreographer would use —  
**not** automatically Beat[0] / CountGrid / Downbeat.

---

## 2. Absolute freeze (do not touch)

| Frozen | Note |
|--------|------|
| Golden 20 set | no expansion this gate |
| Existing Beat / Downbeat / CountGrid / Section / MC GT | **read-only** |
| Consensus GT | **read-only** |
| librosa / madmom hyps | **read-only** |
| Benchmark thresholds / 4-axis scorer | **unchanged** |
| Fusion | **forbidden** |
| MSAF | **forbidden** |
| Formation / KEEP_CURRENT | **forbidden** |
| Retargeting Beat GT to analyzers | **forbidden** |
| Copying Beat/CountGrid into Phase Anchor “to match” | **forbidden** |

---

## 3. What we create

```
~/ChoreoCoreDatasets/fly-real-song/phase-anchors/
  README.md
  PILOT.md
  song-XXX/
    phase-anchor.json          # human annotation (this gate)
    phase-anchor.meta.json     # optional session notes
```

Repo (git):

- Spec: `docs/fly/PHASE46-PHASE-ANCHOR-ANNOTATION.md`
- Types: `src/lib/fly/realSong/phaseAnchor.ts` (isolated)
- Lock: `docs/fly/reports/phase-anchor-annotation-lock.json`

Audio stays outside git (same as Stage A).

---

## 4. Annotation object (v1)

Discoverability first — types are **candidates**, not a closed ontology.

```ts
type PhaseAnchorTypeCandidate =
  | "DOWNBEAT"
  | "BEAT"
  | "KICK"
  | "SNARE"
  | "VOCAL"
  | "HIT"
  | "GROOVE"
  | "ANTICIPATION"
  | "SECTION"
  | "OTHER";

type PhaseAnchorMark = {
  /** seconds */
  anchorTimeSec: number;
  /** soft vocabulary; OTHER + free text encouraged when unsure */
  anchorType: PhaseAnchorTypeCandidate | string;
  confidence: number; // 0..1
  /** why this is a dance timing origin/cue — required */
  rationale: string;
  /**
   * Optional: how it feels vs music pulse AFTER deciding the anchor
   * (fill last — do not reverse-engineer from Beat list)
   */
  relationToMusic?: {
    vsBeat?: "ON" | "EARLY" | "LATE" | "UNCLEAR" | "N/A";
    approxOffsetSec?: number | null;
    note?: string;
  };
  role?: "ORIGIN" | "HIT" | "RELEASE" | "TRANSITION" | "OTHER";
};

type PhaseAnchorAnnotation = {
  songId: string;
  annotatorId: string;
  annotationVersion: "4.6-e-phase-anchor-v1";
  audioSha256: string;
  /** primary dance timing origin for the song (or first clear groove) */
  primaryOrigin: PhaseAnchorMark;
  /** optional additional anchors */
  anchors: PhaseAnchorMark[];
  annotatedAt: string;
  notes?: string;
  /**
   * Honesty flag: did you look at Beat/CountGrid overlays while marking?
   * Prefer false for pilot independence.
   */
  consultedMusicBeatUi: boolean;
};
```

### Annotation SOP (pilot) — order is binding

**Do not implement L3 / Analyzer / Formation while this SOP is open.**

1. **Do not open** Beat GT, Consensus, CountGrid, Downbeat lists, or analyzer hyps.  
2. **Listen to the track only.**  
3. Mark the time where a dancer would **start / orient body motion** as the timing origin.  
4. Record: `anchorTimeSec`, `anchorType`, `confidence`, `rationale`.  
5. Save as `phase-anchor.json` (from `phase-anchor.PENDING.json`).  
6. Prefer `consultedMusicBeatUi: false`.  
7. Optional `relationToMusic` **after** the mark only — never reverse-engineer time from Beat arrays.  
8. If the origin *happens* to land on a beat, that is allowed — but `rationale` must say why as dance timing, not “because beat 1.”  
9. Use `OTHER` + free rationale freely — **discover** what anchors are; do **not** invent a “correct” Phase Anchor ontology.

**song-013 special rule:** explain *why* that moment is the Phase Anchor **without** Beat numbers, CountGrid, or analyzer results.

---

## 5. Pilot set (5 songs — not full 20)

| songId | What we are testing |
|--------|---------------------|
| **song-013** | Does a bodily / musical criterion exist that explains Beat↔Phase offset? |
| **song-020** | How does Phase Anchor form under soft-pulse / continuity? |
| **song-009** | Under syncopation, does an Anchor ≠ Beat appear? |
| **song-005** | Under denser / complex structure, is Anchor stable? |
| **song-002** | On a relatively plain track, do Beat and Anchor still coincide? |

Double-annotate / expand only after pilot independence is evidenced.

---

## 6. What this experiment is (and is not)

| Is | Is not |
|----|--------|
| Existence proof: does choreographic timing escape Beat/CountGrid? | Accuracy tuning toward Analyzer |
| Soft candidate types for discovery | Closed “correct” Phase Anchor taxonomy |
| Evidence gate before L3 data model / Formation wiring | Renaming Beat 0 as “Phase” |

---

## 7. Pilot decision (A / B)

After all 5 `phase-anchor.json` exist → **next gate: Independence Audit** (batch of 5; no mid-pilot Analyzer work).

### A. Independent information → CONDITIONAL-GO → extra Pilot → GO

Phase Anchor shows different **time and/or type/rationale** than Beat/CountGrid  
(especially 013 explainable without Beat vocabulary).

### B. Near-copy → do **not** force L3

Rationales collapse to “1拍目 / beat 1 is the Phase Anchor” and times ≈ Beat/CountGrid  
→ L3-as-separate-layer is **not yet evidenced**; redesign necessity rather than invent empty Phase vocabulary.

**Not** success criteria: smaller Analyzer Phase error · Fusion score · forcing Anchors onto Beat grid.

---

## 8. Next gate (after Pilot files)

```
PHASE 4.6-F — Phase Anchor Independence Audit
  inputs: 5× phase-anchor.json + frozen Beat/CountGrid (read-only compare)
  axes: Independence · Reproducibility · Anchor kinds · Rationale consistency
  center: song-013
  output: A CONDITIONAL-GO | B L3 re-evaluate
  not: Analyzer accuracy / Fusion / MSAF
```

Full stub: `docs/fly/PHASE46-PHASE-ANCHOR-INDEPENDENCE-AUDIT.md`

Compare (measurement only): Anchor vs Beat phase0 / CountGrid / Downbeat; analyzers informational only.  
**Do not** retarget Consensus Beat. song-013 remains the Anchor validation song.

---

## 9. One-sentence contract

> Phase Anchor GT is an independence experiment for L3 — collect human dance-timing observation first; if it collapses to Beat/CountGrid, admit that; never fake Layer 3 by renaming Beat 0.
