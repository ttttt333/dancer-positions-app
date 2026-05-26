import { describe, expect, it } from "vitest";
import {
  applyRedoPlain,
  applyUndoPlain,
  clearEditorHistoryStacks,
  createEditorHistoryStacks,
  pushEditorHistorySnapshot,
} from "./editorHistoryStack";
import { createEmptyProject } from "../../lib/projectDefaults";

describe("editorHistoryStack", () => {
  it("push clears redo stack", () => {
    const stacks = createEditorHistoryStacks();
    stacks.redo.push("{}");
    pushEditorHistorySnapshot(stacks, '{"version":3}');
    expect(stacks.redo).toHaveLength(0);
    expect(stacks.undo).toHaveLength(1);
  });

  it("undo/redo round-trip restores project title", () => {
    const stacks = createEditorHistoryStacks();
    const a = createEmptyProject();
    a.pieceTitle = "A";
    const b = { ...createEmptyProject(), pieceTitle: "B" };
    pushEditorHistorySnapshot(stacks, JSON.stringify(a));
    const undone = applyUndoPlain(stacks, b);
    expect(undone?.pieceTitle).toBe("A");
    const redone = applyRedoPlain(stacks, undone!);
    expect(redone?.pieceTitle).toBe("B");
  });

  it("clear empties both stacks", () => {
    const stacks = createEditorHistoryStacks();
    pushEditorHistorySnapshot(stacks, "{}");
    stacks.redo.push("{}");
    clearEditorHistoryStacks(stacks);
    expect(stacks.undo).toHaveLength(0);
    expect(stacks.redo).toHaveLength(0);
  });
});
