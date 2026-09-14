# PHASE 4.6-C — Common Phase Reference Audit (Spec)

**Status:** COMPLETE  
**Audit ID:** `4.6-c-phase-reference-v1`  
**Reports:** `docs/fly/reports/phase-reference-audit.{md,json}`

## Purpose

After Experiment B (madmom Period↑, Phase still 0/20), investigate whether Phase failure is:

| Hyp | Claim |
|-----|-------|
| A | Analyzer beat positions wrong |
| B | FLY Phase reference / Dance Phase definition insufficient |
| C | Dance Phase needs multi-cue evidence beyond one beat sequence |

**Out of scope:** new analyzers, Fusion, MSAF, GT edits.

## Method

For each Golden-20 song, using Consensus/annotator-a Beat Pattern as reference:

1. **Signed phase residual** of librosa & madmom beats (folded to (−½IOI,+½IOI])
2. **medianAbsSec** = median(|residual|) — Phase magnitude (not abs of signed-median)
3. **Half-beat bins** from magnitude + sign
4. **Analyzer relation:** BOTH_OFF_AGREE / DISAGREE / closer-to-GT
5. CountGrid offset vs GT beat phase0

## Headline result (locked)

- **18/20 BOTH_OFF_AGREE** — librosa≈madmom (mean |Δ|≈25ms) but both off GT (mean |phase|≈123ms)
- **Hyp B: STRONG**
- **Phase wander (abs high, signed≈0): STRONG** (18 songs) — also supports A/C investigation
- **Fusion now: NO** (no complementary closer-split)
- **Analyzer swap: NO** (already shown by Experiment B)

## Development log entry

> madmom improved Period substantially (16→19), but Phase remained 0/20. Therefore the dominant Phase weakness is not solved by replacing the beat/tempo analyzer. FLY must investigate the common Phase Reference / Dance Phase definition before adding further analyzers or Fusion.

## Next (human GO required)

Define **Dance Phase** vs **Music Beat** as separate layers before more analyzers:

```
Beat candidates → Music Evidence → Beat Reference → Dance Phase → Count Grid
```
