import type { Dispatch, PointerEvent, SetStateAction } from "react";
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
import { panWaveViewStartAtClientX } from "../lib/waveEdgeScrollDuringScrub";
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
  setWaveViewStartOverride: Dispatch<SetStateAction<number | null>>;
  openGapRouteMenuAtPointer: (clientX: number, clientY: number) => void;
};

/**
 * 波形の「表面」操作: 秒数目盛りのシーク、キャンバス pointerdown（ドラッグは `useWaveCanvasPointerDrag`）、
 * ホバー時のカーソル／再生ヘッド帯の再描画。
 */
export function useTimelineWaveSurfaceHandlers(
  params: UseTimelineWaveSurfaceHandlersParams
) {
  const {
    viewPortion,
    currentTime,
    openGapRouteMenuAtPointer,
    setWaveViewStartOverride,
    ...dragArgs
  } = params;
  const basePointerDown = useWaveCanvasPointerDrag({
    ...dragArgs,
    viewPortion,
    setWaveViewStartOverride,
  });
  const { onWaveCanvasPointerDown, clearPending } = useWaveCanvasLongPressGate({
    ...dragArgs,
    openGapRouteMenuAtPointer,
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
  const playheadEdgeScrollRafRef = useRef(0);
  const playheadScrubClientXRef = useRef<number | null>(null);

  const resolveViewRange = useCallback(() => {
    let viewStart = lastWaveDrawRangeRef.current.viewStart;
    let viewSpan = lastWaveDrawRangeRef.current.viewSpan;
    if (viewSpan <= 0) {
      const gv = getWaveViewForDraw(duration, viewPortion, currentTime);
      viewStart = gv.start;
      viewSpan = gv.span;
    }
    return { viewStart, viewSpan };
  }, [canvasRef, currentTime, duration, lastWaveDrawRangeRef, viewPortion]);

  const timeAtClientX = useCallback(
    (clientX: number) => {
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c) return null;
      const { viewStart, viewSpan } = resolveViewRange();
      if (viewSpan <= 0) return null;
      const r = c.getBoundingClientRect();
      return waveExtentXToTime(clientX - r.left, viewStart, viewSpan, r.width);
    },
    [canvasRef, resolveViewRange]
  );

  const applyEdgeScrollAtClientX = useCallback(
    (clientX: number) => {
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c) return;
      const { viewStart, viewSpan } = resolveViewRange();
      const nextStart = panWaveViewStartAtClientX({
        clientX,
        canvasRect: c.getBoundingClientRect(),
        viewStart,
        viewSpan,
        durationSec: duration,
        viewPortion,
      });
      if (nextStart != null) {
        setWaveViewStartOverride(nextStart);
      }
    },
    [
      canvasRef,
      duration,
      resolveViewRange,
      setWaveViewStartOverride,
      viewPortion,
    ]
  );

  const stopPlayheadEdgeScrollLoop = useCallback(() => {
    if (playheadEdgeScrollRafRef.current) {
      cancelAnimationFrame(playheadEdgeScrollRafRef.current);
      playheadEdgeScrollRafRef.current = 0;
    }
    playheadScrubClientXRef.current = null;
  }, []);

  const tickPlayheadEdgeScrollLoop = useCallback(() => {
    playheadEdgeScrollRafRef.current = 0;
    const x = playheadScrubClientXRef.current;
    if (x == null || !playheadScrubDragRef.current) return;
    applyEdgeScrollAtClientX(x);
    const t = timeAtClientX(x);
    if (t != null) {
      const moved = seekPlaybackScrubAudible({
        t,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
        roundHeadForStore: true,
      });
      if (moved != null) drawWaveformAt(moved);
    }
    playheadEdgeScrollRafRef.current = requestAnimationFrame(tickPlayheadEdgeScrollLoop);
  }, [
    applyEdgeScrollAtClientX,
    drawWaveformAt,
    duration,
    playheadScrubDragRef,
    timeAtClientX,
    trimEndSec,
    trimStartSec,
  ]);

  const scrubAtClientX = useCallback(
    (clientX: number, opts?: { edgeLoop?: boolean }) => {
      applyEdgeScrollAtClientX(clientX);
      const t = timeAtClientX(clientX);
      if (t == null) return null;
      const moved = seekPlaybackScrubAudible({
        t,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
        roundHeadForStore: true,
      });
      if (moved != null) drawWaveformAt(moved);
      if (opts?.edgeLoop) {
        playheadScrubClientXRef.current = clientX;
        const c = resolveActiveWaveCanvas(canvasRef);
        if (c && viewPortion < 1 - 1e-9) {
          const r = c.getBoundingClientRect();
          const zone = Math.max(32, r.width * 0.14);
          const inEdge =
            clientX <= r.left + zone || clientX >= r.right - zone;
          if (inEdge && !playheadEdgeScrollRafRef.current) {
            playheadEdgeScrollRafRef.current = requestAnimationFrame(
              tickPlayheadEdgeScrollLoop
            );
          }
        }
      }
      return moved;
    },
    [
      applyEdgeScrollAtClientX,
      canvasRef,
      drawWaveformAt,
      duration,
      tickPlayheadEdgeScrollLoop,
      timeAtClientX,
      trimEndSec,
      trimStartSec,
      viewPortion,
    ]
  );

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

  const onPlayheadLinePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (projectViewMode === "view" || duration <= 0 || !peaks) return;
      if (!playbackEngine.getMediaSourceUrl()) return;
      e.preventDefault();
      e.stopPropagation();
      clearPending();
      const scrubSession = beginPlaybackScrubSession();
      playheadScrubDragRef.current = { pointerId: e.pointerId, scrubSession };
      scrubAtClientX(e.clientX, { edgeLoop: true });
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [
      clearPending,
      duration,
      peaks,
      playheadScrubDragRef,
      projectViewMode,
      scrubAtClientX,
    ]
  );

  const onPlayheadLinePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!playheadScrubDragRef.current) return;
      if (playheadScrubDragRef.current.pointerId !== e.pointerId) return;
      if (!(e.buttons & 1)) return;
      e.preventDefault();
      scrubAtClientX(e.clientX, { edgeLoop: true });
    },
    [playheadScrubDragRef, scrubAtClientX]
  );

  const endPlayheadLineDrag = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!playheadScrubDragRef.current) return;
      if (playheadScrubDragRef.current.pointerId !== e.pointerId) return;
      stopPlayheadEdgeScrollLoop();
      params.suppressNextWaveSeekRef.current = true;
      scrubAtClientX(e.clientX);
      endPlaybackScrubSession(playheadScrubDragRef.current.scrubSession);
      playheadScrubDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [
      params.suppressNextWaveSeekRef,
      playheadScrubDragRef,
      scrubAtClientX,
      stopPlayheadEdgeScrollLoop,
    ]
  );

  return {
    onWaveRulerPointerDown,
    onWaveCanvasPointerDown,
    onWaveCanvasPointerMove,
    onWaveCanvasPointerLeave,
    onPlayheadLinePointerDown,
    onPlayheadLinePointerMove,
    onPlayheadLinePointerUp: endPlayheadLineDrag,
    onPlayheadLinePointerCancel: endPlayheadLineDrag,
  };
}
