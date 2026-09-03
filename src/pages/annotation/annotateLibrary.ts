import { importAnnotationJson } from "../../lib/choreocore/engine/annotation";
import type { AnnotationSession } from "../../lib/choreocore/engine/types/AnnotationTypes";
import { annotatorShort, type PilotSongCard } from "./pilotCatalog";
import { cloneSession, writeLocalJson } from "./sessionHistory";

export const SAVES_INDEX_KEY = "choreocore-blind-saves";
export const EXTRA_SONGS_KEY = "choreocore-real-songs";

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

/**
 * Copy another choreographer's session onto the current annotator.
 * Song structure (sections, cue times, cue ids) stays; nested annotator ids are rewritten
 * so the copy can be arranged and saved as a separate A/B/C record.
 */
export function adoptAnnotationSession(
  source: AnnotationSession,
  annotatorId: string,
  now = new Date(),
): AnnotationSession {
  const copy = cloneSession(source);
  const songId = copy.songId;
  return {
    ...copy,
    id: `ann-${songId}-${annotatorShort(annotatorId)}`,
    annotatorId,
    startedAt: now.toISOString(),
    completedAt: undefined,
    sections: copy.sections.map((row) => ({ ...row, songId, annotatorId })),
    cues: copy.cues.map((row) => ({ ...row, songId, annotatorId })),
    formations: copy.formations.map((row) => ({ ...row, songId, annotatorId })),
    formationTop3: (copy.formationTop3 ?? []).map((row) => ({ ...row, songId, annotatorId })),
    sequence: copy.sequence.map((row) => ({ ...row, songId, annotatorId })),
  };
}

export function listSavedAnnotationsForSong(songId: string): SavedAnnotationMeta[] {
  return listSavedAnnotations().filter((row) => row.songId === songId);
}

export function listExtraSongs(): PilotSongCard[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(EXTRA_SONGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is PilotSongCard =>
        Boolean(row && typeof row === "object" && typeof (row as PilotSongCard).id === "string")
    );
  } catch {
    return [];
  }
}

export function upsertExtraSong(song: PilotSongCard): PilotSongCard[] {
  const others = listExtraSongs().filter((row) => row.id !== song.id);
  const next = [song, ...others];
  writeLocalJson(EXTRA_SONGS_KEY, next);
  return next;
}
