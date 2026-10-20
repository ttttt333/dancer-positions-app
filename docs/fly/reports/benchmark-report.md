# FLY Benchmark Report

- benchmark_version: `1.0.0`
- dataset_version: `1.0.0`
- ground_truth_version: `1.0.0`
- metrics_version: `1.0.0`
- songs×analyzers: 10
- profiles: 168

## Per-song aggregates

| song | analyzer | aggregate | evidence | beat F1@40 | section F1 |
|------|----------|-----------|----------|------------|------------|
| gt-complex | essentia | 1.000 | HIGH | 1.000 | 1.000 |
| gt-complex | librosa | 0.692 | HIGH | 0.667 | 0.600 |
| gt-edm | essentia | 1.000 | HIGH | 1.000 | 1.000 |
| gt-edm | librosa | 1.000 | HIGH | 1.000 | 1.000 |
| gt-hiphop | essentia | 1.000 | HIGH | 1.000 | 1.000 |
| gt-hiphop | librosa | 1.000 | HIGH | 1.000 | 1.000 |
| gt-simple-pop | essentia | 1.000 | HIGH | 1.000 | 1.000 |
| gt-simple-pop | librosa | 1.000 | HIGH | 1.000 | 1.000 |
| gt-slow-ballad | essentia | 1.000 | HIGH | 1.000 | 1.000 |
| gt-slow-ballad | librosa | 1.000 | HIGH | 1.000 | 1.000 |

## Reliability profiles (Accuracy × Condition × Evidence)

| analyzer | signal | condition | metric | score | n | evidence |
|----------|--------|-----------|--------|-------|---|----------|
| essentia | beat | all | f1@40ms | 1.000 | 5 | LOW |
| essentia | beat | beatDensity:dense | f1@40ms | 1.000 | 2 | LOW |
| essentia | beat | beatDensity:normal | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | beatDensity:sparse | f1@40ms | 1.000 | 2 | LOW |
| essentia | beat | complexity:complex | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | complexity:moderate | f1@40ms | 1.000 | 2 | LOW |
| essentia | beat | complexity:simple | f1@40ms | 1.000 | 2 | LOW |
| essentia | beat | energy:high | f1@40ms | 1.000 | 2 | LOW |
| essentia | beat | energy:low | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | energy:medium | f1@40ms | 1.000 | 2 | LOW |
| essentia | beat | genre:ballad | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | genre:complex | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | genre:edm | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | genre:hip-hop | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | genre:pop | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | tempo:fast | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | tempo:medium | f1@40ms | 1.000 | 2 | LOW |
| essentia | beat | tempo:slow | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | tempo:variable | f1@40ms | 1.000 | 1 | LOW |
| essentia | beat | vocal:mixed | f1@40ms | 1.000 | 2 | LOW |
| essentia | beat | vocal:vocal-heavy | f1@40ms | 1.000 | 3 | LOW |
| essentia | eightCount | all | phraseAlignment | 1.000 | 5 | LOW |
| essentia | eightCount | beatDensity:dense | phraseAlignment | 1.000 | 2 | LOW |
| essentia | eightCount | beatDensity:normal | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | beatDensity:sparse | phraseAlignment | 1.000 | 2 | LOW |
| essentia | eightCount | complexity:complex | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | complexity:moderate | phraseAlignment | 1.000 | 2 | LOW |
| essentia | eightCount | complexity:simple | phraseAlignment | 1.000 | 2 | LOW |
| essentia | eightCount | energy:high | phraseAlignment | 1.000 | 2 | LOW |
| essentia | eightCount | energy:low | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | energy:medium | phraseAlignment | 1.000 | 2 | LOW |
| essentia | eightCount | genre:ballad | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | genre:complex | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | genre:edm | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | genre:hip-hop | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | genre:pop | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | tempo:fast | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | tempo:medium | phraseAlignment | 1.000 | 2 | LOW |
| essentia | eightCount | tempo:slow | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | tempo:variable | phraseAlignment | 1.000 | 1 | LOW |
| essentia | eightCount | vocal:mixed | phraseAlignment | 1.000 | 2 | LOW |
| essentia | eightCount | vocal:vocal-heavy | phraseAlignment | 1.000 | 3 | LOW |
| essentia | section | all | labelF1 | 1.000 | 5 | LOW |
| essentia | section | beatDensity:dense | labelF1 | 1.000 | 2 | LOW |
| essentia | section | beatDensity:normal | labelF1 | 1.000 | 1 | LOW |
| essentia | section | beatDensity:sparse | labelF1 | 1.000 | 2 | LOW |
| essentia | section | complexity:complex | labelF1 | 1.000 | 1 | LOW |
| essentia | section | complexity:moderate | labelF1 | 1.000 | 2 | LOW |
| essentia | section | complexity:simple | labelF1 | 1.000 | 2 | LOW |
| essentia | section | energy:high | labelF1 | 1.000 | 2 | LOW |
| essentia | section | energy:low | labelF1 | 1.000 | 1 | LOW |
| essentia | section | energy:medium | labelF1 | 1.000 | 2 | LOW |
| essentia | section | genre:ballad | labelF1 | 1.000 | 1 | LOW |
| essentia | section | genre:complex | labelF1 | 1.000 | 1 | LOW |
| essentia | section | genre:edm | labelF1 | 1.000 | 1 | LOW |
| essentia | section | genre:hip-hop | labelF1 | 1.000 | 1 | LOW |
| essentia | section | genre:pop | labelF1 | 1.000 | 1 | LOW |
| essentia | section | tempo:fast | labelF1 | 1.000 | 1 | LOW |
| essentia | section | tempo:medium | labelF1 | 1.000 | 2 | LOW |
| essentia | section | tempo:slow | labelF1 | 1.000 | 1 | LOW |
| essentia | section | tempo:variable | labelF1 | 1.000 | 1 | LOW |
| essentia | section | vocal:mixed | labelF1 | 1.000 | 2 | LOW |
| essentia | section | vocal:vocal-heavy | labelF1 | 1.000 | 3 | LOW |
| essentia | tempo | all | classCorrect | 1.000 | 5 | LOW |
| essentia | tempo | beatDensity:dense | classCorrect | 1.000 | 2 | LOW |
| essentia | tempo | beatDensity:normal | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | beatDensity:sparse | classCorrect | 1.000 | 2 | LOW |
| essentia | tempo | complexity:complex | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | complexity:moderate | classCorrect | 1.000 | 2 | LOW |
| essentia | tempo | complexity:simple | classCorrect | 1.000 | 2 | LOW |
| essentia | tempo | energy:high | classCorrect | 1.000 | 2 | LOW |
| essentia | tempo | energy:low | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | energy:medium | classCorrect | 1.000 | 2 | LOW |
| essentia | tempo | genre:ballad | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | genre:complex | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | genre:edm | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | genre:hip-hop | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | genre:pop | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | tempo:fast | classCorrect | 1.000 | 1 | LOW |
| essentia | tempo | tempo:medium | classCorrect | 1.000 | 2 | LOW |

_… 88 more profiles truncated in MD_

## Analyzer agreement (≠ accuracy)

- gt-complex: librosa vs essentia — tempo=1.000 beatF1=0.667 section=0.600
- gt-edm: librosa vs essentia — tempo=1.000 beatF1=1.000 section=1.000
- gt-hiphop: librosa vs essentia — tempo=1.000 beatF1=1.000 section=1.000
- gt-simple-pop: librosa vs essentia — tempo=1.000 beatF1=1.000 section=1.000
- gt-slow-ballad: librosa vs essentia — tempo=1.000 beatF1=1.000 section=1.000

> Profiles with LOW evidence must not drive Fusion weights. Phase 4.5 does not auto-update weights.