# FLY Phase 4.6 — Annotation SOP (Human-first)

**sop_version:** `1.0.0`  
**annotation_contract_version:** `1.0.0`  
**status:** Binding for Stage A GT quality

## 0. Critical finding (UI)

There is **no FLY Real-Song music GT Annotation UI** in the app today.

| Surface | Purpose | Use for Phase 4.6 music GT? |
|---------|---------|------------------------------|
| `AnnotationWorkbenchPage` + choreocore annotation | Formation / cue / Top-3 ratings | **No** — different domain |
| `src/lib/fly/realSong/` + JSON files | Music GT schema + validators | **Yes** — current path |

Until a dedicated Human-first music UI exists in the main app, Stage A uses the **local Golden 20 workbench**:

```bash
npm run fly:annotate          # song 001
npm run fly:annotate -- 003   # jump to 003
```

Opens `~/ChoreoCoreDatasets/fly-real-song/workbench/` (no analyzer overlays).  
Save downloaded JSON to `annotations/song-XXX/annotator-a.json`.

Do **not** repurpose Formation Annotation Workbench for BPM/Beat/Section music GT.

---

## 1. Locked human workflow (STEP 3)

```
Waveform only (no analyzer overlay)
        ↓
Listen full song ≥ 1×
        ↓
BPM → Beats → Downbeats → 8-count start → Sections → musical_change
        ↓
Save annotator-*.json
        ↓
(Later) run analyzers as hypotheses — never paste into GT
```

### Human-first guarantees (checklist)

- [ ] Analyzer beat grid / section labels are **hidden** during first pass
- [ ] No “snap to AI” button for GT
- [ ] Hypothesis files live under `hypotheses/`, never under `annotations/`
- [ ] If annotator peeked at AI, mark `notes: "CONTAMINATED_AI_PEEK"` and re-do or lower confidence

---

## 2. BPM

**Goal:** Steady tempo the dancer would count.

| Rule | Detail |
|------|--------|
| Prefer felt dance tempo | Not always the densest click |
| Half / double | If unsure between 70 vs 140, pick the one that makes 8-counts natural; set `bpmConfidence` ≤ 0.75 and note ambiguity |
| Tempo change songs | Primary BPM = dominant section; note mid-song change in `notes` (full multi-tempo GT is later) |
| Live drift | Approximate mean; confidence ≤ 0.7 |

---

## 3. Beat

**How to place**

1. Pick a clear bar in the groove (not only the first ms of the file).
2. Mark consecutive **quarter-note** (or song’s main pulse) onsets you would clap.
3. Times in **seconds**, monotonic, no duplicates.
4. Skip ornamental hits that are not the main pulse (unless trap/funk pulse *is* that hit — then document in notes).

**Tolerance mindset for later Benchmark:** humans ±20–40ms is normal; disagreement ≠ AI failure.

**Do not:** paste Essentia/librosa beat arrays into GT.

---

## 4. Downbeat

**Definition:** Bar 1 / “count 1” of the felt bar (usually every 4 main beats in 4/4).

| Case | Action |
|------|--------|
| Clear 4/4 | Mark downbeats on bar starts |
| Ambiguous bar start | Mark best guess; confidence via fewer downbeats or notes |
| Half-time feel | Downbeat follows **felt bar**, not necessarily every 2 clicks of a double-time grid |

If you cannot decide, leave sparse downbeats rather than inventing a dense wrong grid.

---

## 5. 8-count (`countGrid`)

**Definition:** Phrase start a dancer would call “5-6-7-8 → 1”.

| Field | Meaning |
|-------|---------|
| `startSec` | Time of count **1** of the first usable 8 |
| `bpm` | Same as annotation BPM unless noted |
| `beatOffsetSec` | Offset of pulse vs `startSec` if needed (usually 0) |
| `barsPerPhrase` | Fixed `2` in v1 (8 counts = 2 bars of 4) |

**Ambiguity:** Music-correct beat ≠ dance 8 start. Prefer **dance phrase** start. If music bar and dance 8 disagree, dance 8 wins for this field; note it.

Optional `countMarkersSec`: times for counts 1…8 of the first phrase when teaching/reviewing.

---

## 6. Section boundaries

**How to place**

1. Boundary = moment the **section identity** changes for a listener/dancer (not every fill).
2. Labels: INTRO / VERSE / PRE_CHORUS / CHORUS / BRIDGE / BREAK / DROP / OUTRO / OTHER
3. `endSec` of section N = `startSec` of N+1 (no gaps preferred; tiny gaps OK; **no overlaps**)
4. Confidence: clear chorus 0.9+; fuzzy pre-chorus 0.6–0.8; guess &lt; 0.6 + OTHER if needed

**Do not** force analyzer-like equal-length blocks.

---

## 7. `musical_change` (≠ formation)

**Meaning only:** “Something musically important changed here.”

### Strength guide

| Strength | Use when |
|----------|----------|
| **HIGH** | Clear section boundary, drop, break, major energy cliff/rise, unmistakable impact |
| **MEDIUM** | Noticeable but not defining (pre-chorus lift, instrument entry without full section flip) |
| **LOW** | Subtle; optional; skip if unsure |

### Reasons

SECTION_CHANGE, ENERGY_RISE/DROP, BEAT/RHYTHM_CHANGE, INSTRUMENT/VOCAL_CHANGE, DROP, BREAK, IMPACT, OTHER

### Forbidden

- `formation_change`
- “change formation here”
- KEEP_CURRENT / transition labels

Multiple reasons allowed. Prefer fewer HIGH marks over spam.

---

## 8. Double annotation (002 / 005 / 010 / 013)

1. Annotator A and B work **independently** (no shared draft).
2. Run agreement → adjudicate → `consensus.json`.
3. Keep raw A/B forever.
4. Large boundary disagreement (e.g. median &gt; 300ms) → adjudication note, not silent average.

---

## 9. File layout reminder

```
fixtures/fly/real-song/annotations/<songId>/
  annotator-a.json
  annotator-b.json      # if double
  agreement.json
  consensus.json
fixtures/fly/real-song/hypotheses/<songId>/
  librosa.json
  essentia.json
```

Audio: local only; `audioSha256` in manifest.

---

## 10. Gate before claiming Stage A complete

- [ ] 20 songs chosen to fill matrix (not “favorites”)
- [ ] Hashes set (no PENDING_*)
- [ ] 20× primary human GT
- [ ] 4× double + consensus
- [ ] Zero AI paste into annotations
- [ ] Then Benchmark → Weakness → **Review** (still no madmom)
