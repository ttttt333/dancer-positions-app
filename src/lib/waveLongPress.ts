import type { MouseEvent, PointerEvent } from "react";

/** 長押しでコンテキストメニューを開くまでの待ち時間（PC・スマホ共通） */
export const WAVE_LONG_PRESS_MS = 520;

/** この距離以上動いたら長押しをキャンセル */
export const WAVE_LONG_PRESS_CANCEL_PX = 18;

/** この距離以上動いたらドラッグ操作を開始（キュー移動など） */
export const WAVE_DRAG_ARM_PX = 8;

/** 再生バー: この距離以上動いたときだけシーク（クリックのみでは進めない） */
export const PLAYHEAD_SCRUB_ARM_PX = 4;

/** PC: キュー間動線の長押し当たり判定余白 */
export const PC_GAP_LONG_PRESS_PAD_PX = 14;

/** 2 回目の pointerup がダブルクリック直前かどうか（ブラウザの dblclick 猶予に合わせる） */
export const WAVE_DOUBLE_CLICK_GAP_MS = 450;

export function isWaveDoubleClickFollowUp(
  lastPointerUpAtMs: number,
  nowMs = performance.now()
): boolean {
  return lastPointerUpAtMs > 0 && nowMs - lastPointerUpAtMs < WAVE_DOUBLE_CLICK_GAP_MS;
}

/** 2 回目のクリックでこれ以上動いたらダブルクリック扱いをやめる */
export const WAVE_DOUBLE_CLICK_CANCEL_PX = 14;

/**
 * 2 回目の pointerdown で arm し、pointerup で onCommit（ブラウザ dblclick に依存しない）。
 * ズーム中は pointer 経路が dblclick を潰すことがあるため PC 波形で使う。
 */
export function armWaveDoubleClickPointerGesture(params: {
  pointerId: number;
  originX: number;
  originY: number;
  wavePointerGestureRef: { current: { lastPointerUpAtMs: number } };
  suppressNextWaveSeekRef: { current: boolean };
  onCommit: (clientX: number, clientY: number) => void;
}): () => void {
  const {
    pointerId,
    originX,
    originY,
    wavePointerGestureRef,
    suppressNextWaveSeekRef,
    onCommit,
  } = params;
  let cancelled = false;
  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
  const onMove = (ev: PointerEvent) => {
    if (cancelled || ev.pointerId !== pointerId) return;
    if (
      Math.hypot(ev.clientX - originX, ev.clientY - originY) >
      WAVE_DOUBLE_CLICK_CANCEL_PX
    ) {
      cancelled = true;
      cleanup();
    }
  };
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    cleanup();
    if (cancelled) return;
    wavePointerGestureRef.current.lastPointerUpAtMs = performance.now();
    suppressNextWaveSeekRef.current = true;
    onCommit(ev.clientX, ev.clientY);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  return cleanup;
}

export function tryArmWaveDoubleClickOnPointerDown(params: {
  wavePointerGestureRef: { current: { lastPointerUpAtMs: number } };
  suppressNextWaveSeekRef: { current: boolean };
  pointerId: number;
  clientX: number;
  clientY: number;
  onCommit: (clientX: number, clientY: number) => void;
}): boolean {
  if (
    !isWaveDoubleClickFollowUp(params.wavePointerGestureRef.current.lastPointerUpAtMs)
  ) {
    return false;
  }
  armWaveDoubleClickPointerGesture({
    pointerId: params.pointerId,
    originX: params.clientX,
    originY: params.clientY,
    wavePointerGestureRef: params.wavePointerGestureRef,
    suppressNextWaveSeekRef: params.suppressNextWaveSeekRef,
    onCommit: params.onCommit,
  });
  return true;
}

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
