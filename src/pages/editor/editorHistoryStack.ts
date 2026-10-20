import type { ChoreographyProjectJson } from "../../types/choreography";
import { normalizeProject } from "../../lib/normalizeProject";
import { HISTORY_CAP } from "./editorConstants";

export type EditorHistoryStacks = {
  undo: string[];
  redo: string[];
};

export function createEditorHistoryStacks(): EditorHistoryStacks {
  return { undo: [], redo: [] };
}

export function clearEditorHistoryStacks(stacks: EditorHistoryStacks): void {
  stacks.undo.length = 0;
  stacks.redo.length = 0;
}

export function pushEditorHistorySnapshot(
  stacks: EditorHistoryStacks,
  snapshotJson: string,
  cap: number = HISTORY_CAP
): void {
  const tail = stacks.undo[stacks.undo.length - 1];
  if (tail === snapshotJson) {
    stacks.redo.length = 0;
    return;
  }
  if (stacks.undo.length >= cap) stacks.undo.shift();
  stacks.undo.push(snapshotJson);
  stacks.redo.length = 0;
  // 大きな作品で 200 件積むとメモリが数百 MB になり動作が重くなるので、合計サイズでも古い順に捨てる
  let total = 0;
  for (const s of stacks.undo) total += s.length;
  while (total > HISTORY_MAX_TOTAL_CHARS && stacks.undo.length > 1) {
    total -= stacks.undo.shift()!.length;
  }
}

/** 戻る履歴の合計文字数の上限（およそ 40MB） */
export const HISTORY_MAX_TOTAL_CHARS = 20_000_000;

export function applyUndoPlain(
  stacks: EditorHistoryStacks,
  current: ChoreographyProjectJson
): ChoreographyProjectJson | null {
  if (stacks.undo.length === 0) return null;
  const prevStr = stacks.undo.pop()!;
  stacks.redo.push(JSON.stringify(current));
  return normalizeProject(JSON.parse(prevStr));
}

export function applyRedoPlain(
  stacks: EditorHistoryStacks,
  current: ChoreographyProjectJson
): ChoreographyProjectJson | null {
  if (stacks.redo.length === 0) return null;
  const nextStr = stacks.redo.pop()!;
  stacks.undo.push(JSON.stringify(current));
  return normalizeProject(JSON.parse(nextStr));
}
