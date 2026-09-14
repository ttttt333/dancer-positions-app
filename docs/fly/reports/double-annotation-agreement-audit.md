# Double Annotation — Agreement Audit

**Status:** Agreement computed → Consensus **FINALIZED** (see `consensus-adjudication.md`)  
**GT version:** `4.6.1-double-consensus`  
**Benchmark:** **NO-GO** until explicit human GO  
**Songs:** 002 / 005 / 010 / 013  

## Principle

- Compare A↔B mechanically; **do not force B → A**
- Beat uses **Period / Phase / Continuity / Evidence** (not pointwise F1)
- Different Beat/Downbeat observation windows ≠ automatic disagreement
- Individual rulings (013 → 005 → 002 → 010); no bulk same-rule

## Artifacts

Per song under `~/ChoreoCoreDatasets/fly-real-song/annotations/song-XXX/`:

| File | Meaning |
|------|---------|
| `agreement.json` | Dimension scores + thresholds |
| `disagreements.json` | Itemized A≠B |
| `consensus.PROPOSAL.json` | Superseded draft |
| **`consensus.json`** | Final double GT (`source: consensus`) |

Machine summary: `docs/fly/reports/double-annotation-agreement-audit.json`  
Adjudication: `docs/fly/reports/consensus-adjudication.md`  
Integrity: `docs/fly/reports/gt-integrity-post-consensus.json`

## Agreement bands (pre-ruling)

| Song | Overall | Beat | Down | Section | MC |
|------|---------|------|------|---------|----|
| 002 ダンスホール | AGREE | AGREE | AGREE | AGREE | AGREE |
| 005 Super Shy | DISAGREE | TOLERATE | TOLERATE | DISAGREE | AGREE |
| 010 Still D.R.E. | TOLERATE | AGREE | AGREE | TOLERATE | TOLERATE |
| 013 One More Time | DISAGREE | DISAGREE | DISAGREE | DISAGREE | AGREE |

### Beat highlights

| Song | Period Δ | Phase Δ | A seeds | B seeds | Consensus seed |
|------|----------|---------|---------|---------|----------------|
| 002 | 0.37% | 3 ms | 20 | 40 | A (pattern) |
| 005 | 0.25% | 60 ms | 32 | 384 | A (pattern) |
| 010 | 0.47% | 25 ms | 24 | 419 | A (pattern) |
| 013 | 1.41% | **207 ms** | 20 | 655 | **B** (phase error on A) |

013: same BPM 122.5; ~207ms treated as **phase-start error**, not alternate half-beat phase.

## Gates

| Gate | Status |
|------|--------|
| A/B Agreement computed | ✅ |
| Disagreements recorded | ✅ |
| Consensus finalized | ✅ |
| GT version bump | ✅ `4.6.1-double-consensus` |
| 20-song integrity recheck | ✅ hardIssueSongs=0 |
| Benchmark | **NO-GO** |
