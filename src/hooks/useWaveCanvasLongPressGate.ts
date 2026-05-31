import { useCallback, useRef } from "react";
import type { PointerEvent, RefObject } from "react";
import type { Cue, ChoreographyProjectJson } from "../types/choreography";
import { playbackEngine } from "../core/playbackEngine";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import {
  hitPlayheadStripForScrub,
  pickCueDragKindAtWave,
  pickGapLinkAtWave,
} from "../lib/timelineWaveGeometry";
import { PC_GAP_LONG_PRESS_PAD_PX } from "../lib/waveLongPress";
import {
  WAVE_LONG_PRESS_CANCEL_PX,
  WAVE_LONG_PRESS_MS,
} from "../lib/waveLongPress";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";

type PendingLongPress = {
  timer: number;
  pointerId: number;
  originX: number;
  originY: number;
  downEvent: PointerEvent<HTMLCanvasElement>;
};

export type UseWaveCanvasLongPressGateArgs = {
  projectViewMode: ChoreographyProjectJson["viewMode"];
  duration: number;
  peaks: number[] | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  lastWaveDrawRangeRef: RefObject<{ viewStart: number; viewSpan: number }>;
  cuesSorted: Cue[];
  cueDragPreviewRangeRef: RefObject<{ cueId: string; tStart: number; tEnd: number } | null>;
  currentTimePropRef: RefObject<number>;
  isPlayingForWaveRef: RefObject<boolean>;
  suppressNextWaveSeekRef: RefObject<boolean>;
  /** キュー間の動線のみ（長押し）。短いタップでは再生位置を移動 */
  seekTimelineAtClientX: (clientX: number) => void;
  openGapRouteMenuAtPointer: (clientX: number, clientY: number) => void;
  basePointerDown: (e: PointerEvent<HTMLCanvasElement>) => void;
};

/**
 * PC 波形: キュー同士の間だけ長押しで動線メニュー。キュー帯本体の長押しは無効。
 */
export function useWaveCanvasLongPressGate({
  projectViewMode,
  duration,
  peaks,
  canvasRef,
  lastWaveDrawRangeRef,
  cuesSorted,
  cueDragPreviewRangeRef,
  currentTimePropRef,
  isPlayingForWaveRef,
  suppressNextWaveSeekRef,
  seekTimelineAtClientX,
  openGapRouteMenuAtPointer,
  basePointerDown,
}: UseWaveCanvasLongPressGateArgs) {
  const pendingRef = useRef<PendingLongPress | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const clearPending = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (pendingRef.current != null) {
      window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    }
  }, []);

  const onWaveCanvasPointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (useTimelineWaveBridgeStore.getState().portraitActive) {
        basePointerDown(e);
        return;
      }
      if (e.button !== 0 || projectViewMode === "view" || duration <= 0 || !peaks) {
        basePointerDown(e);
        return;
      }

      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c) {
        basePointerDown(e);
        return;
      }

      const { viewStart, viewSpan } = lastWaveDrawRangeRef.current;
      if (viewSpan <= 0) {
        basePointerDown(e);
        return;
      }

      let playheadSec = currentTimePropRef.current;
      if (
        isPlayingForWaveRef.current &&
        playbackEngine.getMediaSourceUrl() &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
      ) {
        playheadSec = playbackEngine.getCurrentTime();
      }

      if (
        playbackEngine.getMediaSourceUrl() &&
        hitPlayheadStripForScrub(
          e.clientX,
          c,
          viewStart,
          viewSpan,
          playheadSec,
          duration
        )
      ) {
        basePointerDown(e);
        return;
      }

      const cueHit = pickCueDragKindAtWave(
        e.clientX,
        e.clientY,
        c,
        cuesSorted,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current
      );

      if (cueHit) {
        basePointerDown(e);
        return;
      }

      const gapHit =
        cuesSorted.length >= 2
          ? pickGapLinkAtWave(
              e.clientX,
              e.clientY,
              c,
              cuesSorted,
              viewStart,
              viewSpan,
              cueDragPreviewRangeRef.current,
              PC_GAP_LONG_PRESS_PAD_PX
            )
          : null;

      if (!gapHit) {
        basePointerDown(e);
        return;
      }

      clearPending();
      const pointerId = e.pointerId;
      const originX = e.clientX;
      const originY = e.clientY;
      let longPressFired = false;

      const cleanupListeners = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      const onMove = (ev: PointerEvent) => {
        const pending = pendingRef.current;
        if (!pending || ev.pointerId !== pointerId) return;
        const dist = Math.hypot(ev.clientX - originX, ev.clientY - originY);
        if (dist <= WAVE_LONG_PRESS_CANCEL_PX) return;
        pendingRef.current = null;
        cleanupListeners();
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const hadPending = pendingRef.current != null;
        clearPending();
        if (hadPending && !longPressFired) {
          seekTimelineAtClientX(originX);
          suppressNextWaveSeekRef.current = true;
        }
      };

      const timer = window.setTimeout(() => {
        if (!pendingRef.current || pendingRef.current.pointerId !== pointerId) return;
        pendingRef.current = null;
        longPressFired = true;
        cleanupListeners();
        suppressNextWaveSeekRef.current = true;
        openGapRouteMenuAtPointer(originX, originY);
      }, WAVE_LONG_PRESS_MS);

      pendingRef.current = {
        timer,
        pointerId,
        originX,
        originY,
        downEvent: e,
      };
      cleanupRef.current = cleanupListeners;

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      basePointerDown,
      canvasRef,
      clearPending,
      cueDragPreviewRangeRef,
      cuesSorted,
      currentTimePropRef,
      duration,
      isPlayingForWaveRef,
      lastWaveDrawRangeRef,
      openGapRouteMenuAtPointer,
      peaks,
      projectViewMode,
      seekTimelineAtClientX,
      suppressNextWaveSeekRef,
    ]
  );

  return { onWaveCanvasPointerDown, clearPending };
}
