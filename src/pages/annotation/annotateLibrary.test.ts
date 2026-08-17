import { describe, expect, it, vi } from "vitest";
import type { AnnotationSession } from "../../lib/choreocore/engine/types/AnnotationTypes";
import {
  SAVES_INDEX_KEY,
  deleteSavedAnnotation,
  listSavedAnnotations,
  loadSavedAnnotation,
  saveAnnotation,
  saveRecordKey,
} from "./annotateLibrary";

function sess(songId: string, cues = 1): AnnotationSession {
  return {
    id: `ann-${songId}`,
    songId,
    annotatorId: "choreographer-a",
    mode: "BLIND",
    version: "2.0.0",
    duration: 210,
    cues: Array.from({ length: cues }, (_, i) => ({ songId, annotatorId: "choreographer-a", time: i, action: "HOLD", magnitude: "NONE", importance: 50, confidence: 90 })),
    sections: [],
    formations: [],
    sequence: [],
  } as AnnotationSession;
}

describe("annotateLibrary", () => {
  it("saves, lists, loads, and deletes a named session", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() {
        return store.size;
      },
      key(index: number) {
        return [...store.keys()][index] ?? null;
      },
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    } satisfies Storage);

    const meta = saveAnnotation(sess("real-001", 3), "1回目");
    expect(meta?.title).toBe("1回目");
    expect(meta?.cueCount).toBe(3);
    expect(listSavedAnnotations()).toHaveLength(1);
    expect(store.has(saveRecordKey(meta!.id))).toBe(true);
    expect(store.has(SAVES_INDEX_KEY)).toBe(true);

    const loaded = loadSavedAnnotation(meta!.id);
    expect(loaded?.songId).toBe("real-001");
    expect(loaded?.cues).toHaveLength(3);

    deleteSavedAnnotation(meta!.id);
    expect(listSavedAnnotations()).toHaveLength(0);
    expect(loadSavedAnnotation(meta!.id)).toBeNull();
  });
});
