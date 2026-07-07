/** 横画面下部波形キャンバスの高さ（目盛り行は PortraitWaveTransport の CSS のまま） */
export const LANDSCAPE_WAVE_CANVAS_HEIGHT_PX = Math.round(80 * (2 / 3));

/** 横画面: 目盛り行の高さ（コンパクト） */
export const LANDSCAPE_WAVE_RULER_HEIGHT_PX = 12;

/** 横画面: 目盛り + キャンバス（メタ行なし・safe-area 除く） */
export const LANDSCAPE_WAVE_DOCK_HEIGHT_PX =
  LANDSCAPE_WAVE_RULER_HEIGHT_PX + LANDSCAPE_WAVE_CANVAS_HEIGHT_PX;

/** 横画面: 波形ドック上部の操作バー高さ */
export const LANDSCAPE_WAVE_DOCK_CHROME_HEIGHT_PX = 36;

/** 横画面: 波形ドック全体の高さ（chrome + 目盛り + キャンバス・safe-area 除く） */
export const LANDSCAPE_WAVE_DOCK_TOTAL_HEIGHT_PX =
  LANDSCAPE_WAVE_DOCK_CHROME_HEIGHT_PX + LANDSCAPE_WAVE_DOCK_HEIGHT_PX;
