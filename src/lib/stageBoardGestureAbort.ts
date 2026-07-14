/** ピンチ開始時など、ダンサー／道具のドラッグを打ち切るときに発火する。 */
export const STAGE_BOARD_ABORT_POINTER_GESTURES =
  "stageboard-abort-pointer-gestures";

export function abortStageBoardPointerGestures(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STAGE_BOARD_ABORT_POINTER_GESTURES));
}
