# FLY Checkpoint — 4.6-E Pilot waiting

**Checkpoint ID:** `4.6-e-pilot-waiting-v1`  
**Locked at:** 2026-09-13  
**Status:** FROZEN baseline — human Pilot annotation only

---

## Do not proceed (until Pilot complete)

- Additional implementation
- Analyzer changes
- Fusion
- MSAF
- Formation / L3 wiring
- Accuracy-oriented scoring of Phase Anchors

---

## Current gate

**4.6-E** — Independent Phase Anchor Annotation (Pilot 5)  
Waiting for human `phase-anchor.json` on:

`song-013` · `song-020` · `song-009` · `song-005` · `song-002`

Dataset: `~/ChoreoCoreDatasets/fly-real-song/phase-anchors/`

---

## Next gate (when 5 files exist)

**Resume from:** `docs/fly/PHASE46-PHASE-ANCHOR-INDEPENDENCE-AUDIT.md`

**4.6-F Independence Audit** — axes only:

| Axis | Question |
|------|----------|
| Independence | ≠ Beat / CountGrid information? |
| Reproducibility | Same kind of judgment repeatable? |
| Anchor kinds | What origin types exist? |
| Rationale consistency | Shared structure in reasons? |

- **Center:** song-013  
- **Scope:** cross-song batch of 5  
- **Verdict:** A CONDITIONAL-GO → extra Pilot → GO · **or** B L3 re-evaluate  

**Sole success question:**

> Was an independent observation discovered that justifies existing L3 — not “did Analyzer accuracy improve?”

---

## Related locks

- `docs/fly/PHASE46-PHASE-ANCHOR-ANNOTATION.md`
- `docs/fly/PHASE46-PHASE-ANCHOR-INDEPENDENCE-AUDIT.md`
- `docs/fly/reports/phase-anchor-annotation-lock.json`
- `docs/fly/reports/phase-anchor-independence-audit-lock.json`
- `docs/fly/reports/real-song-stage-a-status.md`
