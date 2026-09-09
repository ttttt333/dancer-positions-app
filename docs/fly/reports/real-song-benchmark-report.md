# FLY Real-Song Benchmark

> **LOW SAMPLE SIZE** — annotated songs in this run: 1. Do not claim production accuracy.
> Phase 4.6 FREEZE: no Fusion weight / Formation / madmom changes.

# FLY Benchmark Report

- benchmark_version: `1.0.0`
- dataset_version: `1.0.0`
- ground_truth_version: `1.0.0`
- metrics_version: `1.0.0`
- songs×analyzers: 2
- profiles: 48

## Per-song aggregates

| song | analyzer | aggregate | evidence | beat F1@40 | section F1 |
|------|----------|-----------|----------|------------|------------|
| song-pilot-format | essentia | 0.800 | HIGH | 1.000 | 0.400 |
| song-pilot-format | librosa | 1.000 | HIGH | 1.000 | 1.000 |

## Reliability profiles (Accuracy × Condition × Evidence)

| analyzer | signal | condition | metric | score | n | evidence |
|----------|--------|-----------|--------|-------|---|----------|
| essentia | beat | all | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | beatDensity:normal | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | complexity:simple | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | genre:pilot | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | tempo:medium | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | vocal:vocal-heavy | f1@40ms | 1.000 | 1 | LOW |
| essentia | eightCount | all | phraseAlignment | 0.000 | 1 | LOW |
| essentia | eightCount | beatDensity:normal | phraseAlignment | 0.000 | 1 | LOW |
| essentia | eightCount | complexity:simple | phraseAlignment | 0.000 | 1 | LOW |
| essentia | eightCount | genre:pilot | phraseAlignment | 0.000 | 1 | LOW |
| essentia | eightCount | tempo:medium | phraseAlignment | 0.000 | 1 | LOW |
| essentia | eightCount | vocal:vocal-heavy | phraseAlignment | 0.000 | 1 | LOW |
| essentia | section | all | labelF1 | 0.400 | 1 | LOW |
| essentia | section | beatDensity:normal | labelF1 | 0.400 | 1 | LOW |
| essentia | section | complexity:simple | labelF1 | 0.400 | 1 | LOW |
| essentia | section | genre:pilot | labelF1 | 0.400 | 1 | LOW |
| essentia | section | tempo:medium | labelF1 | 0.400 | 1 | LOW |
| essentia | section | vocal:vocal-heavy | labelF1 | 0.400 | 1 | LOW |
| essentia | tempo | all | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | beatDensity:normal | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | complexity:simple | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | genre:pilot | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | tempo:medium | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | vocal:vocal-heavy | classCorrect | 1.000 | 1 | LOW |
| librosa | beat | all | f1@40ms | 1.000 | 1 | LOW |
| librosa | beat | beatDensity:normal | f1@40ms | 1.000 | 1 | LOW |
| librosa | beat | complexity:simple | f1@40ms | 1.000 | 1 | LOW |
| librosa | beat | genre:pilot | f1@40ms | 1.000 | 1 | LOW |
| librosa | beat | tempo:medium | f1@40ms | 1.000 | 1 | LOW |
| librosa | beat | vocal:vocal-heavy | f1@40ms | 1.000 | 1 | LOW |
| librosa | eightCount | all | phraseAlignment | 0.000 | 1 | LOW |
| librosa | eightCount | beatDensity:normal | phraseAlignment | 0.000 | 1 | LOW |
| librosa | eightCount | complexity:simple | phraseAlignment | 0.000 | 1 | LOW |
| librosa | eightCount | genre:pilot | phraseAlignment | 0.000 | 1 | LOW |
| librosa | eightCount | tempo:medium | phraseAlignment | 0.000 | 1 | LOW |
| librosa | eightCount | vocal:vocal-heavy | phraseAlignment | 0.000 | 1 | LOW |
| librosa | section | all | labelF1 | 1.000 | 1 | LOW |
| librosa | section | beatDensity:normal | labelF1 | 1.000 | 1 | LOW |
| librosa | section | complexity:simple | labelF1 | 1.000 | 1 | LOW |
| librosa | section | genre:pilot | labelF1 | 1.000 | 1 | LOW |
| librosa | section | tempo:medium | labelF1 | 1.000 | 1 | LOW |
| librosa | section | vocal:vocal-heavy | labelF1 | 1.000 | 1 | LOW |
| librosa | tempo | all | classCorrect | 1.000 | 1 | LOW |
| librosa | tempo | beatDensity:normal | classCorrect | 1.000 | 1 | LOW |
| librosa | tempo | complexity:simple | classCorrect | 1.000 | 1 | LOW |
| librosa | tempo | genre:pilot | classCorrect | 1.000 | 1 | LOW |
| librosa | tempo | tempo:medium | classCorrect | 1.000 | 1 | LOW |
| librosa | tempo | vocal:vocal-heavy | classCorrect | 1.000 | 1 | LOW |

## Analyzer agreement (≠ accuracy)

- song-pilot-format: librosa vs essentia — tempo=1.000 beatF1=1.000 section=0.400

> Profiles with LOW evidence must not drive Fusion weights. Phase 4.5 does not auto-update weights.

> Pilot schema only — Stage A human GT not complete.
