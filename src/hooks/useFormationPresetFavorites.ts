import { useCallback, useEffect, useMemo, useState } from "react";
import type { LayoutPresetId } from "../lib/formationLayouts";
import {
  FORMATION_PRESET_FAVORITES_STORAGE_KEY,
  loadFormationPresetFavoriteIds,
  saveFormationPresetFavoriteIds,
  toggleFormationPresetFavoriteId,
} from "../lib/formationPresetFavorites";

/**
 * 雛形お気に入り（localStorage 永続）と「お気に入りのみ」表示トグル。
 */
export function useFormationPresetFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<LayoutPresetId[]>(() =>
    loadFormationPresetFavoriteIds()
  );
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== FORMATION_PRESET_FAVORITES_STORAGE_KEY) return;
      setFavoriteIds(loadFormationPresetFavoriteIds());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const favoriteSet = useMemo(() => new Set<string>(favoriteIds), [favoriteIds]);

  const isFavorite = useCallback(
    (id: string) => favoriteSet.has(id),
    [favoriteSet]
  );

  const toggleFavorite = useCallback((id: LayoutPresetId) => {
    setFavoriteIds((prev) => {
      const next = toggleFormationPresetFavoriteId(prev, id);
      saveFormationPresetFavoriteIds(next);
      return next;
    });
  }, []);

  const toggleFavoritesOnly = useCallback(() => {
    setFavoritesOnly((v) => !v);
  }, []);

  return {
    favoriteIds,
    favoriteSet,
    favoriteCount: favoriteIds.length,
    isFavorite,
    toggleFavorite,
    favoritesOnly,
    setFavoritesOnly,
    toggleFavoritesOnly,
  };
}
