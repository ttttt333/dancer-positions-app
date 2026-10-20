# PHASE 4.6-F — Phase Anchor Independence Audit

**Status:** COMPLETE — Verdict **A CONDITIONAL-GO** (2026-09-14)  
**Spec ID:** `4.6-f-phase-anchor-independence-audit-v1`  
**Prerequisite:** 4.6-E Pilot complete (`013` / `020` / `009` / `005` / `002`)  
**Report:** `docs/fly/reports/phase-anchor-independence-audit.{md,json}`

---

## 0. What this gate audits

**Not accuracy.** Not Analyzer Phase error. Not Fusion / MSAF.

Only:

> Does Phase Anchor exist as an observation **independent of Beat / CountGrid**?

---

## 1. Absolute freeze (unchanged)

Golden 20 · Beat / Consensus GT · librosa / madmom · Benchmark thresholds · Fusion · MSAF · Formation · retargeting Beat GT.

No Analyzer changes during this gate.

---

## 2. Inputs

| Input | Role |
|-------|------|
| 5× `phase-anchors/song-XXX/phase-anchor.json` | human Pilot (under test) |
| Frozen Beat / CountGrid / Downbeat (read-only) | contrast only |
| Analyzer hyps | **informational only** — never the success metric |

**Center song:** `song-013` (must be explainable without Beat vocabulary).

---

## 3. Audit axes (batch of 5, cross-song)

| Axis | Question |
|------|----------|
| **Independence** | Time and/or type/rationale ≠ Beat phase0 / CountGrid? |
| **Reproducibility** | Same song: is the primary origin stable enough to discuss (single annotator OK for Pilot; note if ambiguous)? |
| **Anchor kinds** | Soft types actually used (HIT / ANTICIPATION / GROOVE / …) — discovery inventory, not ontology lock |
| **Rationale consistency** | Reasons use dance/body/musical cue language — not “because beat 1 / CountGrid”? Especially **013** |

Out of scope: pointwise F1 · Analyzer Phase PASS rate · Fusion score.

---

## 4. Verdict

| Verdict | Criteria | Next |
|---------|----------|------|
| **A — CONDITIONAL-GO** | Independent info observed (esp. 013); kinds/rationales not collapsed to Beat-1 copy | Extra Pilot → then GO for L3 model design |
| **B — L3 re-evaluate** | Near-copy of Beat/CountGrid + rationales collapse to “1拍目” | Do **not** force Layer 3; redesign necessity |

Emit a short report: `docs/fly/reports/phase-anchor-independence-audit.{md,json}` when run.

---

## 5. One-sentence contract

> 4.6-F judges whether Phase Anchor is independent observation — not whether Analyzers got more accurate.
