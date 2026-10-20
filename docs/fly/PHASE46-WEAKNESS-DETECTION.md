# FLY Phase 4.6 — Weakness Detection & Active Expansion

**weakness_version:** `1.0.0`

## Purpose

Turn reliability profiles into **actionable weakness findings** with severity, then propose the **next +10 songs** by condition — not by random genre fill.

## WeaknessFinding

```
analyzer × dimension × condition × score × sampleCount × evidenceConfidence × severity
```

Severity (v1 heuristics; measurement-only):

| severity | rule (illustrative) |
|----------|---------------------|
| WEAK | score &lt; 0.70 and evidence ≠ NONE |
| WATCH | score &lt; 0.85 or evidence LOW with score &lt; 0.90 |
| INFO | otherwise |

**LOW evidence never justifies shipping Fusion weights.**

## Active Expansion

```
WeaknessFinding[] → ExpansionPlan { targetConditions[], suggestedSongCount: 10, rationale }
```

Example: SECTION × complexity:complex × Hip-Hop WEAK → next batch prioritizes those tags.
