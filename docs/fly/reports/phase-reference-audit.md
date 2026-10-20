# PHASE 4.6-C — Common Phase Reference Audit

**Status:** COMPLETE
**Audit ID:** `4.6-c-phase-reference-v1`
**Dataset:** `4.6.1-double-consensus`
**Scope:** measurement only — no analyzer add · no Fusion · no MSAF · no GT edit

## Development log (locked finding)

> madmom improved Period substantially (16→19), but Phase remained 0/20. Therefore the dominant Phase weakness is not solved by replacing the beat/tempo analyzer. FLY must investigate the common Phase Reference / Dance Phase definition before adding further analyzers or Fusion.

## Why this audit

Experiment B showed Period can improve while Phase stays 0/20.
So before more analyzers or Fusion, ask whether the failure is:

| Hyp | Claim |
|-----|-------|
| A | Analyzer beat positions themselves are wrong |
| B | Analyzers can agree, but FLY Phase reference / Dance Phase definition is insufficient |
| C | Dance Phase needs multi-cue evidence beyond one beat sequence |

## ① Signed Phase error direction

| Analyzer | + (late vs GT) | − (early vs GT) | near 0 (|e|<40ms) |
| --- | --- | --- | --- |
| librosa | 3 | 3 | 14 |
| madmom | 2 | 2 | 16 |

Signed residual = hyp beat folded onto GT grid in (−½ IOI, +½ IOI].
+ = analyzer late vs GT seed phase0; − = early.

## ② Half-beat bins

| Bin | librosa n | madmom n |
| --- | --- | --- |
| NEAR_QUARTER | 18 | 18 |
| OTHER | 2 | 2 |

## ③ / ④ Analyzer relation vs GT

| Relation | n | Meaning |
| --- | --- | --- |
| BOTH_OFF_AGREE | 18 | librosa≈madmom, both off GT → **Reference/definition** more likely |
| BOTH_OFF_DISAGREE | 2 | analyzers disagree & both off → ensemble only after reference clarity |
| LIBROSA_CLOSER | 0 | librosa nearer GT |
| MADMOM_CLOSER | 0 | madmom nearer GT |
| BOTH_NEAR_GT | 0 | both within ~50ms of GT phase |

- Mean |librosa−madmom| phase distance: **25ms**
- BOTH_OFF_AGREE songs: 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 016, 017, 018, 019

### Interpretation

- Support for Hyp **B** (Phase Reference): **STRONG**
- Support for Hyp **A/C** via phase-wander (abs high, signed≈0): **STRONG** (18 songs)
- Fusion now: **NO**
- More analyzer-swap: **NO — Experiment B already showed Period≠Phase**
- Mean |phase| : librosa **124ms** · madmom **123ms**
- Next layer: Music Evidence → Beat Reference → Dance Phase → Count Grid (do not Fusion first)

## song-013 (Golden Case)

|  | abs ms | signed ms | beats | half-bin | spread | sign +/−/0 |
| --- | --- | --- | --- | --- | --- | --- |
| librosa | 166 | 44 | 0.09 | OTHER | 0.33 | 332/221/102 |
| madmom | 121 | -8 | -0.02 | NEAR_QUARTER | 0.28 | 257/282/118 |

- Analyzer agree |signed_L − signed_M|: **52ms**
- Relation: **BOTH_OFF_AGREE**
- Phase wander flags: librosa=false madmom=true
- CountGrid vs GT beat phase0: 0ms (NEAR_0)
- librosa≈madmom but both off GT → Phase Reference / Dance Phase definition more likely than analyzer-swap
- madmom: |phase| high but signed-median≈0 → phase wander / sign mix (not a stable offset)

## Per-song table

| ID | Title | L abs ms | L signed ms | L bin | M abs ms | M signed ms | M bin | |L−M| | Relation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | アイドル | 81 | -4 | NEAR_QUARTER | 88 | -9 | NEAR_QUARTER | 5 | BOTH_OFF_AGREE |
| 002 | ダンスホール | 116 | -18 | NEAR_QUARTER | 130 | 17 | NEAR_QUARTER | 35 | BOTH_OFF_AGREE |
| 003 | 唱 | 120 | -24 | NEAR_QUARTER | 114 | -13 | NEAR_QUARTER | 11 | BOTH_OFF_AGREE |
| 004 | ポリリズム | 116 | -58 | NEAR_QUARTER | 119 | -10 | NEAR_QUARTER | 48 | BOTH_OFF_AGREE |
| 005 | Super Shy | 96 | 12 | NEAR_QUARTER | 96 | 7 | NEAR_QUARTER | 5 | BOTH_OFF_AGREE |
| 006 | MIC Drop | 174 | 0 | NEAR_QUARTER | 160 | 38 | NEAR_QUARTER | 38 | BOTH_OFF_AGREE |
| 007 | How You Like That | 87 | 85 | NEAR_QUARTER | 57 | 57 | OTHER | 28 | BOTH_OFF_AGREE |
| 008 | God's Menu | 105 | 44 | NEAR_QUARTER | 81 | 30 | NEAR_QUARTER | 14 | BOTH_OFF_AGREE |
| 009 | Get Ur Freak On | 180 | 6 | NEAR_QUARTER | 167 | 3 | NEAR_QUARTER | 3 | BOTH_OFF_AGREE |
| 010 | Still D.R.E. | 173 | -57 | NEAR_QUARTER | 182 | -62 | NEAR_QUARTER | 5 | BOTH_OFF_AGREE |
| 011 | HUMBLE. | 108 | 1 | NEAR_QUARTER | 106 | 6 | NEAR_QUARTER | 5 | BOTH_OFF_AGREE |
| 012 | SICKO MODE | 106 | -1 | NEAR_QUARTER | 105 | 3 | NEAR_QUARTER | 3 | BOTH_OFF_AGREE |
| 013 | One More Time | 166 | 44 | OTHER | 121 | -8 | NEAR_QUARTER | 52 | BOTH_OFF_AGREE |
| 014 | Omen | 126 | 2 | NEAR_QUARTER | 128 | 42 | NEAR_QUARTER | 40 | BOTH_OFF_AGREE |
| 015 | Bangarang | 129 | -71 | NEAR_QUARTER | 137 | 1 | NEAR_QUARTER | 72 | BOTH_OFF_DISAGREE |
| 016 | 24K Magic | 140 | -39 | NEAR_QUARTER | 147 | -33 | NEAR_QUARTER | 6 | BOTH_OFF_AGREE |
| 017 | Billie Jean | 152 | 10 | NEAR_QUARTER | 147 | 35 | NEAR_QUARTER | 24 | BOTH_OFF_AGREE |
| 018 | Thinkin Bout You | 104 | -12 | NEAR_QUARTER | 105 | -22 | NEAR_QUARTER | 10 | BOTH_OFF_AGREE |
| 019 | カタオモイ | 114 | 0 | NEAR_QUARTER | 163 | 19 | NEAR_QUARTER | 19 | BOTH_OFF_AGREE |
| 020 | Cornfield Chase | 94 | -25 | OTHER | 105 | -90 | OTHER | 65 | BOTH_OFF_DISAGREE |

## CountGrid ↔ GT Beat Phase

| ID | CountGrid start | offset ms | bin |
| --- | --- | --- | --- |
| 001 | 0.544 | 0 | NEAR_0 |
| 002 | 2.528 | -26 | NEAR_0 |
| 003 | 0.868 | 0 | NEAR_0 |
| 004 | 2.088 | 0 | NEAR_0 |
| 005 | 0.506 | 0 | NEAR_0 |
| 006 | 5.842 | 0 | NEAR_0 |
| 007 | 2.670 | 0 | NEAR_0 |
| 008 | 0.457 | 0 | NEAR_0 |
| 009 | 13.218 | -3 | NEAR_0 |
| 010 | 0.905 | 0 | NEAR_0 |
| 011 | 1.419 | 0 | NEAR_0 |
| 012 | 0.765 | 0 | NEAR_0 |
| 013 | 0.287 | 0 | NEAR_0 |
| 014 | 4.128 | 0 | NEAR_0 |
| 015 | 0.541 | 0 | NEAR_0 |
| 016 | 23.618 | 0 | NEAR_0 |
| 017 | 0.977 | 0 | NEAR_0 |
| 018 | 7.529 | 0 | NEAR_0 |
| 019 | 4.281 | 0 | NEAR_0 |
| 020 | 5.499 | 0 | NEAR_0 |

## Layer sketch (future — not implemented)

```
Audio → Beat candidates (librosa / madmom / …)
     → Music Evidence
     → Beat Reference
     → Dance Phase
     → Count Grid
     → Choreographic Timing
```

## Decision

- ❌ Do not adopt madmom for Phase
- ❌ Do not Fusion yet
- ❌ Do not MSAF for this failure mode
- ✅ Continue Phase Reference / Dance Phase definition work before more analyzers
