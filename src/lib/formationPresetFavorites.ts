import type { LayoutPresetId } from "./formationLayouts";

export const FORMATION_PRESET_FAVORITES_STORAGE_KEY =
  "choreogrid_formation_preset_favorites_v1";

/** 同一タブでお気に入り変更を購読するときのイベント名 */
export const FORMATION_PRESET_FAVORITES_CHANGE_EVENT =
  "formationPresetFavorites:changed";

export type FormationPresetFavoritesState = {
  ids: LayoutPresetId[];
  /** 端末間 LWW 用。未保存の旧データは 0 扱い */
  updatedAt?: number;
};

function isLayoutPresetId(id: unknown): id is LayoutPresetId {
  return typeof id === "string" && id.length > 0;
}

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(FORMATION_PRESET_FAVORITES_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function loadFormationPresetFavoritesState(): FormationPresetFavoritesState {
  if (typeof localStorage === "undefined") return { ids: [], updatedAt: 0 };
  try {
    const raw = localStorage.getItem(FORMATION_PRESET_FAVORITES_STORAGE_KEY);
    if (!raw) return { ids: [], updatedAt: 0 };
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { ids: parsed.filter(isLayoutPresetId), updatedAt: 0 };
    }
    if (parsed && typeof parsed === "object") {
      const o = parsed as FormationPresetFavoritesState;
      const ids = Array.isArray(o.ids) ? o.ids.filter(isLayoutPresetId) : [];
      const updatedAt =
        typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
          ? o.updatedAt
          : 0;
      return { ids, updatedAt };
    }
  } catch {
    /* ignore corrupt */
  }
  return { ids: [], updatedAt: 0 };
}

export function loadFormationPresetFavoriteIds(): LayoutPresetId[] {
  return loadFormationPresetFavoritesState().ids;
}

export function saveFormationPresetFavoriteIds(
  ids: LayoutPresetId[],
  updatedAt: number = Date.now()
): void {
  if (typeof localStorage === "undefined") return;
  const unique = [...new Set(ids.filter(isLayoutPresetId))];
  localStorage.setItem(
    FORMATION_PRESET_FAVORITES_STORAGE_KEY,
    JSON.stringify({
      ids: unique,
      updatedAt,
    } satisfies FormationPresetFavoritesState)
  );
  notifyChanged();
}

/**
 * クラウド／他端末のお気に入りとマージ。
 * `updatedAt` が新しい方の一覧を採用（LWW）。同値なら union。
 */
export function mergeFormationPresetFavorites(incoming: {
  ids: unknown;
  updatedAt?: unknown;
}): { changed: boolean; ids: LayoutPresetId[] } {
  const remoteIds = Array.isArray(incoming.ids)
    ? incoming.ids.filter(isLayoutPresetId)
    : [];
  const remoteUpdatedAt =
    typeof incoming.updatedAt === "number" && Number.isFinite(incoming.updatedAt)
      ? incoming.updatedAt
      : 0;
  const local = loadFormationPresetFavoritesState();
  const localUpdatedAt = local.updatedAt ?? 0;

  let nextIds: LayoutPresetId[];
  let nextUpdatedAt: number;
  if (remoteUpdatedAt > localUpdatedAt) {
    nextIds = remoteIds;
    nextUpdatedAt = remoteUpdatedAt;
  } else if (remoteUpdatedAt < localUpdatedAt) {
    nextIds = local.ids;
    nextUpdatedAt = localUpdatedAt;
  } else {
    nextIds = [...new Set([...local.ids, ...remoteIds])];
    nextUpdatedAt = localUpdatedAt;
  }

  const same =
    nextIds.length === local.ids.length &&
    nextIds.every((id) => local.ids.includes(id)) &&
    nextUpdatedAt === localUpdatedAt;
  if (same) {
    return { changed: false, ids: local.ids };
  }
  saveFormationPresetFavoriteIds(nextIds, nextUpdatedAt);
  return { changed: true, ids: nextIds };
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
