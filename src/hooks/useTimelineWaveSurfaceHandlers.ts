import type { Dispatch, PointerEvent, SetStateAction } from "react";
import { useCallback, useRef } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  beginPlaybackScrubSession,
  endPlaybackScrubSession,
  seekPlaybackClampedAndSyncStore,
  seekPlaybackDuringScrub,
} from "../lib/playbackTransport";
import {
  hitPlayheadStripForScrub,
  PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX,
  pickCueDragKindAtWave,
  resolveWaveViewForPointerHit,
  waveExtentXToTime,
} from "../lib/timelineWaveGeometry";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import {
  panWaveViewStartAtClientX,
  panWaveViewStartToFollowScrubTime,
} from "../lib/waveEdgeScrollDuringScrub";
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
    let anchorSec = currentTimePropRef.current;
    if (
      isPlayingForWaveRef.current &&
      playbackEngine.getMediaSourceUrl() &&
      !playbackEngine.isPaused() &&
      Number.isFinite(playbackEngine.getCurrentTime())
    ) {
      anchorSec = playbackEngine.getCurrentTime();
    }
    return resolveWaveViewForPointerHit({
      durationSec: duration,
      viewPortion: viewPortionRef.current ?? viewPortion,
      isPlaying: isPlayingForWaveRef.current,
      viewStartOverride: waveViewStartOverrideRef.current,
      anchorTimeSec: anchorSec,
      playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
      enginePaused:
        !isPlayingForWaveRef.current || playbackEngine.isPaused(),
    });
  }, [
    duration,
    isPlayingForWaveRef,
    viewPortion,
    viewPortionRef,
    waveViewStartOverrideRef,
    currentTimePropRef,
    playheadScrubDragRef,
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
    projectViewMode,
    duration,
    peaks,
    canvasRef,
    lastWaveDrawRangeRef,
    waveViewStartOverrideRef,
    trimStartSec,
    trimEndSec,
    currentTimePropRef,
    isPlayingForWaveRef,
    viewPortionRef,
    viewPortion,
    setWaveViewStartOverride,
    drawWaveformAt,
    cuesSorted,
    cueDragRef,
    cueDragPreviewRangeRef,
    playheadScrubDragRef,
    emptyWaveDragRef,
    waveHoverCueRef,
  });
  const { onWaveCanvasPointerDown, clearPending } = useWaveCanvasLongPressGate({
    ...dragArgs,
    projectViewMode,
    peaks,
    canvasRef,
    lastWaveDrawRangeRef,
    waveViewStartOverrideRef,
    viewPortionRef,
    viewPortion,
    cuesSorted,
    cueDragPreviewRangeRef,
    currentTimePropRef,
    isPlayingForWaveRef,
    duration,
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

  const applyPlayheadScrubViewPan = useCallback(
    (clientX: number) => {
      const t = timeAtClientX(clientX);
      if (t != null) {
        const followStart = panWaveViewStartToFollowScrubTime({
          scrubTimeSec: t,
          durationSec: duration,
          viewPortion: viewPortionRef.current ?? viewPortion,
        });
        if (followStart != null) {
          setWaveViewStartOverride(followStart);
        }
      }
      applyEdgeScrollAtClientX(clientX);
    },
    [
      applyEdgeScrollAtClientX,
      duration,
      setWaveViewStartOverride,
      timeAtClientX,
      viewPortion,
      viewPortionRef,
    ]
  );

  const tickPlayheadEdgeScrollLoop = useCallback(() => {
    playheadEdgeScrollRafRef.current = 0;
    const x = playheadScrubClientXRef.current;
    const drag = playheadScrubDragRef.current;
    if (x == null || !drag?.armed) return;
    const vp = viewPortionRef.current ?? viewPortion;
    if (vp >= 1 - 1e-9) return;
    applyPlayheadScrubViewPan(x);
    const t = timeAtClientX(x);
    if (t != null) {
      const moved = seekPlaybackDuringScrub(
        {
          t,
          durationSec: duration,
          trimStartSec,
          trimEndSec,
          roundHeadForStore: true,
        },
        drag.scrubSession
      );
      if (moved != null) {
        currentTimePropRef.current = moved;
        drawWaveformAt(moved);
      }
    }
    playheadEdgeScrollRafRef.current = requestAnimationFrame(tickPlayheadEdgeScrollLoop);
  }, [
    applyPlayheadScrubViewPan,
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
      applyPlayheadScrubViewPan(clientX);
      const t = timeAtClientX(clientX);
      if (t == null) return null;
      const seekParams = {
        t,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
        roundHeadForStore: true as const,
      };
      const session = playheadScrubDragRef.current?.scrubSession ?? null;
      const moved =
        session != null
          ? seekPlaybackDuringScrub(seekParams, session)
          : seekPlaybackClampedAndSyncStore(seekParams);
      if (moved != null) {
        currentTimePropRef.current = moved;
        drawWaveformAt(moved);
      }
      if (opts?.edgeLoop) {
        playheadScrubClientXRef.current = clientX;
        const vp = viewPortionRef.current ?? viewPortion;
        if (vp < 1 - 1e-9 && !playheadEdgeScrollRafRef.current) {
          playheadEdgeScrollRafRef.current = requestAnimationFrame(
            tickPlayheadEdgeScrollLoop
          );
        }
      }
      return moved;
    },
    [
      applyPlayheadScrubViewPan,
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
      const { viewStart, viewSpan } = resolveViewRange();
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
      const cnv = e.currentTarget as HTMLCanvasElement;
      if (!cnv || cnv.tagName !== "CANVAS") return;
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
        drag.scrubSession = beginPlaybackScrubSession();
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
        endPlaybackScrubSession(drag.scrubSession);
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
