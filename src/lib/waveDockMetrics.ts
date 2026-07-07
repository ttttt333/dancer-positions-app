/** スマホ縦画面波形キャンバス既定高さ（`PortraitWaveTransport` と揃える） */
export const PORTRAIT_WAVE_CANVAS_H_PX = 96;

/** PC 上部ドック: 秒数目盛り行（従来 `calc(16px + 5mm)` の 2/3） */
export const PC_WAVE_RULER_HEIGHT_CSS = "calc((16px + 5mm) * 2 / 3)";

/**
 * 波形ドックの chrome／既定高さ定数のみ。DOM 幅は読まない。
 * キャンバス幅は `useWaveCanvasRenderer` の `getBoundingClientRect` に委ねる。
 */

/** 5mm を 96dpi で換算した px（目盛り chrome 見積もり用） */
export const CSS_MM_TO_PX = 96 / 25.4;

/** 波形キャンバスは CSS 高さの 2 倍のビットマップで描画 */
export const WAVE_CANVAS_BITMAP_TO_CSS = 2;

/** CSS mm を波形ビットマップ座標の px に換算 */
export function waveCanvasBitmapPxFromCssMm(mm: number): number {
  return mm * CSS_MM_TO_PX * WAVE_CANVAS_BITMAP_TO_CSS;
}

/** 目盛り行の px 目安（2/3 縮小後） */
export const PC_WAVE_RULER_CHROME_PX = Math.round(
  ((16 + 5 * CSS_MM_TO_PX) * 2) / 3
);

/** コンパクト再生ツールバー行（minHeight + padding + border + ズームボタン行） */
export const PC_WIDE_TOP_DOCK_TOOLBAR_CHROME_PX = Math.round(30 * 1.2 + 2 * 1.2 + 2);

/** 波形ブロック下端の高さリサイズ枠 */
export const PC_WAVE_BOTTOM_RESIZE_CHROME_PX = 10;

/** 波形枠ボーダー等 */
export const PC_WAVE_FRAME_EXTRA_CHROME_PX = 2;

/** `WaveformStrip` 外枠 border（上下 1px ずつ）— ドック内高さ計算用 */
export const WAVE_STRIP_BORDER_PX = 2;

/** PC 上部ドック: 波形キャンバス下端の収まり余白（px） */
export const WAVE_TOP_DOCK_CANVAS_FIT_MARGIN_PX = 5;

/** PC 上部ドック下端: 波形バーとステージの境目リサイズ枠（タイムライン内側の外） */
export const TOP_DOCK_WAVE_STAGE_RESIZER_PX = 10;

/** 非ワイド上部ドック: タイムライン内側の下余白（px） */
export const TOP_DOCK_INNER_BOTTOM_INSET_PX = 8;

/** 波形キャンバス bitmap 高さ = CSS 高さ × この係数（縦解像度） */
export const WAVE_CANVAS_BITMAP_HEIGHT_SCALE = 3;

/** PC ワイド: 再生ツールバー行の高さ目安（px）— 波形計算用 */
export function estimateWideTopDockToolbarChromePx(): number {
  return PC_WIDE_TOP_DOCK_TOOLBAR_CHROME_PX;
}

/** PC ワイド: 波形ストリップ内の目盛り＋枠（px）— キャンバス以外 */
export function estimateWideTopDockWaveStripChromePx(): number {
  return PC_WAVE_RULER_CHROME_PX + PC_WAVE_FRAME_EXTRA_CHROME_PX;
}

/** PC ワイド上部ドックで波形キャンバス以外（ツールバー＋目盛り等）の高さ目安 */
export function estimateWideTopDockWaveChromePx(): number {
  return (
    estimateWideTopDockToolbarChromePx() + estimateWideTopDockWaveStripChromePx()
  );
}

/** PC ワイド上部ドックの波形キャンバス既定高さ（px） */
export const WAVE_CANVAS_H_PC_WIDE_DEFAULT = 50;

/** PC ワイド上部ドックの既定外枠高さ（px）— 再生行・目盛り・波形・下リサイザー */
export const TOP_DOCK_HEIGHT_WIDE_PX =
  estimateWideTopDockWaveChromePx() +
  WAVE_CANVAS_H_PC_WIDE_DEFAULT +
  TOP_DOCK_WAVE_STAGE_RESIZER_PX;

/** リサイズ時に波形が潰れない最小外枠高さ（px） */
export const TOP_DOCK_ROW_MIN_WIDE_PX = TOP_DOCK_HEIGHT_WIDE_PX;
