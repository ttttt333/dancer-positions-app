import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";

export const WAVE_CANVAS_H_MIN = 24;
export const WAVE_CANVAS_H_MAX = 280;

type WaveHeightDragState = {
  pointerId: number;
  startY: number;
  startH: number;
} | null;

type Params = {
  projectViewMode: ChoreographyProjectJson["viewMode"];
  waveCanvasCssHRef: MutableRefObject<number>;
  setWaveCanvasCssH: Dispatch<SetStateAction<number>>;
};

/**
 * 波形下枠のドラッグでキャンバス高さ（CSS px）を変更する。
 */
export function useTimelineWaveHeightDrag({
  projectViewMode,
  waveCanvasCssHRef,
  setWaveCanvasCssH,
}: Params) {
  const waveHeightDragRef = useRef<WaveHeightDragState>(null);

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const d = waveHeightDragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      const dy = ev.clientY - d.startY;
      const nh = Math.round(
        Math.min(WAVE_CANVAS_H_MAX, Math.max(WAVE_CANVAS_H_MIN, d.startH + dy))
      );
      setWaveCanvasCssH(nh);
    };
    const onUp = (ev: PointerEvent) => {
      const d = waveHeightDragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      waveHeightDragRef.current = null;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setWaveCanvasCssH]);

  const onWaveBorderResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (projectViewMode === "view") return;
      e.preventDefault();
      e.stopPropagation();
      waveHeightDragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startH: waveCanvasCssHRef.current,
      };
      document.body.style.cursor = "ns-resize";
    },
    [projectViewMode, waveCanvasCssHRef]
  );

  return { onWaveBorderResizePointerDown };
}
