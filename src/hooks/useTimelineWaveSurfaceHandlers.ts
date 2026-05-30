import type { PointerEvent } from "react";
import { useCallback, useRef } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  beginPlaybackScrubSession,
  endPlaybackScrubSession,
  seekPlaybackScrubAudible,
  type PlaybackScrubSession,
} from "../lib/playbackTransport";
import {
  getWaveViewForDraw,
  hitPlayheadStripForScrub,
  PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX,
  pickCueDragKindAtWave,
  waveExtentXToTime,
} from "../lib/timelineWaveGeometry";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";
import {
  useWaveCanvasPointerDrag,
  type UseWaveCanvasPointerDragArgs,
} from "./useWaveCanvasPointerDrag";
import { useWaveCanvasLongPressGate } from "./useWaveCanvasLongPressGate";
import type { MouseEvent } from "react";

export type UseTimelineWaveSurfaceHandlersParams = UseWaveCanvasPointerDragArgs & {
  /** 目盛りクリック時に `lastWaveDrawRangeRef` が未更新のときのフォールバック */
  viewPortion: number;
  currentTime: number;
  onWaveContextMenu: (e: MouseEvent<HTMLCanvasElement>) => void;
};

/**
 * 波形の「表面」操作: 秒数目盛りのシーク、キャンバス pointerdown（ドラッグは `useWaveCanvasPointerDrag`）、
 * ホバー時のカーソル／再生ヘッド帯の再描画。
 */
export function useTimelineWaveSurfaceHandlers(
  params: UseTimelineWaveSurfaceHandlersParams
) {
  const { viewPortion, currentTime, onWaveContextMenu, ...dragArgs } = params;
  const basePointerDown = useWaveCanvasPointerDrag(dragArgs);
  const { onWaveCanvasPointerDown, clearPending } = useWaveCanvasLongPressGate({
    ...dragArgs,
    onWaveContextMenu,
    basePointerDown,
  });

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
  const rulerScrubSessionRef = useRef<PlaybackScrubSession | null>(null);

  const onWaveRulerPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (projectViewMode === "view" || duration <= 0 || !peaks) return;
      const c = resolveActiveWaveCanvas(canvasRef);
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
      const timeAtClientX = (clientX: number) => {
        const x = clientX - r0.left;
        return waveExtentXToTime(x, viewStart, viewSpan, r0.width);
      };

      e.preventDefault();
      rulerScrubSessionRef.current = beginPlaybackScrubSession();
      const tFinal = seekPlaybackScrubAudible({
        t: timeAtClientX(e.clientX),
        durationSec: duration,
        trimStartSec: trimLo,
        trimEndSec,
        roundHeadForStore: true,
      });
      if (tFinal != null) drawWaveformAt(tFinal);

      const capturePid = e.pointerId;
      e.currentTarget.setPointerCapture(capturePid);
      const onRulerMove = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== capturePid) return;
        if (!(ev.buttons & 1)) return;
        const tMoved = seekPlaybackScrubAudible({
          t: timeAtClientX(ev.clientX),
          durationSec: duration,
          trimStartSec: trimLo,
          trimEndSec,
          roundHeadForStore: true,
        });
        if (tMoved != null) drawWaveformAt(tMoved);
      };
      const onRulerUp = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== capturePid) return;
        window.removeEventListener("pointermove", onRulerMove);
        window.removeEventListener("pointerup", onRulerUp);
        window.removeEventListener("pointercancel", onRulerUp);
        try {
          e.currentTarget.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        const tUp = seekPlaybackScrubAudible({
          t: timeAtClientX(ev.clientX),
          durationSec: duration,
          trimStartSec: trimLo,
          trimEndSec,
          roundHeadForStore: true,
        });
        endPlaybackScrubSession(rulerScrubSessionRef.current);
        rulerScrubSessionRef.current = null;
        if (tUp != null) drawWaveformAt(tUp);
      };
      window.addEventListener("pointermove", onRulerMove);
      window.addEventListener("pointerup", onRulerUp);
      window.addEventListener("pointercancel", onRulerUp);
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
      const cnv = resolveActiveWaveCanvas(canvasRef);
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
          duration,
          useTimelineWaveBridgeStore.getState().portraitActive
            ? PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX
            : undefined
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
    clearPending();
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
    clearPending,
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
