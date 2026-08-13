import type { SongGroundTruth } from "../types/EvaluationTypes";

export type ValidationIssue = { field: string; message: string };

export function validateGroundTruth(
  truth: SongGroundTruth,
  duration: number
): { ok: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!truth.songId) issues.push({ field: "songId", message: "missing" });
  if (!truth.annotationVersion) issues.push({ field: "annotationVersion", message: "missing" });
  for (const cue of truth.cues) {
    if (cue.time < -1e-6 || cue.time > duration + 1e-6) {
      issues.push({ field: "cues.time", message: `out of range ${cue.time}` });
    }
    if (cue.importance < 0 || cue.importance > 100) {
      issues.push({ field: "cues.importance", message: "must be 0-100" });
    }
  }
  for (const section of truth.sections) {
    if (section.endTime < section.startTime) {
      issues.push({ field: "sections", message: "end before start" });
    }
  }
  for (const f of truth.formations) {
    if (f.score < 0 || f.score > 100) issues.push({ field: "formations.score", message: "0-100" });
  }
  return { ok: issues.length === 0, issues };
}

export function parseAnnotationJson(raw: unknown): SongGroundTruth {
  const obj = raw as {
    songId?: string;
    annotationVersion?: string;
    annotations?: Partial<SongGroundTruth>;
    sections?: SongGroundTruth["sections"];
    cues?: SongGroundTruth["cues"];
    formations?: SongGroundTruth["formations"];
    sequence?: SongGroundTruth["sequence"];
  };
  const nested = obj.annotations ?? obj;
  return {
    songId: obj.songId ?? "unknown",
    annotationVersion: obj.annotationVersion ?? nested.annotationVersion ?? "1.0.0",
    sections: nested.sections ?? obj.sections ?? [],
    cues: nested.cues ?? obj.cues ?? [],
    formations: nested.formations ?? obj.formations ?? [],
    sequence: nested.sequence ?? obj.sequence ?? [],
  };
}
