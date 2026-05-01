import type { PointerEvent } from "react";
import { useCallback } from "react";
import { playbackEngine } from "../core/playbackEngine";
import { seekPlaybackClampedAndSyncStore } from "../lib/playbackTransport";
import {
  getWaveViewForDraw,
  hitPlayheadStripForScrub,
  pickCueDragKindAtWave,
  waveExtentXToTime,
} from "../lib/timelineWaveGeometry";
import {
  useWaveCanvasPointerDrag,
  type UseWaveCanvasPointerDragArgs,
} from "./useWaveCanvasPointerDrag";

export type UseTimelineWaveSurfaceHandlersParams = UseWaveCanvasPointerDragArgs & {
  /** 目盛りクリック時に `lastWaveDrawRangeRef` が未更新のときのフォールバック */
  viewPortion: number;
  currentTime: number;
};

/**
 * 波形の「表面」操作: 秒数目盛りのシーク、キャンバス pointerdown（ドラッグは `useWaveCanvasPointerDrag`）、
 * ホバー時のカーソル／再生ヘッド帯の再描画。
 */
export function useTimelineWaveSurfaceHandlers(
  params: UseTimelineWaveSurfaceHandlersParams
) {
  const { viewPortion, currentTime, ...dragArgs } = params;
  const onWaveCanvasPointerDown = useWaveCanvasPointerDrag(dragArgs);

  const {
    projectViewMode,
    duration,
    peaks,
    canvasRef,
    lastWaveDrawRangeRef,
    trimStartSec,
    trimEndSec,
    drawWaveformAt,
    currentTimePropRef,
    isPlayingForWaveRef,
    cuesSorted,
    cueDragRef,
    cueDragPreviewRangeRef,
    playheadScrubDragRef,
    emptyWaveDragRef,
    waveHoverCueRef,
  } = params;

  const onWaveRulerPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (projectViewMode === "view" || duration <= 0 || !peaks) return;
      const c = canvasRef.current;
      if (!c) return;
      let viewStart = lastWaveDrawRangeRef.current.viewStart;
      let viewSpan = lastWaveDrawRangeRef.current.viewSpan;
      if (viewSpan <= 0) {
        const gv = getWaveViewForDraw(duration, viewPortion, currentTime);
        viewStart = gv.start;
        viewSpan = gv.span;
      }
      if (viewSpan <= 0) return;
      if (!playbackEngine.getMediaSourceUrl()) return;

      const trimLo = trimStartSec;
      const r0 = c.getBoundingClientRect();
      const x0 = e.clientX - r0.left;
      const tRaw = waveExtentXToTime(x0, viewStart, viewSpan, r0.width);

      e.preventDefault();
      const tFinal = seekPlaybackClampedAndSyncStore({
        t: tRaw,
        durationSec: duration,
        trimStartSec: trimLo,
        trimEndSec,
        roundHeadForStore: true,
      });
      if (tFinal != null) drawWaveformAt(tFinal);
    },
    [
      projectViewMode,
      duration,
      peaks,
      canvasRef,
      lastWaveDrawRangeRef,
      viewPortion,
      currentTime,
      trimStartSec,
      trimEndSec,
      drawWaveformAt,
    ]
  );

  const onWaveCanvasPointerMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (projectViewMode === "view" || duration <= 0 || !peaks) return;
      if (
        cueDragRef.current ||
        playheadScrubDragRef.current ||
        emptyWaveDragRef.current
      ) {
        return;
      }
      if (e.buttons !== 0) return;
      const cnv = canvasRef.current;
      if (!cnv) return;
      const { viewStart, viewSpan } = lastWaveDrawRangeRef.current;
      if (viewSpan <= 0) return;
      let phSec = currentTimePropRef.current;
      if (
        isPlayingForWaveRef.current &&
        playbackEngine.getMediaSourceUrl() &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
      ) {
        phSec = playbackEngine.getCurrentTime();
      }
      if (
        playbackEngine.getMediaSourceUrl() &&
        hitPlayheadStripForScrub(
          e.clientX,
          cnv,
          viewStart,
          viewSpan,
          phSec,
          duration
        )
      ) {
        waveHoverCueRef.current = null;
        cnv.style.cursor = "col-resize";
        let tRedraw = currentTimePropRef.current;
        if (
          isPlayingForWaveRef.current &&
          !playbackEngine.isPaused() &&
          Number.isFinite(playbackEngine.getCurrentTime())
        ) {
          tRedraw = playbackEngine.getCurrentTime();
        }
        drawWaveformAt(tRedraw);
        return;
      }
      const hit = pickCueDragKindAtWave(
        e.clientX,
        e.clientY,
        cnv,
        cuesSorted,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current
      );
      const prev = waveHoverCueRef.current;
      if (prev?.cueId === hit?.cueId && prev?.mode === hit?.mode) return;
      waveHoverCueRef.current = hit;
      const cur =
        hit?.mode === "start" || hit?.mode === "end"
          ? "ew-resize"
          : hit
            ? "move"
            : "pointer";
      cnv.style.cursor = cur;
      let tRedraw = currentTimePropRef.current;
      if (
        isPlayingForWaveRef.current &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
      ) {
        tRedraw = playbackEngine.getCurrentTime();
      }
      drawWaveformAt(tRedraw);
    },
    [
      projectViewMode,
      duration,
      peaks,
      canvasRef,
      lastWaveDrawRangeRef,
      currentTimePropRef,
      isPlayingForWaveRef,
      cuesSorted,
      cueDragRef,
      cueDragPreviewRangeRef,
      playheadScrubDragRef,
      emptyWaveDragRef,
      waveHoverCueRef,
      drawWaveformAt,
    ]
  );

  const onWaveCanvasPointerLeave = useCallback(() => {
    waveHoverCueRef.current = null;
    const cnv = canvasRef.current;
    if (cnv) cnv.style.cursor = duration > 0 ? "pointer" : "default";
    let tRedraw = currentTimePropRef.current;
    if (
      isPlayingForWaveRef.current &&
      !playbackEngine.isPaused() &&
      Number.isFinite(playbackEngine.getCurrentTime())
    ) {
      tRedraw = playbackEngine.getCurrentTime();
    }
    drawWaveformAt(tRedraw);
  }, [
    duration,
    canvasRef,
    currentTimePropRef,
    isPlayingForWaveRef,
    waveHoverCueRef,
    drawWaveformAt,
  ]);

  return {
    onWaveRulerPointerDown,
    onWaveCanvasPointerDown,
    onWaveCanvasPointerMove,
    onWaveCanvasPointerLeave,
  };
}
