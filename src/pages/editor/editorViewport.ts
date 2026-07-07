import { useSyncExternalStore } from "react";
import { readLayoutViewportSize } from "../../lib/viewportLayoutMetrics";
import { EDITOR_MOBILE_STACK_MAX_PX, EDITOR_WIDE_MIN_PX, EDITOR_WIDE_POINTER_FALLBACK_MIN_PX } from "./editorConstants";

/** stack + landscape を 1 プリミティブにまとめる（useSyncExternalStore の参照安定） */
export type EditorViewportKey = "00" | "01" | "10" | "11";

export { readLayoutViewportSize } from "../../lib/viewportLayoutMetrics";

/** マウス／トラックパッド操作のデスクトップ（タッチ専用端末を除外） */
export function isDesktopPointerDevice(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * PC ワイドレイアウト（Mac と同じ 3 ペイン＋上部波形ドック）を使うか。
 * 通常は幅 ≥1280px。Windows の表示拡大で幅だけ足りない場合は
 * ポインタ端末かつ幅 ≥1024px でも wide にする。
 */
export function resolveWideEditorLayout(): boolean {
  if (typeof window === "undefined") return false;
  const { width } = readLayoutViewportSize();
  if (width >= EDITOR_WIDE_MIN_PX) return true;
  return (
    width >= EDITOR_WIDE_POINTER_FALLBACK_MIN_PX && isDesktopPointerDevice()
  );
}

export function subscribeWideEditorLayout(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const run = () => cb();
  const mqWide = window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`);
  const mqPointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  mqWide.addEventListener("change", run);
  mqPointer.addEventListener("change", run);
  window.addEventListener("resize", run);
  window.visualViewport?.addEventListener("resize", run);
  return () => {
    mqWide.removeEventListener("change", run);
    mqPointer.removeEventListener("change", run);
    window.removeEventListener("resize", run);
    window.visualViewport?.removeEventListener("resize", run);
  };
}

export function subscribeEditorViewport(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = (q: string) => window.matchMedia(q);
  const mqlW = mq(`(max-width: ${EDITOR_MOBILE_STACK_MAX_PX - 1}px)`);
  const mqlH = mq(`(max-height: ${EDITOR_MOBILE_STACK_MAX_PX - 1}px)`);
  const mqlOrientation = mq("(orientation: landscape)");
  const run = () => {
    cb();
  };
  mqlW.addEventListener("change", run);
  mqlH.addEventListener("change", run);
  mqlOrientation.addEventListener("change", run);
  window.addEventListener("resize", run);
  window.addEventListener("orientationchange", run);
  window.visualViewport?.addEventListener("resize", run);
  return () => {
    mqlW.removeEventListener("change", run);
    mqlH.removeEventListener("change", run);
    mqlOrientation.removeEventListener("change", run);
    window.removeEventListener("resize", run);
    window.removeEventListener("orientationchange", run);
    window.visualViewport?.removeEventListener("resize", run);
  };
}

export function computeEditorViewportKey(
  width: number,
  height: number
): EditorViewportKey {
  const stack = Math.min(width, height) < EDITOR_MOBILE_STACK_MAX_PX;
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
