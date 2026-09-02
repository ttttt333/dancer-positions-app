/** ピンチ開始時など、ダンサー／道具のドラッグを打ち切るときに発火する。 */
export const STAGE_BOARD_ABORT_POINTER_GESTURES =
  "stageboard-abort-pointer-gestures";

/**
 * ステージ上のインタラクティブ要素（マーカー・選択枠ハンドル・削除ボタン等）に付与する。
 * ピンチパン判定は「主要セレクタの列挙」ではなくこの属性の有無だけで行う。
 */
export const STAGE_INTERACTIVE_ATTR = "data-stage-interactive";

export function isInteractiveStageTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  return (
    el.closest(
      `[${STAGE_INTERACTIVE_ATTR}], button, a, input, textarea, select`,
    ) !== null
  );
}

const MOUSE_POINTER_IDS = [0, 1];

/** モーダルを開く前に、ステージ側に残った pointer capture を外す */
export function releaseOrphanPointerCaptures(): void {
  if (typeof document === "undefined") return;
  const nodes = document.querySelectorAll("*");
  for (const el of nodes) {
    for (const pointerId of MOUSE_POINTER_IDS) {
      try {
        if (
          typeof el.hasPointerCapture === "function" &&
          el.hasPointerCapture(pointerId)
        ) {
          el.releasePointerCapture(pointerId);
        }
      } catch {
        /* 要素が既に外れている等 */
      }
    }
  }
}

export function abortStageBoardPointerGestures(): void {
  if (typeof window === "undefined") return;
  releaseOrphanPointerCaptures();
  window.dispatchEvent(new CustomEvent(STAGE_BOARD_ABORT_POINTER_GESTURES));
}
