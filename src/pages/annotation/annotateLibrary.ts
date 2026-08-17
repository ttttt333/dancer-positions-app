import { importAnnotationJson } from "../../lib/choreocore/engine/annotation";
import type { AnnotationSession } from "../../lib/choreocore/engine/types/AnnotationTypes";
import { writeLocalJson } from "./sessionHistory";

export const SAVES_INDEX_KEY = "choreocore-blind-saves";

export type SavedAnnotationMeta = {
  id: string;
  title: string;
  annotatorId: string;
  songId: string;
  savedAt: string;
  cueCount: number;
};

export function saveRecordKey(id: string): string {
  return `choreocore-blind-save:${id}`;
}

function newSaveId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `save-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export function listSavedAnnotations(): SavedAnnotationMeta[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVES_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is SavedAnnotationMeta => Boolean(row && typeof row === "object" && typeof (row as SavedAnnotationMeta).id === "string"))
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  } catch {
    return [];
  }
}

function writeIndex(rows: SavedAnnotationMeta[]): boolean {
  return writeLocalJson(SAVES_INDEX_KEY, rows);
}

export function saveAnnotation(session: AnnotationSession, title: string, id?: string): SavedAnnotationMeta | null {
  const nextId = id?.trim() || newSaveId();
  const meta: SavedAnnotationMeta = {
    id: nextId,
    title: title.trim() || `${session.songId} (${session.cues.length}キュー)`,
    annotatorId: session.annotatorId,
    songId: session.songId,
    savedAt: new Date().toISOString(),
    cueCount: session.cues.length,
  };
  if (!writeLocalJson(saveRecordKey(nextId), session)) return null;
  const others = listSavedAnnotations().filter((row) => row.id !== nextId);
  if (!writeIndex([meta, ...others])) return null;
  return meta;
}

export function loadSavedAnnotation(id: string): AnnotationSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(saveRecordKey(id));
    if (!raw) return null;
    return importAnnotationJson(raw);
  } catch {
    return null;
  }
}

export function deleteSavedAnnotation(id: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(saveRecordKey(id));
  } catch {
    /* ignore */
  }
  writeIndex(listSavedAnnotations().filter((row) => row.id !== id));
}

export function parseAnnotationFile(raw: string): AnnotationSession {
  return importAnnotationJson(raw);
}
