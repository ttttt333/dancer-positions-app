import { waveVisibleSpanSec } from "./timelineWaveGeometry";

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

/** 再生ヘッド追従時の端スクロール速度係数（1 = 既定） */
export const WAVE_EDGE_SCROLL_PAN_STRENGTH = 1;

/** キュー枠の移動・リサイズ時は端スクロールをゆっくりにする */
export const CUE_DRAG_EDGE_SCROLL_PAN_STRENGTH = 0.22;

function edgeScrollPanFraction(depth: number, panStrength: number): number {
  return (0.016 + 0.065 * depth) * panStrength;
}

/** ズーム中に clientX が端ゾーンなら viewStart のパン量（変化なしは null） */
export function panWaveViewStartAtClientX(params: {
  clientX: number;
  canvasRect: DOMRect;
  viewStart: number;
  viewSpan: number;
  durationSec: number;
  viewPortion: number;
  /** 既定 1。キュー枠ドラッグ時は `CUE_DRAG_EDGE_SCROLL_PAN_STRENGTH` を渡す */
  panStrength?: number;
}): number | null {
  const {
    clientX,
    canvasRect,
    viewStart,
    viewSpan,
    durationSec,
    viewPortion,
    panStrength = WAVE_EDGE_SCROLL_PAN_STRENGTH,
  } = params;
  if (viewPortion >= 1 - 1e-9 || durationSec <= 0 || viewSpan <= 0) return null;
  const zone = Math.max(
    WAVE_EDGE_SCROLL_ZONE_MIN_PX,
    canvasRect.width * WAVE_EDGE_SCROLL_ZONE_RATIO
  );
  let next = viewStart;
  if (clientX <= canvasRect.left + zone) {
    const depth = 1 - Math.max(0, (clientX - canvasRect.left) / zone);
    next = clampWaveViewStart(
      viewStart - viewSpan * edgeScrollPanFraction(depth, panStrength),
      viewSpan,
      durationSec
    );
  } else if (clientX >= canvasRect.right - zone) {
    const depth = 1 - Math.max(0, (canvasRect.right - clientX) / zone);
    next = clampWaveViewStart(
      viewStart + viewSpan * edgeScrollPanFraction(depth, panStrength),
      viewSpan,
      durationSec
    );
  } else {
    return null;
  }
  return next === viewStart ? null : next;
}

/** 再生ヘッド追従時の水平位置（`getWaveViewForDraw` と揃える） */
const WAVE_PLAYHEAD_VIEW_FRAC = 0.11;

/**
 * ズーム中に再生バーをドラッグしたとき、スクラブ位置が窓内に収まるよう viewStart を更新する。
 */
export function panWaveViewStartToFollowScrubTime(params: {
  scrubTimeSec: number;
  durationSec: number;
  viewPortion: number;
}): number | null {
  const { scrubTimeSec, durationSec, viewPortion } = params;
  if (viewPortion >= 1 - 1e-9 || durationSec <= 0 || !Number.isFinite(scrubTimeSec)) {
    return null;
  }
  const span = waveVisibleSpanSec(durationSec, viewPortion);
  return clampWaveViewStart(
    scrubTimeSec - WAVE_PLAYHEAD_VIEW_FRAC * span,
    span,
    durationSec
  );
}
