# FLY Phase 4.6 — Annotation Contract

**annotation_contract_version:** `1.0.0`

## Human-first

1. Human listens and labels **without** locking to analyzer grids.
2. Analyzer output may be used later as **hypothesis only**.
3. **Never** copy Analyzer → Ground Truth.

## Required fields (per annotator file)

- `bpm` (number | null + confidence)
- `beats: number[]` (seconds)
- `downbeats: number[]`
- `countGrid` (8-count — see types)
- `sections[]`

## Optional

- `musicalChanges[]` — music change points only

## Forbidden in 4.6

- `formation_change`
- `KEEP_CURRENT` / formation recommendation labels

## Multi-annotator layout

```
annotations/
  song-001/
    annotator-a.json
    annotator-b.json   # subset double-annotated
    consensus.json     # after adjudication
    agreement.json
```

Raw annotations are never deleted when consensus is formed.

## Schema source of truth

`src/lib/fly/realSong/types.ts` + validators in `validation.ts`

## Operational SOP (binding)

**How to annotate** (Beat / Downbeat / Section / 8-count / musical_change HIGH / Human-first):

→ [`PHASE46-ANNOTATION-SOP.md`](./PHASE46-ANNOTATION-SOP.md)

## UI status

FLY Real-Song music GT **UI is not implemented**.  
Do not use Formation `AnnotationWorkbenchPage` for this GT.  
Stage A path: local waveform + JSON conforming to `RealSongAnnotation`.
