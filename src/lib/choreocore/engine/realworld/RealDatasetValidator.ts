import type { SongDifficulty } from "../types/EvaluationTypes";
import type { RealSongAnnotations } from "../types/RealWorldTypes";
import {
  REAL_SONG_CATEGORIES,
  SONG_DIFFICULTIES,
  type BpmBucket,
  type RealWorldDataset,
  type RealWorldDatasetItem,
  type RealSongMetadata,
} from "../types/RealWorldTypes";
import { validateGroundTruth } from "../evaluation/GroundTruthValidator";

export type DatasetIssue = { field: string; message: string; songId?: string };

export class RealWorldDatasetError extends Error {
  readonly issues: DatasetIssue[];
  constructor(issues: DatasetIssue[]) {
    super(issues[0]?.message ?? "Invalid real-world dataset");
    this.name = "RealWorldDatasetError";
    this.issues = issues;
  }
}

export function bpmBucket(bpm?: number): BpmBucket | undefined {
  if (bpm === undefined || !Number.isFinite(bpm) || bpm <= 0) return undefined;
  if (bpm < 90) return "60-90";
  if (bpm < 120) return "90-120";
  if (bpm < 150) return "120-150";
  return "150+";
}

export function validateRealSongMetadata(song: RealSongMetadata): DatasetIssue[] {
  const issues: DatasetIssue[] = [];
  if (!song.id) issues.push({ field: "id", message: "missing song id", songId: song.id });
  if (!song.title) issues.push({ field: "title", message: "missing title", songId: song.id });
  if (!Number.isFinite(song.duration) || song.duration <= 0) {
    issues.push({ field: "duration", message: "duration must be > 0", songId: song.id });
  }
  if (!song.audioHash) issues.push({ field: "audioHash", message: "missing audioHash", songId: song.id });
  if (!REAL_SONG_CATEGORIES.includes(song.category)) {
    issues.push({ field: "category", message: `invalid category ${String(song.category)}`, songId: song.id });
  }
  if (!SONG_DIFFICULTIES.includes(song.difficulty as SongDifficulty)) {
    issues.push({ field: "difficulty", message: `invalid difficulty ${String(song.difficulty)}`, songId: song.id });
  }
  if (typeof song.rightsConfirmed !== "boolean") {
    issues.push({ field: "rightsConfirmed", message: "rightsConfirmed required", songId: song.id });
  }
  return issues;
}

export function validateRealWorldDataset(
  dataset: RealWorldDataset,
  annotations: RealSongAnnotations[]
): { ok: boolean; issues: DatasetIssue[]; eligible: RealWorldDatasetItem[] } {
  const issues: DatasetIssue[] = [];
  if (!dataset.annotationVersion) {
    issues.push({ field: "annotationVersion", message: "missing annotationVersion" });
  }
  const seen = new Set<string>();
  for (const item of dataset.items) {
    issues.push(...validateRealSongMetadata(item.song));
    if (seen.has(item.song.id)) {
      issues.push({ field: "id", message: "duplicate song", songId: item.song.id });
    }
    seen.add(item.song.id);
  }
  const eligible = dataset.items.filter((item) => item.song.rightsConfirmed);
  if (dataset.items.length > 0 && eligible.length === 0) {
    issues.push({ field: "rightsConfirmed", message: "no rights-confirmed songs" });
  }
  const bySong = new Map<string, RealSongAnnotations[]>();
  for (const ann of annotations) {
    const list = bySong.get(ann.songId) ?? [];
    list.push(ann);
    bySong.set(ann.songId, list);
  }
  for (const item of eligible) {
    const anns = bySong.get(item.song.id) ?? [];
    if (anns.length === 0) {
      issues.push({ field: "annotations", message: "missing annotation", songId: item.song.id });
      continue;
    }
    for (const ann of anns) {
      const gt = {
        songId: ann.songId,
        annotationVersion: ann.annotationVersion,
        sections: ann.sections,
        cues: ann.cues,
        formations: ann.formations,
        sequence: ann.sequence,
      };
      const check = validateGroundTruth(gt, item.song.duration);
      if (!check.ok) {
        issues.push({
          field: "annotations",
          message: check.issues[0]?.message ?? "invalid annotation",
          songId: item.song.id,
        });
      }
    }
  }
  return { ok: issues.length === 0, issues, eligible };
}

export function assertRealWorldDataset(
  dataset: RealWorldDataset,
  annotations: RealSongAnnotations[]
): RealWorldDatasetItem[] {
  const check = validateRealWorldDataset(dataset, annotations);
  if (!check.ok) throw new RealWorldDatasetError(check.issues);
  return check.eligible;
}
