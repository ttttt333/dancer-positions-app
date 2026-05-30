/** スマホ縦画面波形キャンバス既定高さ（`PortraitWaveTransport` と揃える） */
export const PORTRAIT_WAVE_CANVAS_H_PX = 96;

/** PC 上部ドック: 秒数目盛り行（従来 `calc(16px + 5mm)` の 2/3） */
export const PC_WAVE_RULER_HEIGHT_CSS = "calc((16px + 5mm) * 2 / 3)";

/** 5mm を 96dpi で換算した px（目盛り chrome 見積もり用） */
const MM_TO_PX_AT_96DPI = 96 / 25.4;

/** 目盛り行の px 目安（2/3 縮小後） */
export const PC_WAVE_RULER_CHROME_PX = Math.round(
  ((16 + 5 * MM_TO_PX_AT_96DPI) * 2) / 3
);

/** コンパクト再生ツールバー行（minHeight + padding + border） */
export const PC_WIDE_TOP_DOCK_TOOLBAR_CHROME_PX = Math.round(28 * 1.2 + 2 * 1.2 + 2);

/** 波形ブロック下端の高さリサイズ枠 */
export const PC_WAVE_BOTTOM_RESIZE_CHROME_PX = 10;

/** 波形枠ボーダー等 */
export const PC_WAVE_FRAME_EXTRA_CHROME_PX = 2;

/** PC 上部ドック下端: 波形バーとステージの境目リサイズ枠 */
export const TOP_DOCK_WAVE_STAGE_RESIZER_PX = 10;

/** PC ワイド上部ドックで波形キャンバス以外に占める高さ（px 目安） */
export function estimateWideTopDockWaveChromePx(): number {
  return (
    PC_WIDE_TOP_DOCK_TOOLBAR_CHROME_PX +
    PC_WAVE_RULER_CHROME_PX +
    PC_WAVE_FRAME_EXTRA_CHROME_PX +
    TOP_DOCK_WAVE_STAGE_RESIZER_PX
  );
}

/** PC ワイド上部ドックの波形キャンバス既定高さ（px）。スマホ既定の 2/3 */
export const WAVE_CANVAS_H_PC_WIDE_DEFAULT = Math.round(
  (PORTRAIT_WAVE_CANVAS_H_PX * 2) / 3
);

/** PC ワイド上部ドックの既定外枠高さ（px） */
export const TOP_DOCK_HEIGHT_WIDE_PX =
  estimateWideTopDockWaveChromePx() + WAVE_CANVAS_H_PC_WIDE_DEFAULT;

/** リサイズ時に波形が潰れない最小外枠高さ（px） */
export const TOP_DOCK_ROW_MIN_WIDE_PX =
  estimateWideTopDockWaveChromePx() + WAVE_CANVAS_H_PC_WIDE_DEFAULT;
