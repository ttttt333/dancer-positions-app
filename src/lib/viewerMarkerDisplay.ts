/** 閲覧共有ステージ上のダンサー印の表示倍率（従来比 2/3） */
export const PUBLIC_VIEWER_MARKER_DISPLAY_SCALE = 2 / 3;

export const VIEWER_MARKER_SCALE_MIN = 0.4;
export const VIEWER_MARKER_SCALE_MAX = 1.2;
export const VIEWER_NAME_SCALE_MIN = 0.45;
export const VIEWER_NAME_SCALE_MAX = 1.35;
export const VIEWER_NAME_AUTO_FIT_MIN = 0.42;

export function clampViewerMarkerScale(v: number): number {
  if (!Number.isFinite(v)) return PUBLIC_VIEWER_MARKER_DISPLAY_SCALE;
  return Math.min(
    VIEWER_MARKER_SCALE_MAX,
    Math.max(VIEWER_MARKER_SCALE_MIN, Math.round(v * 100) / 100)
  );
}

export function clampViewerNameScale(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(
    VIEWER_NAME_SCALE_MAX,
    Math.max(VIEWER_NAME_SCALE_MIN, Math.round(v * 100) / 100)
  );
}

/** 印サイズの段階（−/+ ボタン用） */
export const VIEWER_MARKER_SCALE_STEPS = [
  0.45, 0.55, 0.67, 0.8, 0.95, 1.1,
] as const;

/** 名前サイズの段階 */
export const VIEWER_NAME_SCALE_STEPS = [
  0.5, 0.65, 0.8, 1, 1.15, 1.3,
] as const;

export function stepViewerScale(
  current: number,
  steps: readonly number[],
  direction: -1 | 1
): number {
  const sorted = [...steps].sort((a, b) => a - b);
  if (direction > 0) {
    for (const s of sorted) {
      if (s > current + 0.02) return s;
    }
    return sorted[sorted.length - 1]!;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const s = sorted[i]!;
    if (s < current - 0.02) return s;
  }
  return sorted[0]!;
}
