/**
 * Load Phase 4.6 GT from ChoreoCoreDatasets.
 * Doubles: prefer consensus.json; singles: annotator-a.json.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { RealSongAnnotation, RealSongManifest } from "./types";
import {
  FLY_ANNOTATION_CONTRACT_VERSION,
  FLY_REAL_SONG_DATASET_VERSION,
  FLY_REAL_SONG_PROVENANCE_VERSION,
} from "./versions";

export const DEFAULT_REAL_SONG_ROOT = join(
  homedir(),
  "ChoreoCoreDatasets",
  "fly-real-song"
);

export type CatalogSong = {
  id: string;
  songId: string;
  title: string;
  artist?: string;
  audioSha256: string;
  durationSec: number;
  doubleAnnotation?: boolean;
  analysisWav?: string;
  sourceType?: string;
};

export type LoadedGt = {
  songId: string;
  catalogId: string;
  title: string;
  durationSec: number;
  audioSha256: string;
  analysisWavPath: string | null;
  gtSource: "consensus" | "annotator-a";
  annotation: RealSongAnnotation;
  consensusReason: string | null;
  doubleAnnotate: boolean;
};

export function resolveRealSongRoot(override?: string): string {
  return override ?? process.env.FLY_REAL_SONG_ROOT ?? DEFAULT_REAL_SONG_ROOT;
}

export function loadCatalog(root?: string): {
  version: string;
  songs: CatalogSong[];
} {
  const base = resolveRealSongRoot(root);
  const raw = JSON.parse(readFileSync(join(base, "catalog.json"), "utf8")) as {
    version?: string;
    songs: CatalogSong[];
  };
  return { version: raw.version ?? "unknown", songs: raw.songs };
}

function readAnnotation(path: string): RealSongAnnotation {
  return JSON.parse(readFileSync(path, "utf8")) as RealSongAnnotation;
}

/** Prefer consensus for doubles; else annotator-a. */
export function loadGroundTruthForSong(
  song: CatalogSong,
  root?: string
): LoadedGt {
  const base = resolveRealSongRoot(root);
  const annDir = join(base, "annotations", song.songId);
  const consensusPath = join(annDir, "consensus.json");
  const aPath = join(annDir, "annotator-a.json");

  let gtSource: "consensus" | "annotator-a";
  let path: string;
  if (existsSync(consensusPath)) {
    gtSource = "consensus";
    path = consensusPath;
  } else if (existsSync(aPath)) {
    gtSource = "annotator-a";
    path = aPath;
  } else {
    throw new Error(`No GT for ${song.songId} under ${annDir}`);
  }

  const annotation = readAnnotation(path);
  const consensusReason =
    gtSource === "consensus"
      ? String(
          (annotation as RealSongAnnotation & { consensus_reason?: string })
            .consensus_reason ?? ""
        ) || null
      : null;

  const wavRel = song.analysisWav ?? `analysis/${song.id}.wav`;
  const wavPath = join(base, wavRel);
  return {
    songId: song.songId,
    catalogId: song.id,
    title: song.title,
    durationSec: song.durationSec,
    audioSha256: song.audioSha256,
    analysisWavPath: existsSync(wavPath) ? wavPath : null,
    gtSource,
    annotation,
    consensusReason,
    doubleAnnotate: Boolean(song.doubleAnnotation),
  };
}

export function loadAllGroundTruth(root?: string): LoadedGt[] {
  const { songs } = loadCatalog(root);
  return songs.map((s) => loadGroundTruthForSong(s, root));
}

/** Minimal manifest for bridge.ts from catalog + annotation. */
export function loadedGtToManifest(gt: LoadedGt): RealSongManifest {
  return {
    songId: gt.songId,
    title: gt.title,
    audioSha256: gt.audioSha256,
    sourceType: "AUTHORIZED_DATASET",
    durationSec: gt.durationSec,
    conditions: {
      genre: ["unknown"],
      tempoClass: "MEDIUM",
      beatDensity: "MEDIUM",
      structureComplexity: "MEDIUM",
      vocal: "VOCAL",
      version: "ORIGINAL",
    },
    annotationVersion: FLY_ANNOTATION_CONTRACT_VERSION,
    annotators:
      gt.gtSource === "consensus"
        ? ["consensus"]
        : [gt.annotation.annotatorId],
    status: gt.gtSource === "consensus" ? "ADJUDICATED" : "ANNOTATED",
    datasetSplit: "DEVELOPMENT",
    realSongDatasetVersion: FLY_REAL_SONG_DATASET_VERSION,
    provenanceVersion: FLY_REAL_SONG_PROVENANCE_VERSION,
    selectionIntent: "stage-a golden 20",
    doubleAnnotate: gt.doubleAnnotate,
  };
}

export function listHypothesisFiles(
  songId: string,
  root?: string
): string[] {
  const dir = join(resolveRealSongRoot(root), "hypotheses", songId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(dir, f));
}
