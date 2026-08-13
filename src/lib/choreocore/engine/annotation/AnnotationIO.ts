import type { AnnotationSession, GroundTruthSet } from "../types/AnnotationTypes";
import { ANNOTATION_WORKFLOW_VERSION } from "../types/AnnotationTypes";
import { createAnnotationSession } from "./AnnotationSession";

export function exportAnnotationJson(session: AnnotationSession): string {
  return JSON.stringify(session, null, 2);
}

export function exportGroundTruthJson(gt: GroundTruthSet): string {
  return JSON.stringify(gt, null, 2);
}

export function importAnnotationSessionsJson(raw: unknown): AnnotationSession[] {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (Array.isArray(parsed)) return parsed.map((row) => importAnnotationJson(row));
  return [importAnnotationJson(parsed)];
}

export function importAnnotationJson(raw: unknown): AnnotationSession {
  const obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<AnnotationSession>;
  const base = createAnnotationSession({
    songId: obj.songId ?? "unknown",
    annotatorId: obj.annotatorId ?? "unknown",
    duration: obj.duration ?? 1,
    bpm: obj.bpm,
    mode: obj.mode === "AI_ASSISTED" ? "AI_ASSISTED" : "BLIND",
    id: obj.id ?? "imported",
    now: obj.startedAt ? new Date(obj.startedAt) : new Date("2026-08-14T00:00:00.000Z"),
    notes: obj.notes,
  });
  const sequence = Array.isArray(obj.sequence) ? obj.sequence : obj.sequence ? [obj.sequence] : [];
  return {
    ...base,
    version: obj.version ?? ANNOTATION_WORKFLOW_VERSION,
    completedAt: obj.completedAt,
    sections: obj.sections ?? [],
    cues: obj.cues ?? [],
    formations: obj.formations ?? [],
    formationTop3: obj.formationTop3 ?? [],
    sequence,
  };
}
