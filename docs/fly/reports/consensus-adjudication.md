# Consensus Adjudication — Double Songs (002 / 005 / 010 / 013)

**Status:** FINALIZED (`consensus.json` written)  
**GT version:** `4.6.1-double-consensus`  
**Benchmark:** **NO-GO** (awaiting explicit human GO after this report)  
**Order:** 013 → 005 → 002 → 010 (individual rulings; no bulk same-rule)

## What this locks

Consensus is not “average A and B.” It fixes **what FLY treats as correct** for Beat Pattern GT:

- Beat / Downbeat = representative pattern + continuation (not full-song point lists)
- Benchmark Beat axes = **Period / Phase / Continuity / Evidence** (not pointwise F1)
- Dual-annotator conflict → human `consensus_reason` (required on all four; critical on 013)

## Per-song rulings

| Song | Band | Ruling | Beat seed | Notes |
|------|------|--------|-----------|-------|
| **013** One More Time | DISAGREE | **Phase-start error** (not half-beat dual-phase) | **B** | Same BPM 122.5; ~207ms offset rejected as alternate phase. A beats[2:] lock to B (~24ms). |
| **005** Super Shy | DISAGREE | Section labels = **A form** (not majority) | **A** (n=32) | Boundary IoU high; label rate 0.33 → no silent average. B dense = evidence only. |
| **002** ダンスホール | AGREE | Shared values; seed density ≠ conflict | **A** (n=20) | A20 vs B40 under pattern+continuation. Micro-labels → BREAK / OUTRO. |
| **010** Still D.R.E. | TOLERATE | Both within band; reason-tagged diffs | **A** (n=24) | Beat AGREE; Sec/MC soft; labels adjudicated with reasons. |

### 013 — phase policy (FLY-critical)

**Question:** Is ~207ms (≈ half-beat at 122.5 BPM) a legitimate alternate phase, or a Beat Pattern phase error?

**Decision:** Phase error / early tap on A. **Not** dual-phase GT.

**Why:** A’s later beats already align to B’s grid; adopting both phases would make Benchmark unable to tell “Analyzer wrong” from “GT phase undefined.”

**Evidence kept in `consensus_reason`:** period shared; phase offset rejected; seed = B; section labels per-span.

## Artifacts

Under `~/ChoreoCoreDatasets/fly-real-song/annotations/song-XXX/`:

| File | Role |
|------|------|
| `agreement.json` | Pre-consensus scores (retained) |
| `disagreements.json` | Itemized A≠B (retained) |
| `consensus.PROPOSAL.json` | `SUPERSEDED_BY_consensus.json` |
| **`consensus.json`** | Final GT for doubles (`source: consensus`) |

Integrity dump: `docs/fly/reports/gt-integrity-post-consensus.json`  
Code stamp: `FLY_REAL_SONG_DATASET_VERSION = "4.6.1-double-consensus"`

## Integrity recheck (20 songs)

| Check | Result |
|-------|--------|
| Beat / Downbeat / Sections / MC present | OK |
| Required fields / time order / section overlap | OK |
| Provenance + versions on consensus | OK (`source`, `consensus_reason`) |
| hardIssueSongs | **0** |

## Gates

| Gate | Status |
|------|--------|
| ① Consensus.PROPOSAL human adjudication | ✅ |
| ② `consensus.json` + `consensus_reason` | ✅ |
| ③ GT version → `4.6.1-double-consensus` | ✅ |
| ④ 20-song integrity recheck | ✅ (0 hard) |
| ⑤ Benchmark | **NO-GO** until you say GO |

## Next

Explicit **Benchmark GO** only after you accept these four rulings (especially **013 phase policy**).  
Then evaluate Beat with Period / Phase / Continuity / Evidence only.
