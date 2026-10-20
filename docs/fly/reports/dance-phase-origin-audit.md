# PHASE 4.6-D — Dance Phase Origin Audit

**Audit ID:** `4.6-d-dance-phase-origin-v1`
**Status:** COMPLETE
**Dataset:** `4.6.1-double-consensus`
**Gate (definition progress):** **CONDITIONAL-GO**

## Purpose

Identify **Phase Origin** candidates between L2 Musical Beat Reference and L3 Dance Phase.
Existing data only. **Not** auto-adopting the lowest-error probe.

## Proxy (explicit)

Interim Dance Phase origin = **`countGrid.startSec`** (human).
Labeled provisional — not full L3 GT annotation.

## Probe summary

| Probe | Result |
| --- | --- |
| A Beat as 0 | 20/20 CountGrid within 0.12 beat of Beat phase0 |
| B Downbeat as 0 | 19/20 within 0.12 beat of Downbeat phase0 |
| C CountGrid as 0 | Inverse of A/B (same geometry; see per-song) |
| D ±1/4 beat | 0/20 fit quarter **only if** Beat not already near |
| E ±1/2 beat | 0/20 fit half **only if** Beat not already near |
| F Section/MC | 11/20 CountGrid within 150ms of form cue |
| G Per-song | dominant=COUNTGRID_BEAT_AND_DOWN_ALIGNED (85%); 3 labels |

## Hypothesis counts (review labels — not adoption)

| Hypothesis | n |
| --- | --- |
| COUNTGRID_BEAT_AND_DOWN_ALIGNED | 17 |
| COUNTGRID_EQUALS_BEAT | 2 |
| MIXED_OR_UNCLEAR | 1 |

## Gate evaluation

### Reasons toward GO

- 19/20 CountGrid ≈ Beat phase0 — common encoding: dance count-1 currently = Music Beat origin
- 17/20 CountGrid ≈ Beat ≈ Downbeat — bar/beat/count-1 collapsed into one time
- 20/20 CountGrid near Beat — Music Beat is the dominant *encoded* origin in current GT
- 19/20 also near Downbeat (often same point as Beat[0])
- ±1/4 and ±1/2 are NOT required for numeric fit — avoids post-hoc half/quarter gaming
- song-013: CountGrid=0.287 Beat0=0.287 → COUNTGRID_BEAT_AND_DOWN_ALIGNED
- 013 analyzer Phase FAIL is vs this shared Music Beat/CountGrid origin — not vs a separate Dance Phase Anchor
- Lowest-error probe was NOT auto-adopted
- GT was not retargeted to analyzers
- CONDITIONAL-GO: Origin structure is explainable (CountGrid≡Beat), but Dance Phase Model needs independent Anchor GT before claiming L3

### Risks / NO-GO pressures

- DATA LIMIT: CountGrid proxy cannot validate a Dance Phase Origin distinct from Music Beat — dedicated Phase Anchor annotation required

### Decision

**CONDITIONAL-GO** — definition may proceed to human review of Origin policy; **do not** ship Fusion or rewrite Beat GT.

## song-013

- Hypothesis: **COUNTGRID_BEAT_AND_DOWN_ALIGNED**
- CountGrid ≈ Beat phase0 ≈ Downbeat phase0 — dance count-1 is currently identical to musical bar/beat origin; L2/L3 not separable from this proxy alone
- A Beat: 0.000 beat (0ms signed 0ms)
- B Down: 0.000 beat
- D Quarter: Beat-0.25 absBeats=0.250
- E Half: Beat+0.5 absBeats=0.500
- F Form: MUSICAL_CHANGE@0.001 Δ=286ms
- proxy=CountGrid@0.287 (provisional Dance Phase origin — not proven L3 GT)

## Per-song

| ID | Title | Hyp | Beat beats | Down beats | ¼ | ½ | Form ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | アイドル | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.01 | 0.25 | 0.50 | 35 |
| 002 | ダンスホール | MIXED_OR_UNCLEAR | 0.05 | 0.01 | 0.20 | 0.45 | 41 |
| 003 | 唱 | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 192 |
| 004 | ポリリズム | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 580 |
| 005 | Super Shy | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 0 |
| 006 | MIC Drop | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 5842 |
| 007 | How You Like That | EQUALS_BEAT | 0.00 | 0.13 | 0.25 | 0.50 | 520 |
| 008 | God's Menu | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 93 |
| 009 | Get Ur Freak On | EQUALS_BEAT | 0.00 | 0.03 | 0.25 | 0.50 | 118 |
| 010 | Still D.R.E. | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.01 | 0.25 | 0.50 | 0 |
| 011 | HUMBLE. | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 1419 |
| 012 | SICKO MODE | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 0 |
| 013 | One More Time | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 286 |
| 014 | Omen | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 9 |
| 015 | Bangarang | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 541 |
| 016 | 24K Magic | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 2338 |
| 017 | Billie Jean | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 7 |
| 018 | Thinkin Bout You | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 0 |
| 019 | カタオモイ | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 881 |
| 020 | Cornfield Chase | BEAT_AND_DOWN_ALIGNED | 0.00 | 0.00 | 0.25 | 0.50 | 0 |

## What this does **not** mean

- ✗ Pick ±1/4 or ±1/2 because it shrinks milliseconds
- ✗ Analyzer agreement defines Dance Phase Origin
- ✗ Rewrite Consensus Beat to match CountGrid
- ✓ Human can now argue Origin policy with Evidence
