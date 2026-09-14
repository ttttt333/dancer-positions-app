# librosa vs madmom — Experiment B Compare

**Experiment:** `4.6-exp-madmom-beat-v1`
**Adoption:** NOT DECIDED (human review)
**Fusion / MSAF:** still forbidden

## Headline axis PASS /20

| Analyzer | Period | Phase | Continuity | Evidence |
| --- | --- | --- | --- | --- |
| librosa (A) | 16/20 | 0/20 | 0/20 | 20/20 |
| madmom (B) | 19/20 | 0/20 | 2/20 | 18/20 |

## Beat finding classes

| Analyzer | PASS | WEAK | GT-AMBIGUITY | ANALYZER-LIMIT |
| --- | --- | --- | --- | --- |
| librosa | 0 | 9 | 0 | 11 |
| madmom | 0 | 8 | 0 | 12 |

## Phase delta summary

- improved: **1**
- same: **18**
- regressed: **1**

## song-013 (Golden Case)

|  | Period | Phase | Phase ms | halfBeat | Cont | Evid | Class |
| --- | --- | --- | --- | --- | --- | --- | --- |
| librosa | PASS | FAIL | 166 | 0.68 | WEAK | PASS | WEAK |
| madmom | PASS | FAIL | 121 | 0.49 | FAIL | PASS | ANALYZER-LIMIT |

Phase delta: **same** (ms Δ -45)

## Per-song Phase / Continuity

| ID | Title | A Phase | B Phase | ΔPhase | A ms | B ms | A Cont | B Cont |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | アイドル | WEAK | WEAK | same | 81 | 88 | WEAK | WEAK |
| 002 | ダンスホール | FAIL | FAIL | same | 116 | 130 | FAIL | FAIL |
| 003 | 唱 | FAIL | FAIL | same | 120 | 114 | FAIL | FAIL |
| 004 | ポリリズム | FAIL | FAIL | same | 116 | 119 | FAIL | FAIL |
| 005 | Super Shy | WEAK | WEAK | same | 96 | 96 | WEAK | WEAK |
| 006 | MIC Drop | FAIL | FAIL | same | 174 | 160 | WEAK | WEAK |
| 007 | How You Like That | WEAK | WEAK | same | 87 | 57 | FAIL | PASS |
| 008 | God's Menu | FAIL | WEAK | improved | 105 | 81 | FAIL | WEAK |
| 009 | Get Ur Freak On | FAIL | FAIL | same | 180 | 167 | FAIL | PASS |
| 010 | Still D.R.E. | FAIL | FAIL | same | 173 | 182 | FAIL | FAIL |
| 011 | HUMBLE. | FAIL | FAIL | same | 108 | 106 | WEAK | WEAK |
| 012 | SICKO MODE | FAIL | FAIL | same | 106 | 105 | WEAK | WEAK |
| 013 | One More Time | FAIL | FAIL | same | 166 | 121 | WEAK | FAIL |
| 014 | Omen | FAIL | FAIL | same | 126 | 128 | WEAK | WEAK |
| 015 | Bangarang | FAIL | FAIL | same | 129 | 137 | FAIL | FAIL |
| 016 | 24K Magic | FAIL | FAIL | same | 140 | 147 | FAIL | FAIL |
| 017 | Billie Jean | FAIL | FAIL | same | 152 | 147 | FAIL | FAIL |
| 018 | Thinkin Bout You | FAIL | FAIL | same | 104 | 105 | FAIL | FAIL |
| 019 | カタオモイ | FAIL | FAIL | same | 114 | 163 | FAIL | FAIL |
| 020 | Cornfield Chase | WEAK | FAIL | regressed | 94 | 105 | FAIL | FAIL |

## Decision gate (human)

### Evidence summary (auto)

- Phase PASS: librosa **0/20** → madmom **0/20** (no Phase PASS lift)
- Phase verdict deltas: improved **1** · same **18** · regressed **1**
- Period PASS: 16/20 → 19/20
- Continuity PASS: 0/20 → 2/20
- song-013: Phase still **FAIL** (ms 166→121); Continuity **regressed**

### Spec promote rules vs this run

| Rule | Met? |
|------|------|
| Phase lift on Golden 20 | **NO** (0→0 PASS; only 1 verdict improved) |
| 013 Phase improves, Period holds | **NO** (Phase FAIL remains; Period held but Continuity regressed) |
| HALFBEAT-UNSTABLE shrinks | **not clearly** (see per-song; no broad Phase PASS) |
| GT-AMBIGUITY stays 0 | **YES** |
| Continuity not traded away | **mixed** (some up, 013 down) |

### Recommendation (measurement, not adoption)

**Do not formally adopt madmom from Experiment B alone.**
**Do not start Fusion** — Phase complementarity is not established (both analyzers fail Phase on nearly all songs).

Valuable negative result: “madmom alone fixes dance Beat Phase” is **not supported** under this locked GT/4-axis contract.

Next human options (separate GO): diagnose shared phase-reference issue · try alternate madmom config (still offline, same locks) · other Beat approaches · only then Fusion if complementary errors appear.
