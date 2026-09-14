# FLY Phase 4.6 — Provenance

**provenance_version:** `1.0.0`

Every real song must record:

| Field | Purpose |
|-------|---------|
| `songId` | Stable id |
| `audioSha256` | Content identity (PENDING_* until file present) |
| `sourceType` | USER_OWNED / LICENSED / AUTHORIZED_DATASET |
| `annotationVersion` | Contract version |
| `annotators[]` | Who labeled |
| `status` | UNANNOTATED → ANNOTATED → REVIEWED → ADJUDICATED |
| `datasetSplit` | DEVELOPMENT / VALIDATION / HOLDOUT |
| `realSongDatasetVersion` | e.g. 4.6.1-double-consensus |

Hypothesis files (analyzer outputs) store:

- `analyzerId`, `analyzerVersion`, `adapterVersion`
- `audioSha256` (must match manifest)
- `producedAt`

GT and hypotheses never share the same write path.
