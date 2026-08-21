import { describe, expect, it, vi } from "vitest";
import type { AnnotationSession } from "../../lib/choreocore/engine/types/AnnotationTypes";
import {
  SAVES_INDEX_KEY,
  adoptAnnotationSession,
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
    bpm: 96,
    startedAt: "2026-08-14T00:00:00.000Z",
    completedAt: "2026-08-14T01:00:00.000Z",
    cues: Array.from({ length: cues }, (_, i) => ({
      id: `cue-${i}`,
      songId,
      annotatorId: "choreographer-a",
      time: i * 8,
      action: "HOLD",
      magnitude: "NONE",
      importance: 50,
      confidence: 90,
    })),
    sections: [
      { songId, annotatorId: "choreographer-a", startTime: 0, endTime: 20, type: "INTRO", confidence: 90 },
      { songId, annotatorId: "choreographer-a", startTime: 20, endTime: 60, type: "VERSE", confidence: 90 },
    ],
    formations: [
      {
        songId,
        cueId: "cue-0",
        annotatorId: "choreographer-a",
        formationType: "LINE",
        score: 90,
        musicFit: 80,
        visualImpact: 80,
        transitionQuality: 80,
        execution: 80,
        originality: 70,
        layout: { dancerCount: 1, positions: [{ id: "d1", xPct: 50, yPct: 50 }] },
      },
    ],
    formationTop3: [{ songId, cueId: "cue-0", annotatorId: "choreographer-a", ranks: [{ formationType: "LINE", score: 90, rank: 1 }], musicFit: 80, visualImpact: 80, transitionQuality: 80, execution: 80, originality: 70, overall: 80 }],
    sequence: [{ songId, annotatorId: "choreographer-a", formationIds: ["LINE"], musicStory: 80, visualStory: 80, execution: 80, variety: 70, overall: 80 }],
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

  it("adopts another choreographer's file without changing song structure", () => {
    const source = sess("real-001", 3);
    const adopted = adoptAnnotationSession(source, "choreographer-b", new Date("2026-08-21T00:00:00.000Z"));

    expect(adopted.annotatorId).toBe("choreographer-b");
    expect(adopted.id).toBe("ann-real-001-b");
    expect(adopted.songId).toBe("real-001");
    expect(adopted.duration).toBe(210);
    expect(adopted.bpm).toBe(96);
    expect(adopted.completedAt).toBeUndefined();
    expect(adopted.startedAt).toBe("2026-08-21T00:00:00.000Z");
    expect(adopted.sections.map((row) => [row.startTime, row.endTime, row.type])).toEqual([
      [0, 20, "INTRO"],
      [20, 60, "VERSE"],
    ]);
    expect(adopted.cues.map((row) => [row.id, row.time])).toEqual([
      ["cue-0", 0],
      ["cue-1", 8],
      ["cue-2", 16],
    ]);
    expect(adopted.formations[0]?.layout?.positions).toEqual([{ id: "d1", xPct: 50, yPct: 50 }]);
    expect(new Set([
      ...adopted.sections.map((row) => row.annotatorId),
      ...adopted.cues.map((row) => row.annotatorId),
      ...adopted.formations.map((row) => row.annotatorId),
      ...(adopted.formationTop3 ?? []).map((row) => row.annotatorId),
      ...adopted.sequence.map((row) => row.annotatorId),
    ])).toEqual(new Set(["choreographer-b"]));
    expect(source.annotatorId).toBe("choreographer-a");
    expect(source.cues[0]?.annotatorId).toBe("choreographer-a");
  });
});
