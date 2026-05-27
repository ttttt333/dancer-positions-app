import { useSyncExternalStore } from "react";
import { EDITOR_MOBILE_STACK_MAX_PX } from "./editorConstants";

/** stack + landscape を 1 プリミティブにまとめる（useSyncExternalStore の参照安定） */
export type EditorViewportKey = "00" | "01" | "10" | "11";

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
  return () => {
    mqlW.removeEventListener("change", run);
    mqlH.removeEventListener("change", run);
    mqlOrientation.removeEventListener("change", run);
    window.removeEventListener("resize", run);
    window.removeEventListener("orientationchange", run);
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
  return computeEditorViewportKey(window.innerWidth, window.innerHeight);
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
