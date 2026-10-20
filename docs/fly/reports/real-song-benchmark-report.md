# FLY Real-Song Benchmark — librosa

**Gate:** GO
**dataset:** `4.6.1-double-consensus`
**analyzer:** `librosa`
**songs scored:** 20/20

## Axis PASS counts (Beat Pattern)

| Period PASS | Phase PASS | Continuity PASS | Evidence PASS | n |
| --- | --- | --- | --- | --- |
| 16 | 0 | 0 | 20 | 20 |

## Beat finding classes

| PASS | WEAK | GT-AMBIGUITY | ANALYZER-LIMIT |
| --- | --- | --- | --- |
| 0 | 9 | 0 | 11 |

## song-013

- Period **PASS** · Phase **FAIL** (166ms) · Continuity **WEAK** · Evidence **PASS**
- Song class: **WEAK**

## Per-song

| ID | Title | Period | Phase ms | Phase | Cont | Evid | Class |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | アイドル | WEAK | 81 | WEAK | WEAK | PASS | WEAK |
| 002 | ダンスホール | WEAK | 116 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 003 | 唱 | PASS | 120 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 004 | ポリリズム | PASS | 116 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 005 | Super Shy | PASS | 96 | WEAK | WEAK | PASS | WEAK |
| 006 | MIC Drop | PASS | 174 | FAIL | WEAK | PASS | WEAK |
| 007 | How You Like That | PASS | 87 | WEAK | FAIL | PASS | WEAK |
| 008 | God's Menu | PASS | 105 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 009 | Get Ur Freak On | FAIL | 180 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 010 | Still D.R.E. | PASS | 173 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 011 | HUMBLE. | PASS | 108 | FAIL | WEAK | PASS | WEAK |
| 012 | SICKO MODE | WEAK | 106 | FAIL | WEAK | PASS | WEAK |
| 013 | One More Time | PASS | 166 | FAIL | WEAK | PASS | WEAK |
| 014 | Omen | PASS | 126 | FAIL | WEAK | PASS | WEAK |
| 015 | Bangarang | PASS | 129 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 016 | 24K Magic | PASS | 140 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 017 | Billie Jean | PASS | 152 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 018 | Thinkin Bout You | PASS | 104 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 019 | カタオモイ | PASS | 114 | FAIL | FAIL | PASS | ANALYZER-LIMIT |
| 020 | Cornfield Chase | PASS | 94 | WEAK | FAIL | PASS | WEAK |

## Notes

- No Fusion · No MSAF · librosa baseline untouched
- Formal adoption is a separate human decision after A/B compare
