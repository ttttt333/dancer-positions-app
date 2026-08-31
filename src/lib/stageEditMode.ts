export type StageEditMode = "none" | "dancer" | "group" | "formation";

/**
 * FORMATION EDIT = フォーメーションにいる全員の id が選択されている。
 * 人数一致だけでは判定しない（同じ人数でも別メンバーなら GROUP のまま）。
 * 1人フォーメーションは DANCER EDIT のまま。
 */
export function isFormationEditSelection(
  selectedIds: readonly string[],
  formationDancerIds: readonly string[]
): boolean {
  if (formationDancerIds.length < 2) return false;
  const selected = new Set(selectedIds);
  for (const id of formationDancerIds) {
    if (!selected.has(id)) return false;
  }
  return true;
}

/**
 * フォーメーション切替時、新しい Formation にまだいる人だけ選択を残す。
 * clone は dancer id を維持するので、FORMATION EDIT のまま次キューへ入れる。
 */
export function retainDancerIdsInFormation(
  selectedIds: readonly string[],
  formationDancerIds: readonly string[]
): string[] {
  if (selectedIds.length === 0) return [];
  const live = new Set(formationDancerIds);
  return selectedIds.filter((id) => live.has(id));
}

export function resolveStageEditMode(
  selectedIds: readonly string[],
  formationDancerIds: readonly string[]
): StageEditMode {
  if (isFormationEditSelection(selectedIds, formationDancerIds)) {
    return "formation";
  }
  if (selectedIds.length >= 2) return "group";
  if (selectedIds.length === 1) return "dancer";
  return "none";
}
