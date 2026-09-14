# FLY Phase 4.6 — Dataset (Stage A)

**real_song_dataset_version:** `4.6.1-double-consensus`  
**split_policy:** Development 12 / Validation 4 / Holdout 4 (conceptual; no training)

## Principle

Select by **difficulty matrix**, not genre quotas alone.

## Stage A — 20 slots (planned coverage)

| songId | Primary intent (conditions) | Double-annotate? | Split |
|--------|----------------------------|------------------|-------|
| song-001 | J-POP / medium / simple / vocal | | DEV |
| song-002 | K-POP / fast / dense / complex / vocal | yes | DEV |
| song-003 | Hip-Hop / medium / sparse / moderate | | DEV |
| song-004 | R&B / slow / sparse / vocal | | DEV |
| song-005 | EDM / fast / dense / drop-heavy | yes | DEV |
| song-006 | Funk / medium / dense / syncopation-risk | | DEV |
| song-007 | Trap / medium / sparse-hihat / vocal | | DEV |
| song-008 | Ballad / slow / simple / vocal | | DEV |
| song-009 | Instrumental / medium / simple | | DEV |
| song-010 | Complex structure / variable / vocal | yes | DEV |
| song-011 | Long unusual intro / J-POP | | DEV |
| song-012 | Long breakdown / EDM | | DEV |
| song-013 | Live recording / tempo drift risk | yes | VAL |
| song-014 | Remix / structure odd | | VAL |
| song-015 | Mashup / complex | | VAL |
| song-016 | Tempo change mid-song | | VAL |
| song-017 | Hip-Hop complex + break-heavy | | HOLD |
| song-018 | K-POP prechorus ambiguity | | HOLD |
| song-019 | Slow ballad live | | HOLD |
| song-020 | High density EDM instrumental | | HOLD |

Statuses start as `UNANNOTATED` until humans finish.

## Active Expansion

```
20 → Benchmark → Weakness → +10 targeted → Benchmark → …
```

Do **not** add random songs when a condition is WEAK.

## Git policy

- ❌ copyrighted audio blobs
- ⭕ manifest, hashes, annotations, reports
