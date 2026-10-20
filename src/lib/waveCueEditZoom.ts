/**
 * 選択キューを「端を指で掴んで微調整しやすい」倍率・表示開始位置にする。
 * 短いキューほどより拡大する。
 */

export type CueEditZoomInput = {
  durationSec: number;
  cueStartSec: number;
  cueEndSec: number;
  /** 波形キャンバスの CSS 幅（無いときはスマホ想定） */
  canvasCssWidthPx?: number;
  minZoom?: number;
  maxZoom?: number;
};

export type CueEditZoomResult = {
  zoom: number;
  viewStartSec: number;
  /** ビュー中央に置く時刻（再生ヘッド追従時のアンカーにも使える） */
  anchorSec: number;
};

/** 端グリップを掴みやすい最低キュー幅（CSS px） */
const MIN_CUE_EDIT_WIDTH_PX = 168;
/** キューがビュー幅に占める目標割合（短すぎるキューは MIN 幅優先） */
const TARGET_CUE_FILL = 0.42;
/** 表示スパンの下限（極端に短いキューでも余白を確保） */
const MIN_VIEW_SPAN_SEC = 0.85;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 曲長・選択キューから、編集しやすい zoom / viewStart を返す。
 */
export function computeZoomToSelectedCue(input: CueEditZoomInput): CueEditZoomResult {
  const duration = Math.max(0, input.durationSec);
  const minZoom = input.minZoom ?? 1;
  const maxZoom = input.maxZoom ?? 48;
  if (!(duration > 0)) {
    return { zoom: minZoom, viewStartSec: 0, anchorSec: 0 };
  }

  const t0 = Math.min(input.cueStartSec, input.cueEndSec);
  const t1 = Math.max(input.cueStartSec, input.cueEndSec);
  const cueDur = Math.max(0.05, t1 - t0);
  const anchor = (t0 + t1) / 2;
  const canvasW = Math.max(240, input.canvasCssWidthPx ?? 360);

  const spanForFill = cueDur / TARGET_CUE_FILL;
  const spanForMinPx = cueDur * (canvasW / MIN_CUE_EDIT_WIDTH_PX);
  /** より狭いビュー＝より拡大。短いキューほど spanForMinPx が効く */
  let viewSpan = Math.min(spanForFill, spanForMinPx);
  viewSpan = clamp(viewSpan, MIN_VIEW_SPAN_SEC, duration);

  let zoom = duration / viewSpan;
  zoom = clamp(zoom, minZoom, maxZoom);
  viewSpan = duration / zoom;

  const viewStartSec = clamp(anchor - viewSpan / 2, 0, Math.max(0, duration - viewSpan));
  return { zoom, viewStartSec, anchorSec: anchor };
}
