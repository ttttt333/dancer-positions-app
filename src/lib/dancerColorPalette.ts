/**
 * ダンサー印・名簿・3D などで共有する色。
 * 既存データの colorIndex はそのまま有効（長さが増えた分だけ選択肢が増える）。
 */
export const DANCER_COLOR_PALETTE_HEX = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#2dd4bf",
  "#e879f9",
  "#f8fafc",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#06b6d4",
  "#8b5cf6",
  "#84cc16",
  "#f97316",
  "#ec4899",
] as const;

export type DancerPaletteHex = (typeof DANCER_COLOR_PALETTE_HEX)[number];

export const DANCER_COLOR_COUNT = DANCER_COLOR_PALETTE_HEX.length;

export function modDancerColorIndex(i: number): number {
  const n = Math.floor(Number(i));
  if (!Number.isFinite(n)) return 0;
  const m = DANCER_COLOR_COUNT;
  return ((n % m) + m) % m;
}

/** three.js 用 0xRRGGBB */
export const DANCER_COLOR_PALETTE_THREE: readonly number[] =
  DANCER_COLOR_PALETTE_HEX.map((h) => Number.parseInt(h.slice(1), 16));

/** 印の向き（度）。0〜359 に正規化。 */
export function normalizeDancerFacingDeg(n: number): number {
  const r = Math.round(Number(n));
  if (!Number.isFinite(r)) return 0;
  return ((r % 360) + 360) % 360;
}
