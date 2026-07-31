import type { Dispatch, PointerEvent, SetStateAction } from "react";
import { useCallback, useRef } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  beginPlaybackScrubSession,
  endPlaybackScrubSession,
  type PlaybackScrubSession,
} from "../lib/playbackTransport";
import {
  hitPlayheadStripForScrub,
  PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX,
  pickCueDragKindAtWave,
  resolvePlayheadSecForWaveInteraction,
  resolveWaveViewForPointerHit,
  waveExtentXToTime,
} from "../lib/timelineWaveGeometry";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import {
  isWaveEdgeScrollZone,
  panWaveViewStartAtClientX,
  PLAYHEAD_SCRUB_EDGE_SCROLL_PAN_STRENGTH,
} from "../lib/waveEdgeScrollDuringScrub";
import {
  commitWaveTimelineSeekAtClientX,
  panWaveViewStartForPlayheadAtClientX,
} from "../lib/waveTimelineSeek";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";
import { abortTimelineWavePointerGestures } from "../lib/abortTimelineWavePointerGestures";
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
  /** 2 回目の pointerup でキュー追加（ズーム時は dblclick が届かないことがある） */
  commitWaveDoubleClickAt: (clientX: number, clientY: number) => void;
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
    peaksRef,
    canvasRef,
    lastWaveDrawRangeRef,
    waveViewStartOverrideRef,
    trimStartSec,
    trimEndSec,
    currentTimePropRef,
    isPlayingForWaveRef,
    viewPortionRef,
    drawWaveformAt,
    cuesSorted,
    cuesRef,
    cueDragRef,
    cueDragPreviewRangeRef,
    playheadScrubDragRef,
    emptyWaveDragRef,
    newCueRangePreviewRef,
    waveHoverCueRef,
    setCurrentTime,
    onSelectedCueIdsChange,
    suppressNextWaveSeekRef,
    waveSeekSnapLatchRef,
    wavePointerGestureRef,
    setProject,
    durationRef,
    formationIdForNewCue,
    formations,
    onFormationChosenFromCueList,
    commitWaveDoubleClickAt,
  } = params;
  const playheadEdgeScrollRafRef = useRef(0);
  const playheadScrubClientXRef = useRef<number | null>(null);

  const resolvePlayheadSecForHit = useCallback(() => {
    const engineSec =
      playbackEngine.getMediaSourceUrl() &&
      !playbackEngine.isPaused() &&
      Number.isFinite(playbackEngine.getCurrentTime())
        ? playbackEngine.getCurrentTime()
        : null;
    return resolvePlayheadSecForWaveInteraction({
      currentTimePropSec: currentTimePropRef.current,
      isPlayingForWave: isPlayingForWaveRef.current,
      playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
      engineTimeSec: engineSec,
    });
  }, [currentTimePropRef, isPlayingForWaveRef, playheadScrubDragRef]);

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
      cueDragArmed: cueDragRef.current != null,
      enginePaused:
        !isPlayingForWaveRef.current || playbackEngine.isPaused(),
      lastDrawRange: lastWaveDrawRangeRef.current,
    });
  }, [
    duration,
    isPlayingForWaveRef,
    lastWaveDrawRangeRef,
    viewPortion,
    viewPortionRef,
    waveViewStartOverrideRef,
    currentTimePropRef,
    playheadScrubDragRef,
    cueDragRef,
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

  const waveSeekViewContext = useCallback(() => {
    let anchorSec = currentTimePropRef.current;
    if (
      isPlayingForWaveRef.current &&
      playbackEngine.getMediaSourceUrl() &&
      !playbackEngine.isPaused() &&
      Number.isFinite(playbackEngine.getCurrentTime())
    ) {
      anchorSec = playbackEngine.getCurrentTime();
    }
    return {
      durationSec: duration,
      viewPortion: viewPortionRef.current ?? viewPortion,
      isPlaying: isPlayingForWaveRef.current,
      viewStartOverride: waveViewStartOverrideRef.current,
      anchorTimeSec: anchorSec,
      playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
      cueDragArmed: cueDragRef.current != null,
      enginePaused:
        !isPlayingForWaveRef.current || playbackEngine.isPaused(),
      lastDrawRange: lastWaveDrawRangeRef.current,
    };
  }, [
    currentTimePropRef,
    duration,
    isPlayingForWaveRef,
    lastWaveDrawRangeRef,
    playheadScrubDragRef,
    cueDragRef,
    viewPortion,
    viewPortionRef,
    waveViewStartOverrideRef,
  ]);

  const seekTimelineAtClientX = useCallback(
    (clientX: number, scrubSession?: PlaybackScrubSession | null) => {
      if (projectViewMode === "view" || duration <= 0 || !peaks) return null;
      if (!playbackEngine.getMediaSourceUrl()) return null;
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c) return null;
      const moved = commitWaveTimelineSeekAtClientX({
        clientX,
        canvas: c,
        trimStartSec,
        trimEndSec,
        setWaveViewStartOverride,
        scrubSession: scrubSession ?? null,
        ...waveSeekViewContext(),
        waveSeekSnapLatchRef,
      });
      if (moved != null) {
        currentTimePropRef.current = moved;
        drawWaveformAt(moved);
      }
      return moved;
    },
    [
      canvasRef,
      currentTimePropRef,
      drawWaveformAt,
      duration,
      peaks,
      projectViewMode,
      setWaveViewStartOverride,
      trimEndSec,
      trimStartSec,
      waveSeekViewContext,
      waveSeekSnapLatchRef,
    ]
  );

  const basePointerDown = useWaveCanvasPointerDrag({
    projectViewMode,
    duration,
    peaks,
    peaksRef,
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
    cuesRef,
    cueDragRef,
    cueDragPreviewRangeRef,
    playheadScrubDragRef,
    emptyWaveDragRef,
    newCueRangePreviewRef,
    waveHoverCueRef,
    setCurrentTime,
    onSelectedCueIdsChange,
    suppressNextWaveSeekRef,
    waveSeekSnapLatchRef,
    wavePointerGestureRef,
    setProject,
    durationRef,
    formationIdForNewCue,
    formations,
    onFormationChosenFromCueList,
    commitWaveDoubleClickAt,
  });
  const { onWaveCanvasPointerDown, clearPending } = useWaveCanvasLongPressGate({
    projectViewMode,
    duration,
    peaks,
    peaksRef,
    canvasRef,
    lastWaveDrawRangeRef,
    waveViewStartOverrideRef,
    viewPortionRef,
    viewPortion,
    cuesSorted,
    cueDragPreviewRangeRef,
    cueDragRef,
    currentTimePropRef,
    isPlayingForWaveRef,
    playheadScrubDragRef,
    suppressNextWaveSeekRef,
    wavePointerGestureRef,
    seekTimelineAtClientX,
    openGapRouteMenuAtPointer,
    commitWaveDoubleClickAt,
    basePointerDown,
  });

  const applyPlayheadEdgeScrollAtClientX = useCallback(
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
        panStrength: PLAYHEAD_SCRUB_EDGE_SCROLL_PAN_STRENGTH,
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

  const applyPlayheadScrubViewFollow = useCallback(
    (clientX: number, scrubTimeSec: number) => {
      const c = resolveActiveWaveCanvas(canvasRef);
      const vp = viewPortionRef.current ?? viewPortion;
      if (!c || vp >= 1 - 1e-9) return;
      const followStart = panWaveViewStartForPlayheadAtClientX({
        scrubTimeSec,
        clientX,
        canvasRect: c.getBoundingClientRect(),
        durationSec: duration,
        viewPortion: vp,
      });
      if (followStart != null) {
        setWaveViewStartOverride(followStart);
      }
    },
    [canvasRef, duration, setWaveViewStartOverride, viewPortion, viewPortionRef]
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
    const drag = playheadScrubDragRef.current;
    if (x == null || !drag?.armed) return;
    const vp = viewPortionRef.current ?? viewPortion;
    if (vp >= 1 - 1e-9) return;
    applyPlayheadEdgeScrollAtClientX(x);
    const moved = seekTimelineAtClientX(x, drag.scrubSession);
    const c = resolveActiveWaveCanvas(canvasRef);
    if (
      moved != null &&
      c &&
      !isWaveEdgeScrollZone(x, c.getBoundingClientRect())
    ) {
      applyPlayheadScrubViewFollow(x, moved);
    }
    playheadEdgeScrollRafRef.current = requestAnimationFrame(tickPlayheadEdgeScrollLoop);
  }, [
    applyPlayheadEdgeScrollAtClientX,
    applyPlayheadScrubViewFollow,
    canvasRef,
    playheadScrubDragRef,
    seekTimelineAtClientX,
    viewPortion,
    viewPortionRef,
  ]);

  const scrubAtClientX = useCallback(
    (clientX: number, opts?: { edgeLoop?: boolean }) => {
      const session = playheadScrubDragRef.current?.scrubSession ?? null;
      const moved = seekTimelineAtClientX(clientX, session);
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
      playheadScrubDragRef,
      seekTimelineAtClientX,
      tickPlayheadEdgeScrollLoop,
      viewPortion,
      viewPortionRef,
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
      const seekRulerAtClientX = (clientX: number) =>
        seekTimelineAtClientX(clientX);

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
      seekTimelineAtClientX,
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
      const phSec = resolvePlayheadSecForHit();
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
      resolvePlayheadSecForHit,
    ]
  );

  const onWaveCanvasPointerLeave = useCallback(() => {
    clearPending();
    abortTimelineWavePointerGestures();
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
      const vp = viewPortionRef.current ?? viewPortion;
      const zoomed = vp < 1 - 1e-9;
      playheadScrubDragRef.current = {
        pointerId: e.pointerId,
        scrubSession: zoomed ? beginPlaybackScrubSession() : null,
        originX: e.clientX,
        originY: e.clientY,
        armed: zoomed,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      if (zoomed) {
        const moved = seekTimelineAtClientX(
          e.clientX,
          playheadScrubDragRef.current.scrubSession
        );
        if (moved != null) {
          applyPlayheadScrubViewFollow(e.clientX, moved);
        }
      }
    },
    [
      applyPlayheadScrubViewFollow,
      clearPending,
      duration,
      peaks,
      playheadScrubDragRef,
      projectViewMode,
      seekTimelineAtClientX,
      viewPortion,
      viewPortionRef,
    ]
  );

  const onPlayheadLinePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = playheadScrubDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (!(e.buttons & 1)) return;
      const vp = viewPortionRef.current ?? viewPortion;
      const zoomed = vp < 1 - 1e-9;
      if (!drag.armed) {
        const dx = e.clientX - drag.originX;
        const dy = e.clientY - drag.originY;
        if (Math.hypot(dx, dy) < PLAYHEAD_SCRUB_ARM_PX) return;
        drag.armed = true;
        drag.scrubSession = beginPlaybackScrubSession();
      }
      e.preventDefault();
      const c = resolveActiveWaveCanvas(canvasRef);
      const canvasRect = c?.getBoundingClientRect();
      const inEdge =
        zoomed && canvasRect != null && isWaveEdgeScrollZone(e.clientX, canvasRect);
      if (inEdge) {
        applyPlayheadEdgeScrollAtClientX(e.clientX);
      }
      const moved = scrubAtClientX(e.clientX, { edgeLoop: zoomed });
      if (zoomed && moved != null && !inEdge) {
        applyPlayheadScrubViewFollow(e.clientX, moved);
      }
    },
    [
      applyPlayheadEdgeScrollAtClientX,
      applyPlayheadScrubViewFollow,
      canvasRef,
      playheadScrubDragRef,
      scrubAtClientX,
      viewPortion,
      viewPortionRef,
    ]
  );

  const endPlayheadLineDrag = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = playheadScrubDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      stopPlayheadEdgeScrollLoop();
      if (drag.armed) {
        suppressNextWaveSeekRef.current = true;
        scrubAtClientX(e.clientX);
        endPlaybackScrubSession(drag.scrubSession);
      } else {
        seekTimelineAtClientX(e.clientX);
        suppressNextWaveSeekRef.current = true;
      }
      playheadScrubDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [
      suppressNextWaveSeekRef,
      playheadScrubDragRef,
      scrubAtClientX,
      seekTimelineAtClientX,
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
