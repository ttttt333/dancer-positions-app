/** 端付近ドラッグで波形ビューを横スクロールするゾーン */
export const WAVE_EDGE_SCROLL_ZONE_MIN_PX = 32;
export const WAVE_EDGE_SCROLL_ZONE_RATIO = 0.14;

export function clampWaveViewStart(
  start: number,
  span: number,
  durationSec: number
): number {
  if (durationSec <= 0) return 0;
  return Math.max(0, Math.min(Math.max(0, durationSec - span), start));
}

/** ズーム中に clientX が端ゾーンなら viewStart のパン量（変化なしは null） */
export function panWaveViewStartAtClientX(params: {
  clientX: number;
  canvasRect: DOMRect;
  viewStart: number;
  viewSpan: number;
  durationSec: number;
  viewPortion: number;
}): number | null {
  const { clientX, canvasRect, viewStart, viewSpan, durationSec, viewPortion } =
    params;
  if (viewPortion >= 1 - 1e-9 || durationSec <= 0 || viewSpan <= 0) return null;
  const zone = Math.max(
    WAVE_EDGE_SCROLL_ZONE_MIN_PX,
    canvasRect.width * WAVE_EDGE_SCROLL_ZONE_RATIO
  );
  let next = viewStart;
  if (clientX <= canvasRect.left + zone) {
    const depth = 1 - Math.max(0, (clientX - canvasRect.left) / zone);
    next = clampWaveViewStart(
      viewStart - viewSpan * (0.016 + 0.065 * depth),
      viewSpan,
      durationSec
    );
  } else if (clientX >= canvasRect.right - zone) {
    const depth = 1 - Math.max(0, (canvasRect.right - clientX) / zone);
    next = clampWaveViewStart(
      viewStart + viewSpan * (0.016 + 0.065 * depth),
      viewSpan,
      durationSec
    );
  } else {
    return null;
  }
  return next === viewStart ? null : next;
}
