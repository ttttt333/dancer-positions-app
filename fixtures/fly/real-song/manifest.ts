/**
 * Stage A — 20 real-song slots selected by difficulty matrix (not random genre fill).
 * Audio stays local; hashes are PENDING_* until files are registered.
 */

import type { RealSongManifest } from "../../../src/lib/fly/realSong/types";
import {
  FLY_ANNOTATION_CONTRACT_VERSION,
  FLY_REAL_SONG_DATASET_VERSION,
  FLY_REAL_SONG_PROVENANCE_VERSION,
} from "../../../src/lib/fly/realSong/versions";

function slot(
  partial: Omit<
    RealSongManifest,
    | "annotationVersion"
    | "realSongDatasetVersion"
    | "provenanceVersion"
    | "status"
    | "annotators"
    | "audioSha256"
  > &
    Partial<Pick<RealSongManifest, "status" | "annotators" | "audioSha256">>
): RealSongManifest {
  return {
    ...partial,
    annotationVersion: FLY_ANNOTATION_CONTRACT_VERSION,
    realSongDatasetVersion: FLY_REAL_SONG_DATASET_VERSION,
    provenanceVersion: FLY_REAL_SONG_PROVENANCE_VERSION,
    status: partial.status ?? "UNANNOTATED",
    annotators: partial.annotators ?? [],
    audioSha256:
      partial.audioSha256 ??
      `PENDING_${partial.songId.toUpperCase().replace(/-/g, "_")}`,
  };
}

/** Curated Stage A registry — selectionIntent is the point of Phase 4.6 */
export const STAGE_A_MANIFEST: RealSongManifest[] = [
  slot({
    songId: "song-001",
    title: "[TBD] J-POP simple",
    durationSec: 210,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: false,
    selectionIntent: "J-POP / medium / simple / vocal baseline",
    conditions: {
      genre: ["j-pop"],
      tempoClass: "MEDIUM",
      beatDensity: "MEDIUM",
      structureComplexity: "SIMPLE",
      vocal: "VOCAL",
      version: "ORIGINAL",
    },
  }),
  slot({
    songId: "song-002",
    title: "[TBD] K-POP dense complex",
    durationSec: 200,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: true,
    selectionIntent: "K-POP / fast / dense / complex — double annotate",
    conditions: {
      genre: ["k-pop"],
      tempoClass: "FAST",
      beatDensity: "HIGH",
      structureComplexity: "COMPLEX",
      vocal: "VOCAL",
      version: "ORIGINAL",
      flags: ["prechorus-ambiguity"],
    },
  }),
  slot({
    songId: "song-003",
    title: "[TBD] Hip-Hop sparse",
    durationSec: 180,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: false,
    selectionIntent: "Hip-Hop / sparse beat density",
    conditions: {
      genre: ["hip-hop"],
      tempoClass: "MEDIUM",
      beatDensity: "LOW",
      structureComplexity: "MEDIUM",
      vocal: "VOCAL",
      version: "ORIGINAL",
    },
  }),
  slot({
    songId: "song-004",
    title: "[TBD] R&B slow",
    durationSec: 240,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: false,
    selectionIntent: "R&B/Soul / slow / sparse",
    conditions: {
      genre: ["r&b", "soul"],
      tempoClass: "SLOW",
      beatDensity: "LOW",
      structureComplexity: "SIMPLE",
      vocal: "VOCAL",
      version: "ORIGINAL",
    },
  }),
  slot({
    songId: "song-005",
    title: "[TBD] EDM drop",
    durationSec: 195,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: true,
    selectionIntent: "EDM / fast / dense / drop-heavy — double annotate",
    conditions: {
      genre: ["edm"],
      tempoClass: "FAST",
      beatDensity: "HIGH",
      structureComplexity: "MEDIUM",
      vocal: "VOCAL",
      version: "ORIGINAL",
      flags: ["drop", "breakdown"],
    },
  }),
  slot({
    songId: "song-006",
    title: "[TBD] Funk syncopation",
    durationSec: 200,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: false,
    selectionIntent: "Funk / syncopation risk",
    conditions: {
      genre: ["funk"],
      tempoClass: "MEDIUM",
      beatDensity: "HIGH",
      structureComplexity: "MEDIUM",
      vocal: "VOCAL",
      version: "ORIGINAL",
      flags: ["syncopation"],
    },
  }),
  slot({
    songId: "song-007",
    title: "[TBD] Trap",
    durationSec: 170,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: false,
    selectionIntent: "Trap / sparse-kick dense-hat pattern",
    conditions: {
      genre: ["trap"],
      tempoClass: "MEDIUM",
      beatDensity: "LOW",
      structureComplexity: "MEDIUM",
      vocal: "VOCAL",
      version: "ORIGINAL",
      flags: ["hihat-dense"],
    },
  }),
  slot({
    songId: "song-008",
    title: "[TBD] Ballad",
    durationSec: 260,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: false,
    selectionIntent: "Ballad / slow / simple",
    conditions: {
      genre: ["ballad"],
      tempoClass: "SLOW",
      beatDensity: "LOW",
      structureComplexity: "SIMPLE",
      vocal: "VOCAL",
      version: "ORIGINAL",
    },
  }),
  slot({
    songId: "song-009",
    title: "[TBD] Instrumental",
    durationSec: 220,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: false,
    selectionIntent: "Instrumental / no vocal cues",
    conditions: {
      genre: ["instrumental"],
      tempoClass: "MEDIUM",
      beatDensity: "MEDIUM",
      structureComplexity: "SIMPLE",
      vocal: "INSTRUMENTAL",
      version: "ORIGINAL",
    },
  }),
  slot({
    songId: "song-010",
    title: "[TBD] Complex structure",
    durationSec: 280,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: true,
    selectionIntent: "Complex structure / variable feel — double annotate",
    conditions: {
      genre: ["complex"],
      tempoClass: "MEDIUM",
      beatDensity: "HIGH",
      structureComplexity: "COMPLEX",
      vocal: "VOCAL",
      version: "ORIGINAL",
      flags: ["half-time-risk", "odd-sections"],
    },
  }),
  slot({
    songId: "song-011",
    title: "[TBD] Long intro",
    durationSec: 250,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: false,
    selectionIntent: "Long / unusual intro",
    conditions: {
      genre: ["j-pop"],
      tempoClass: "MEDIUM",
      beatDensity: "MEDIUM",
      structureComplexity: "MEDIUM",
      vocal: "VOCAL",
      version: "ORIGINAL",
      flags: ["long-intro"],
    },
  }),
  slot({
    songId: "song-012",
    title: "[TBD] Long breakdown",
    durationSec: 230,
    sourceType: "USER_OWNED",
    datasetSplit: "DEVELOPMENT",
    doubleAnnotate: false,
    selectionIntent: "Long unusual breakdown",
    conditions: {
      genre: ["edm"],
      tempoClass: "FAST",
      beatDensity: "LOW",
      structureComplexity: "MEDIUM",
      vocal: "INSTRUMENTAL",
      version: "ORIGINAL",
      flags: ["long-breakdown"],
    },
  }),
  slot({
    songId: "song-013",
    title: "[TBD] Live recording",
    durationSec: 240,
    sourceType: "USER_OWNED",
    datasetSplit: "VALIDATION",
    doubleAnnotate: true,
    selectionIntent: "Live / tempo drift risk — double annotate",
    conditions: {
      genre: ["live"],
      tempoClass: "MEDIUM",
      beatDensity: "MEDIUM",
      structureComplexity: "MEDIUM",
      vocal: "VOCAL",
      version: "LIVE",
      flags: ["tempo-drift"],
    },
  }),
  slot({
    songId: "song-014",
    title: "[TBD] Remix",
    durationSec: 210,
    sourceType: "USER_OWNED",
    datasetSplit: "VALIDATION",
    doubleAnnotate: false,
    selectionIntent: "Remix / odd structure",
    conditions: {
      genre: ["remix"],
      tempoClass: "FAST",
      beatDensity: "HIGH",
      structureComplexity: "COMPLEX",
      vocal: "VOCAL",
      version: "REMIX",
    },
  }),
  slot({
    songId: "song-015",
    title: "[TBD] Mashup",
    durationSec: 200,
    sourceType: "USER_OWNED",
    datasetSplit: "VALIDATION",
    doubleAnnotate: false,
    selectionIntent: "Mashup / complex",
    conditions: {
      genre: ["mashup"],
      tempoClass: "MEDIUM",
      beatDensity: "HIGH",
      structureComplexity: "COMPLEX",
      vocal: "VOCAL",
      version: "MASHUP",
    },
  }),
  slot({
    songId: "song-016",
    title: "[TBD] Tempo change",
    durationSec: 220,
    sourceType: "USER_OWNED",
    datasetSplit: "VALIDATION",
    doubleAnnotate: false,
    selectionIntent: "Mid-song tempo change",
    conditions: {
      genre: ["pop"],
      tempoClass: "MEDIUM",
      beatDensity: "MEDIUM",
      structureComplexity: "COMPLEX",
      vocal: "VOCAL",
      version: "ORIGINAL",
      flags: ["tempo-change"],
    },
  }),
  slot({
    songId: "song-017",
    title: "[TBD] Hip-Hop complex holdout",
    durationSec: 190,
    sourceType: "USER_OWNED",
    datasetSplit: "HOLDOUT",
    doubleAnnotate: false,
    selectionIntent: "Holdout: Hip-Hop complex + break-heavy",
    conditions: {
      genre: ["hip-hop"],
      tempoClass: "MEDIUM",
      beatDensity: "MEDIUM",
      structureComplexity: "COMPLEX",
      vocal: "VOCAL",
      version: "ORIGINAL",
      flags: ["break-heavy"],
    },
  }),
  slot({
    songId: "song-018",
    title: "[TBD] K-POP prechorus holdout",
    durationSec: 205,
    sourceType: "USER_OWNED",
    datasetSplit: "HOLDOUT",
    doubleAnnotate: false,
    selectionIntent: "Holdout: K-POP prechorus ambiguity",
    conditions: {
      genre: ["k-pop"],
      tempoClass: "FAST",
      beatDensity: "HIGH",
      structureComplexity: "COMPLEX",
      vocal: "VOCAL",
      version: "ORIGINAL",
      flags: ["prechorus-ambiguity"],
    },
  }),
  slot({
    songId: "song-019",
    title: "[TBD] Slow ballad live holdout",
    durationSec: 270,
    sourceType: "USER_OWNED",
    datasetSplit: "HOLDOUT",
    doubleAnnotate: false,
    selectionIntent: "Holdout: slow ballad live",
    conditions: {
      genre: ["ballad"],
      tempoClass: "SLOW",
      beatDensity: "LOW",
      structureComplexity: "SIMPLE",
      vocal: "VOCAL",
      version: "LIVE",
    },
  }),
  slot({
    songId: "song-020",
    title: "[TBD] Dense EDM instrumental holdout",
    durationSec: 215,
    sourceType: "USER_OWNED",
    datasetSplit: "HOLDOUT",
    doubleAnnotate: false,
    selectionIntent: "Holdout: high density EDM instrumental",
    conditions: {
      genre: ["edm"],
      tempoClass: "FAST",
      beatDensity: "HIGH",
      structureComplexity: "MEDIUM",
      vocal: "INSTRUMENTAL",
      version: "ORIGINAL",
    },
  }),
];

export function loadStageAManifest(): RealSongManifest[] {
  return STAGE_A_MANIFEST;
}

export function stageACoverageSummary(manifests: RealSongManifest[] = STAGE_A_MANIFEST) {
  const genres = new Set(manifests.flatMap((m) => m.conditions.genre));
  const tempos = new Set(manifests.map((m) => m.conditions.tempoClass));
  const densities = new Set(manifests.map((m) => m.conditions.beatDensity));
  const complexities = new Set(
    manifests.map((m) => m.conditions.structureComplexity)
  );
  const doubles = manifests.filter((m) => m.doubleAnnotate).map((m) => m.songId);
  return {
    songCount: manifests.length,
    genres: [...genres].sort(),
    tempos: [...tempos].sort(),
    densities: [...densities].sort(),
    complexities: [...complexities].sort(),
    doubleAnnotateSongIds: doubles,
    splits: {
      DEVELOPMENT: manifests.filter((m) => m.datasetSplit === "DEVELOPMENT").length,
      VALIDATION: manifests.filter((m) => m.datasetSplit === "VALIDATION").length,
      HOLDOUT: manifests.filter((m) => m.datasetSplit === "HOLDOUT").length,
    },
  };
}
