import type { Dispatch, PointerEvent, SetStateAction } from "react";
import { useCallback, useRef } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  seekPlaybackClampedAndSyncStore,
  seekPlaybackScrubAudible,
} from "../lib/playbackTransport";
import {
  getWaveViewForDraw,
  hitPlayheadStripForScrub,
  PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX,
  pickCueDragKindAtWave,
  resolveWaveViewForPointerHit,
  waveExtentXToTime,
} from "../lib/timelineWaveGeometry";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import { panWaveViewStartAtClientX } from "../lib/waveEdgeScrollDuringScrub";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";
import { PLAYHEAD_SCRUB_ARM_PX } from "../lib/waveLongPress";
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
    waveViewStartOverrideRef,
    viewPortionRef,
    ...dragArgs
  } = params;
  const playheadEdgeScrollRafRef = useRef(0);
  const playheadScrubClientXRef = useRef<number | null>(null);

  const resolveViewRange = useCallback(() => {
    return resolveWaveViewForPointerHit({
      durationSec: duration,
      viewPortion,
      isPlaying: isPlayingForWaveRef.current,
      viewStartOverride: waveViewStartOverrideRef.current,
      lastDrawRange: lastWaveDrawRangeRef.current,
    });
  }, [
    duration,
    isPlayingForWaveRef,
    lastWaveDrawRangeRef,
    viewPortion,
    waveViewStartOverrideRef,
  ]);

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

  const seekTimelineAtClientX = useCallback(
    (clientX: number) => {
      if (projectViewMode === "view" || duration <= 0 || !peaks) return;
      if (!playbackEngine.getMediaSourceUrl()) return;
      const t = timeAtClientX(clientX);
      if (t == null) return;
      const moved = seekPlaybackClampedAndSyncStore({
        t,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
        roundHeadForStore: true,
      });
      if (moved != null) {
        currentTimePropRef.current = moved;
        drawWaveformAt(moved);
      }
    },
    [
      canvasRef,
      currentTimePropRef,
      drawWaveformAt,
      duration,
      peaks,
      projectViewMode,
      timeAtClientX,
      trimEndSec,
      trimStartSec,
      currentTimePropRef,
    ]
  );

  const basePointerDown = useWaveCanvasPointerDrag({
    ...dragArgs,
    viewPortion,
    setWaveViewStartOverride,
  });
  const { onWaveCanvasPointerDown, clearPending } = useWaveCanvasLongPressGate({
    ...dragArgs,
    duration,
    viewPortion,
    seekTimelineAtClientX,
    openGapRouteMenuAtPointer,
    basePointerDown,
  });

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
    if (x == null || !playheadScrubDragRef.current?.armed) return;
    applyEdgeScrollAtClientX(x);
    const t = timeAtClientX(x);
    if (t != null) {
      const moved = seekPlaybackClampedAndSyncStore({
        t,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
        roundHeadForStore: true,
      });
      if (moved != null) {
        currentTimePropRef.current = moved;
        drawWaveformAt(moved);
      }
    }
    playheadEdgeScrollRafRef.current = requestAnimationFrame(tickPlayheadEdgeScrollLoop);
  }, [
    applyEdgeScrollAtClientX,
    currentTimePropRef,
    drawWaveformAt,
    duration,
    playheadScrubDragRef,
    timeAtClientX,
    trimEndSec,
    trimStartSec,
  ]);

  const scrubAtClientX = useCallback(
    (clientX: number, opts?: { edgeLoop?: boolean; audible?: boolean }) => {
      applyEdgeScrollAtClientX(clientX);
      const t = timeAtClientX(clientX);
      if (t == null) return null;
      const seekParams = {
        t,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
        roundHeadForStore: true as const,
      };
      const moved =
        opts?.audible === true
          ? seekPlaybackScrubAudible(seekParams)
          : seekPlaybackClampedAndSyncStore(seekParams);
      if (moved != null) {
        currentTimePropRef.current = moved;
        drawWaveformAt(moved);
      }
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
      currentTimePropRef,
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
      const seekRulerAtClientX = (clientX: number) => {
        const moved = seekPlaybackClampedAndSyncStore({
          t: timeAtClientX(clientX),
          durationSec: duration,
          trimStartSec: trimLo,
          trimEndSec,
          roundHeadForStore: true,
        });
        if (moved != null) {
          currentTimePropRef.current = moved;
          drawWaveformAt(moved);
        }
        return moved;
      };

      seekRulerAtClientX(e.clientX);

      const capturePid = e.pointerId;
      e.currentTarget.setPointerCapture(capturePid);
      const onRulerMove = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== capturePid) return;
        if (!(ev.buttons & 1)) return;
        seekRulerAtClientX(ev.clientX);
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
        seekRulerAtClientX(ev.clientX);
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
      currentTimePropRef,
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
      const { viewStart, viewSpan } = resolveViewRange();
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
      resolveViewRange,
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
      playheadScrubDragRef.current = {
        pointerId: e.pointerId,
        scrubSession: null,
        originX: e.clientX,
        originY: e.clientY,
        armed: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [
      clearPending,
      duration,
      peaks,
      playheadScrubDragRef,
      projectViewMode,
    ]
  );

  const onPlayheadLinePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = playheadScrubDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (!(e.buttons & 1)) return;
      if (!drag.armed) {
        const dx = e.clientX - drag.originX;
        const dy = e.clientY - drag.originY;
        if (Math.hypot(dx, dy) < PLAYHEAD_SCRUB_ARM_PX) return;
        drag.armed = true;
      }
      e.preventDefault();
      scrubAtClientX(e.clientX, { edgeLoop: true });
    },
    [playheadScrubDragRef, scrubAtClientX]
  );

  const endPlayheadLineDrag = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = playheadScrubDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      stopPlayheadEdgeScrollLoop();
      if (drag.armed) {
        params.suppressNextWaveSeekRef.current = true;
        scrubAtClientX(e.clientX);
      }
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
