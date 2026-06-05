/** Desktop editor layout constants (shared across editor modules). */

import type { LayoutPresetId } from "../../lib/formationLayouts";

export const DEFAULT_ROSTER_CONFIRM_PRESET: LayoutPresetId = "rows_3";

/** 戻る／進むで遡れるスナップショット数（メモリと JSON サイズのトレードオフ） */
export const HISTORY_CAP = 200;

export const EDITOR_WIDE_MIN_PX = 1280;

/**
 * スマホ向け縦積みレイアウト：ビューポートの短い辺が未満ならモバイル扱い。
 * 横向きで幅だけ広い（≥768）ときも電話 UI に乗せる。
 */
export const EDITOR_MOBILE_STACK_MAX_PX = 768;

/** メイン 3 列グリッドの列間・行間 */
export const EDITOR_GRID_GAP_PX = 10;

/** 上部波形ドック行の既定高さ（px） */
export const TOP_DOCK_HEIGHT_PX = 120;

/** 生徒閲覧（狭い画面）の波形ドック既定高さ（px）— ズーム操作ができるよう十分な高さ */
export const PUBLIC_VIEW_WAVE_DOCK_HEIGHT_PX = 140;

export {
  TOP_DOCK_HEIGHT_WIDE_PX,
  TOP_DOCK_ROW_MIN_WIDE_PX,
  WAVE_CANVAS_H_PC_WIDE_DEFAULT,
} from "../../lib/waveDockMetrics";

/** ワイド＋上部波形時の固定シェル：波形行の外枠高さのベース（px） */
export const EDITOR_SHELL_TOP_WAVE_BASE_PX = 160;

/** 名簿ありで上部に「メンバーを表示」行を出すとき、ベースに足す高さ（px） */
export const EDITOR_SHELL_TOP_WAVE_ROSTER_ROW_PX = 40;

export const EDITOR_PLAYBACK_LAYOUT_SHIFT_UP = "calc(1.45cm + 3mm - 1cm)";

export const STAGE_RESIZER_PX = 4;
export const STAGE_COL_MIN_PX = 340;
export const TIMELINE_FULL_COL_MIN_PX = 240;
export const RIGHT_TOOLS_RAIL_MIN_PX = 152;
export const RIGHT_TOOLS_RAIL_MAX_PX = 210;

export const STAGE_COL_FR_DEFAULT = 80;
export const RIGHT_RAIL_FR_DEFAULT = 20;

/** PC ワイド上部ドックの最小高さは `TOP_DOCK_ROW_MIN_WIDE_PX`、それ以外は 50 */
export const TOP_DOCK_ROW_MIN_PX = 50;
export const TOP_DOCK_ROW_MAX_PX = 480;

export const EDITOR_LAYOUT_STORAGE_KEY = "dancer-positions.editorLayout.v2";
export const EDITOR_LAYOUT_LEGACY_STORAGE_KEY = "dancer-positions.editorLayout.v1";
