/**
 * ダンサー選択まわりの純粋ロジック（ポインター・キーボード UI から分離）。
 */

/** Shift/Cmd/Ctrl クリック時の 1 人トグル */
export function toggleDancerAdditiveSelection(
  selected: readonly string[],
  dancerId: string,
): string[] {
  return (selected ?? []).includes(dancerId)
    ? (selected ?? []).filter((id) => id !== dancerId)
    : [...(selected ?? []), dancerId];
}

/** 通常クリックで「この 1 人だけ」選択 */
export function replaceSelectionWithSingle(dancerId: string): string[] {
  return [dancerId];
}

/**
 * 重なったマーカー列（手前から奥）で Alt+クリック時に次に手前へ回す。
 * @param stackUniqueOrdered `elementsFromPoint` 等で得た手前→奥の一意 id 列
 */
export function pickNextDancerInStack(
  stackUniqueOrdered: readonly string[],
  currentId: string,
): string | null {
  const n = stackUniqueOrdered.length;
  if (n <= 1) return null;
  const i = stackUniqueOrdered.indexOf(currentId);
  /** `indexOf === -1` のときも次は先頭（元 Stage の Alt+スタック挙動に合わせる） */
  const nextIndex = (i + 1 + n) % n;
  return stackUniqueOrdered[nextIndex] ?? null;
}

export function removeDancerFromSelection(
  selected: readonly string[],
  dancerId: string,
): string[] {
  return selected.filter((id) => id !== dancerId);
}

export function removeDancersFromSelection(
  selected: readonly string[],
  remove: ReadonlySet<string>,
): string[] {
  return selected.filter((id) => !remove.has(id));
}
