/** 1 フォーメーションあたりのダンサー人数（下限） */
export const MIN_DANCERS_PER_FORMATION = 1;

/** 1 フォーメーションあたりのダンサー人数（上限） */
export const MAX_DANCERS_PER_FORMATION = 100;

/** 人数クイック選択用の候補（上限を超えないものだけ使う） */
export const DANCER_COUNT_QUICK_PICKS = [
  8, 12, 16, 24, 32, 48, 64, 80, 100,
] as const;

export function clampDancerCount(n: number): number {
  if (!Number.isFinite(n)) return MIN_DANCERS_PER_FORMATION;
  return Math.max(
    MIN_DANCERS_PER_FORMATION,
    Math.min(MAX_DANCERS_PER_FORMATION, Math.floor(n))
  );
}
