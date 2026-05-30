import type { MouseEvent, PointerEvent } from "react";

/** 長押しでコンテキストメニューを開くまでの待ち時間（PC・スマホ共通） */
export const WAVE_LONG_PRESS_MS = 520;

/** この距離以上動いたら長押しをキャンセル */
export const WAVE_LONG_PRESS_CANCEL_PX = 18;

/** この距離以上動いたらドラッグ操作を開始（キュー移動など） */
export const WAVE_DRAG_ARM_PX = 14;

/** PC: キュー間動線の長押し当たり判定余白 */
export const PC_GAP_LONG_PRESS_PAD_PX = 14;

export function synthMouseEventFromPointer(
  type: "click" | "dblclick" | "contextmenu",
  source: PointerEvent<HTMLCanvasElement>
): MouseEvent<HTMLCanvasElement> {
  return {
    ...source,
    type,
    button: source.button,
    buttons: source.buttons,
    clientX: source.clientX,
    clientY: source.clientY,
    preventDefault: () => source.preventDefault(),
    stopPropagation: () => source.stopPropagation(),
  } as MouseEvent<HTMLCanvasElement>;
}
