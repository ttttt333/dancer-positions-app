import { useCallback, useRef } from "react";
import type { MouseEvent, PointerEvent, RefObject } from "react";
import type { Cue, ChoreographyProjectJson } from "../types/choreography";
import { playbackEngine } from "../core/playbackEngine";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import {
  hitPlayheadStripForScrub,
  pickCueDragKindAtWave,
  pickGapLinkAtWave,
} from "../lib/timelineWaveGeometry";
import {
  PC_GAP_LONG_PRESS_PAD_PX,
  synthMouseEventFromPointer,
  WAVE_DRAG_ARM_PX,
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
  dragArmed: boolean;
  hasCueBody: boolean;
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
  onWaveContextMenu: (e: MouseEvent<HTMLCanvasElement>) => void;
  basePointerDown: (e: PointerEvent<HTMLCanvasElement>) => void;
};

/**
 * PC 波形: キュー帯・キュー間動線を長押しで設定メニューを開く。
 * 端末ドラッグ（キュー移動）は従来どおり、少し動かすと開始する。
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
  onWaveContextMenu,
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

      if (cueHit && (cueHit.mode === "start" || cueHit.mode === "end")) {
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

      const cueBodyHit = cueHit?.mode === "move";
      if (!cueBodyHit && !gapHit) {
        basePointerDown(e);
        return;
      }

      clearPending();
      const pointerId = e.pointerId;
      const originX = e.clientX;
      const originY = e.clientY;
      const downEvent = e;

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

        window.clearTimeout(pending.timer);

        if (pending.hasCueBody && !pending.dragArmed && dist > WAVE_DRAG_ARM_PX) {
          pending.dragArmed = true;
          pendingRef.current = null;
          cleanupListeners();
          basePointerDown(downEvent);
          return;
        }

        pendingRef.current = null;
        cleanupListeners();
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        clearPending();
      };

      const timer = window.setTimeout(() => {
        if (!pendingRef.current || pendingRef.current.pointerId !== pointerId) return;
        pendingRef.current = null;
        cleanupListeners();
        suppressNextWaveSeekRef.current = true;
        onWaveContextMenu(synthMouseEventFromPointer("contextmenu", downEvent));
      }, WAVE_LONG_PRESS_MS);

      pendingRef.current = {
        timer,
        pointerId,
        originX,
        originY,
        downEvent,
        dragArmed: false,
        hasCueBody: cueBodyHit,
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
      onWaveContextMenu,
      peaks,
      projectViewMode,
      suppressNextWaveSeekRef,
    ]
  );

  return { onWaveCanvasPointerDown, clearPending };
}
