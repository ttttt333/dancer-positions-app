# FLY Weakness Report (Phase 4.6)

- weakness_version: `1.0.0`
- annotated songs in run: 1
- lowSampleSizeWarning: **YES**

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

## Findings (WEAK / WATCH first)

| severity | analyzer | dimension | condition | score | n | evidence |
|----------|----------|-----------|-----------|-------|---|----------|
| WEAK | essentia | 8COUNT | all | 0.000 | 1 | LOW |
| WEAK | essentia | 8COUNT | beatDensity:normal | 0.000 | 1 | LOW |
| WEAK | essentia | 8COUNT | complexity:simple | 0.000 | 1 | LOW |
| WEAK | essentia | 8COUNT | genre:pilot | 0.000 | 1 | LOW |
| WEAK | essentia | 8COUNT | tempo:medium | 0.000 | 1 | LOW |
| WEAK | essentia | 8COUNT | vocal:vocal-heavy | 0.000 | 1 | LOW |
| WEAK | librosa | 8COUNT | all | 0.000 | 1 | LOW |
| WEAK | librosa | 8COUNT | beatDensity:normal | 0.000 | 1 | LOW |
| WEAK | librosa | 8COUNT | complexity:simple | 0.000 | 1 | LOW |
| WEAK | librosa | 8COUNT | genre:pilot | 0.000 | 1 | LOW |
| WEAK | librosa | 8COUNT | tempo:medium | 0.000 | 1 | LOW |
| WEAK | librosa | 8COUNT | vocal:vocal-heavy | 0.000 | 1 | LOW |
| WEAK | essentia | SECTION | all | 0.400 | 1 | LOW |
| WEAK | essentia | SECTION | beatDensity:normal | 0.400 | 1 | LOW |
| WEAK | essentia | SECTION | complexity:simple | 0.400 | 1 | LOW |
| WEAK | essentia | SECTION | genre:pilot | 0.400 | 1 | LOW |
| WEAK | essentia | SECTION | tempo:medium | 0.400 | 1 | LOW |
| WEAK | essentia | SECTION | vocal:vocal-heavy | 0.400 | 1 | LOW |

## Active Expansion Plan (+10)

- 8COUNT@beatDensity:normal
- 8COUNT@complexity:simple
- 8COUNT@genre:pilot
- 8COUNT@tempo:medium
- 8COUNT@vocal:vocal-heavy
- SECTION@beatDensity:normal
- SECTION@complexity:simple
- SECTION@genre:pilot
- SECTION@tempo:medium
- SECTION@vocal:vocal-heavy

### Rationale

- essentia 8COUNT on beatDensity:normal: score=0.000 n=1 evidence=LOW → WEAK
- essentia 8COUNT on complexity:simple: score=0.000 n=1 evidence=LOW → WEAK
- essentia 8COUNT on genre:pilot: score=0.000 n=1 evidence=LOW → WEAK
- essentia 8COUNT on tempo:medium: score=0.000 n=1 evidence=LOW → WEAK
- essentia 8COUNT on vocal:vocal-heavy: score=0.000 n=1 evidence=LOW → WEAK
- librosa 8COUNT on beatDensity:normal: score=0.000 n=1 evidence=LOW → WEAK
- librosa 8COUNT on complexity:simple: score=0.000 n=1 evidence=LOW → WEAK
- librosa 8COUNT on genre:pilot: score=0.000 n=1 evidence=LOW → WEAK