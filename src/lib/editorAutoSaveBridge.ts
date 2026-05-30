/** 作品一覧へ戻る直前にエディタ側の自動保存を走らせるためのブリッジ */

let flushAutoSave: (() => Promise<void>) | null = null;

export function registerEditorAutoSaveFlush(
  fn: (() => Promise<void>) | null
): void {
  flushAutoSave = fn;
}

export async function flushEditorAutoSaveBeforeLeave(): Promise<void> {
  if (!flushAutoSave) return;
  await flushAutoSave();
}
