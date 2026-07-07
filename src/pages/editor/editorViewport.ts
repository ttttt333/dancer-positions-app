import { useSyncExternalStore } from "react";
import { readLayoutViewportSize } from "../../lib/viewportLayoutMetrics";
import {
  EDITOR_DESKTOP_POINTER_MIN_WIDTH_PX,
  EDITOR_MOBILE_STACK_MAX_PX,
  EDITOR_WIDE_MIN_PX,
} from "./editorConstants";

/** stack + landscape を 1 プリミティブにまとめる（useSyncExternalStore の参照安定） */
export type EditorViewportKey = "00" | "01" | "10" | "11";

export { readLayoutViewportSize } from "../../lib/viewportLayoutMetrics";

/** マウス／トラックパッド操作のデスクトップ（タッチ専用端末を除外） */
export function isDesktopPointerDevice(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return true;
  }
  return window.matchMedia("(any-pointer: fine)").matches;
}

/**
 * スマホ縦積み UI（MobileShell / editor-mobile-stack）を使うか。
 * Windows 125〜150% 表示では CSS 高さだけ 768 未満になりやすいため、
 * マウス操作かつ幅 ≥640 のときはモバイル扱いにしない。
 */
export function isEditorMobileStackViewport(
  width: number,
  height: number,
  opts?: { desktopPointer?: boolean }
): boolean {
  const desktop =
    opts?.desktopPointer !== undefined
      ? opts.desktopPointer
      : isDesktopPointerDevice();
  if (desktop && width >= EDITOR_DESKTOP_POINTER_MIN_WIDTH_PX) {
    return false;
  }
  return Math.min(width, height) < EDITOR_MOBILE_STACK_MAX_PX;
}

/**
 * PC ワイドレイアウト（Mac と同じ 3 ペイン＋上部波形ドック）を使うか。
 * 幅 ≥1280px、またはマウス操作のデスクトップで幅 ≥640px。
 */
export function resolveWideEditorLayout(): boolean {
  if (typeof window === "undefined") return false;
  const { width } = readLayoutViewportSize();
  if (width >= EDITOR_WIDE_MIN_PX) return true;
  return (
    isDesktopPointerDevice() && width >= EDITOR_DESKTOP_POINTER_MIN_WIDTH_PX
  );
}

/** `/editor/:id` で MobileShell ではなく EditorPage 直出しにするか */
export function shouldUseMobileEditorShell(): boolean {
  if (typeof window === "undefined") return false;
  const { width, height } = readLayoutViewportSize();
  return isEditorMobileStackViewport(width, height);
}

export function subscribeWideEditorLayout(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const run = () => cb();
  const mqWide = window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`);
  const mqTablet = window.matchMedia(
    `(min-width: ${EDITOR_DESKTOP_POINTER_MIN_WIDTH_PX}px)`
  );
  const mqPointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const mqAnyFine = window.matchMedia("(any-pointer: fine)");
  for (const mq of [mqWide, mqTablet, mqPointer, mqAnyFine]) {
    mq.addEventListener("change", run);
  }
  window.addEventListener("resize", run);
  window.visualViewport?.addEventListener("resize", run);
  return () => {
    for (const mq of [mqWide, mqTablet, mqPointer, mqAnyFine]) {
      mq.removeEventListener("change", run);
    }
    window.removeEventListener("resize", run);
    window.visualViewport?.removeEventListener("resize", run);
  };
}

export function subscribeEditorViewport(cb: () => void): () => void {
  return subscribeWideEditorLayout(cb);
}

export function computeEditorViewportKey(
  width: number,
  height: number,
  opts?: { desktopPointer?: boolean }
): EditorViewportKey {
  const stack = isEditorMobileStackViewport(width, height, opts);
  const landscape = width > height;
  return `${stack ? "1" : "0"}${landscape ? "1" : "0"}` as EditorViewportKey;
}

export function getEditorViewportKey(): EditorViewportKey {
  if (typeof window === "undefined") return "00";
  const { width, height } = readLayoutViewportSize();
  return computeEditorViewportKey(width, height);
}

export function useEditorViewport() {
  const key = useSyncExternalStore(
    subscribeEditorViewport,
    getEditorViewportKey,
    () => "00" as EditorViewportKey
  );
  return {
    editorViewportKey: key,
    editorMobileStackBreakpoint: key[0] === "1",
    editorMobileLandscape: key[1] === "1",
  };
}
