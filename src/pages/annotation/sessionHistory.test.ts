import { describe, expect, it } from "vitest";
import type { AnnotationSession } from "../../lib/choreocore/engine/types/AnnotationTypes";
import {
  MAX_SESSION_HISTORY,
  canRedo,
  canUndo,
  currentSnapshot,
  emptyHistory,
  parseStoredHistory,
  pushSnapshot,
  redoAll,
  redoStep,
  undoAll,
  undoStep,
} from "./sessionHistory";

function sess(n: number): AnnotationSession {
  return { id: `s${n}`, notes: String(n) } as AnnotationSession;
}

describe("sessionHistory", () => {
  it("keeps the origin so undo-all can restore the first snapshot", () => {
    let last = 0;
    let h = emptyHistory(sess(0));
    for (let i = 1; i <= 5; i++) {
      const pushed = pushSnapshot(h, sess(i), i * 1000, last);
      h = pushed.history;
      last = pushed.lastPushAt;
    }
    expect(h.stack).toHaveLength(6);
    expect(h.index).toBe(5);
    h = undoAll(h);
    expect(currentSnapshot(h)?.id).toBe("s0");
    h = redoAll(h);
    expect(currentSnapshot(h)?.id).toBe("s5");
  });

  it("undo and redo walk one step at a time", () => {
    let last = 0;
    let h = emptyHistory(sess(0));
    const a = pushSnapshot(h, sess(1), 1000, last);
    h = a.history;
    last = a.lastPushAt;
    const b = pushSnapshot(h, sess(2), 2000, last);
    h = b.history;
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
    h = undoStep(h);
    expect(currentSnapshot(h)?.id).toBe("s1");
    expect(canRedo(h)).toBe(true);
    h = redoStep(h);
    expect(currentSnapshot(h)?.id).toBe("s2");
  });

  it("coalesces rapid edits into one step but keeps the origin", () => {
    let h = emptyHistory(sess(0));
    const first = pushSnapshot(h, sess(1), 1000, 0, 400);
    h = first.history;
    const second = pushSnapshot(h, sess(2), 1100, first.lastPushAt, 400);
    h = second.history;
    expect(h.stack).toHaveLength(2);
    expect(currentSnapshot(h)?.id).toBe("s2");
    h = undoStep(h);
    expect(currentSnapshot(h)?.id).toBe("s0");
  });

  it("drops redo future after a new edit", () => {
    let last = 0;
    let h = emptyHistory(sess(0));
    for (const n of [1, 2, 3]) {
      const pushed = pushSnapshot(h, sess(n), n * 1000, last);
      h = pushed.history;
      last = pushed.lastPushAt;
    }
    h = undoStep(undoStep(h));
    const pushed = pushSnapshot(h, sess(9), 9000, last);
    h = pushed.history;
    expect(h.stack.map((s) => s.id)).toEqual(["s0", "s1", "s9"]);
    expect(canRedo(h)).toBe(false);
  });

  it("caps the stack and still allows undo-all to the oldest kept snapshot", () => {
    let last = 0;
    let h = emptyHistory(sess(0));
    for (let i = 1; i <= MAX_SESSION_HISTORY + 5; i++) {
      const pushed = pushSnapshot(h, sess(i), i * 1000, last);
      h = pushed.history;
      last = pushed.lastPushAt;
    }
    expect(h.stack.length).toBe(MAX_SESSION_HISTORY);
    h = undoAll(h);
    expect(currentSnapshot(h)?.id).toBe(`s${6}`);
  });

  it("restores stored history when the draft matches the tip", () => {
    const h = emptyHistory(sess(0));
    const pushed = pushSnapshot(h, sess(1), 1000, 0);
    const restored = parseStoredHistory(JSON.stringify(pushed.history), sess(1));
    expect(restored.index).toBe(1);
    expect(restored.stack).toHaveLength(2);
  });

  it("appends the current draft when it drifted from stored history", () => {
    const h = emptyHistory(sess(0));
    const pushed = pushSnapshot(h, sess(1), 1000, 0);
    const restored = parseStoredHistory(JSON.stringify(pushed.history), sess(2));
    expect(restored.stack.map((s) => s.id)).toEqual(["s0", "s1", "s2"]);
    expect(restored.index).toBe(2);
  });
});
