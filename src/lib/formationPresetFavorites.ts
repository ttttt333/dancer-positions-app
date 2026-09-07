import type { LayoutPresetId } from "./formationLayouts";

export const FORMATION_PRESET_FAVORITES_STORAGE_KEY =
  "choreogrid_formation_preset_favorites_v1";

export type FormationPresetFavoritesState = {
  ids: LayoutPresetId[];
};

function isLayoutPresetId(id: unknown): id is LayoutPresetId {
  return typeof id === "string" && id.length > 0;
}

export function loadFormationPresetFavoriteIds(): LayoutPresetId[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FORMATION_PRESET_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter(isLayoutPresetId);
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as FormationPresetFavoritesState).ids)
    ) {
      return (parsed as FormationPresetFavoritesState).ids.filter(isLayoutPresetId);
    }
  } catch {
    /* ignore corrupt */
  }
  return [];
}

export function saveFormationPresetFavoriteIds(ids: LayoutPresetId[]): void {
  if (typeof localStorage === "undefined") return;
  const unique = [...new Set(ids.filter(isLayoutPresetId))];
  localStorage.setItem(
    FORMATION_PRESET_FAVORITES_STORAGE_KEY,
    JSON.stringify({ ids: unique } satisfies FormationPresetFavoritesState)
  );
}

export function toggleFormationPresetFavoriteId(
  ids: LayoutPresetId[],
  id: LayoutPresetId
): LayoutPresetId[] {
  const set = new Set(ids);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set];
}

/** お気に入りのみ表示時にカテゴリ items を絞る */
export function filterPresetItemsByFavorites<
  T extends { label: string; items: { id: LayoutPresetId }[] },
>(categories: T[], favoriteIds: ReadonlySet<string>, favoritesOnly: boolean): T[] {
  if (!favoritesOnly) return categories;
  return categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => favoriteIds.has(item.id)),
    }))
    .filter((cat) => cat.items.length > 0) as T[];
}

/** ids 配列カテゴリ用 */
export function filterPresetIdsByFavorites<
  T extends { label: string; ids: LayoutPresetId[] },
>(categories: T[], favoriteIds: ReadonlySet<string>, favoritesOnly: boolean): T[] {
  if (!favoritesOnly) return categories;
  return categories
    .map((cat) => ({
      ...cat,
      ids: cat.ids.filter((id) => favoriteIds.has(id)),
    }))
    .filter((cat) => cat.ids.length > 0) as T[];
}
