# FLY Real-Song Stage A Status

- real_song_dataset_version: `4.6.0-stage-a`
- registered songs: **20**
- annotated songs: **0**
- status: **UNANNOTATED — awaiting human GT**

## FREEZE

- no_madmom
- no_msaf
- no_cyanite
- no_demucs
- no_fusion_weight_change
- no_formation_engine_change
- no_keep_current
- no_ml_training
- no_musical_change_to_formation_change

## Coverage

- genres: ballad, complex, edm, funk, hip-hop, instrumental, j-pop, k-pop, live, mashup, pop, r&b, remix, soul, trap
- tempos: FAST, MEDIUM, SLOW
- densities: HIGH, LOW, MEDIUM
- complexities: COMPLEX, MEDIUM, SIMPLE
- double-annotate: song-002, song-005, song-010, song-013
- splits: DEV 12 / VAL 4 / HOLD 4

## LOW SAMPLE SIZE

Do **not** claim analyzer accuracy until human GT exists for Stage A.
Pilot schema reports below are **format checks only**.

## Next human steps

1. Place authorized audio locally (see `fixtures/fly/real-song/audio/README.md`)
2. Replace `PENDING_*` with sha256
3. Annotate human-first (no analyzer locking)
4. Double-annotate: song-002, song-005, song-010, song-013
5. Re-run `npm run fly:real-song-reports`
