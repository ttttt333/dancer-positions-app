import { useCallback, useRef } from "react";
import type { PointerEvent, RefObject } from "react";
import type { Cue, ChoreographyProjectJson } from "../types/choreography";
import { playbackEngine } from "../core/playbackEngine";
import { resolveWavePointerCanvas } from "../lib/activeWaveCanvas";
import {
  hitPlayheadStripForScrub,
  pickCueDragKindAtWave,
  pickGapLinkAtWave,
  resolvePlayheadSecForWaveInteraction,
  resolveWaveViewForPointerHit,
} from "../lib/timelineWaveGeometry";
import { PC_GAP_LONG_PRESS_PAD_PX } from "../lib/waveLongPress";
import {
  isWaveDoubleClickFollowUp,
  tryArmWaveDoubleClickOnPointerDown,
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
  peaksRef: RefObject<number[] | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  lastWaveDrawRangeRef: RefObject<{ viewStart: number; viewSpan: number }>;
  waveViewStartOverrideRef: RefObject<number | null>;
  viewPortionRef: RefObject<number>;
  viewPortion: number;
  cuesSorted: Cue[];
  cueDragPreviewRangeRef: RefObject<{ cueId: string; tStart: number; tEnd: number } | null>;
  currentTimePropRef: RefObject<number>;
  isPlayingForWaveRef: RefObject<boolean>;
  playheadScrubDragRef: RefObject<{ armed: boolean } | null>;
  cueDragRef: RefObject<{ armed?: boolean } | null>;
  suppressNextWaveSeekRef: RefObject<boolean>;
  wavePointerGestureRef: RefObject<{ lastPointerUpAtMs: number }>;
  /** キュー間の動線のみ（長押し）。短いタップでは再生位置を移動 */
  seekTimelineAtClientX: (clientX: number) => void;
  openGapRouteMenuAtPointer: (clientX: number, clientY: number) => void;
  basePointerDown: (e: PointerEvent<HTMLCanvasElement>) => void;
  commitWaveDoubleClickAt: (clientX: number, clientY: number) => void;
};

/**
 * PC 波形: キュー同士の間だけ長押しで動線メニュー。キュー帯本体の長押しは無効。
 */
export function useWaveCanvasLongPressGate({
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
  currentTimePropRef,
  isPlayingForWaveRef,
  playheadScrubDragRef,
  cueDragRef,
  suppressNextWaveSeekRef,
  wavePointerGestureRef,
  seekTimelineAtClientX,
  openGapRouteMenuAtPointer,
  basePointerDown,
  commitWaveDoubleClickAt,
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
      if (e.button !== 0 || projectViewMode === "view" || duration <= 0) {
        basePointerDown(e);
        return;
      }
      const peaksReady = peaks ?? peaksRef.current;
      if (!peaksReady) {
        basePointerDown(e);
        return;
      }

      const c = resolveWavePointerCanvas(canvasRef, e.currentTarget);
      if (!c) {
        basePointerDown(e);
        return;
      }

      let anchorSec = currentTimePropRef.current;
      if (
        isPlayingForWaveRef.current &&
        playbackEngine.getMediaSourceUrl() &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
      ) {
        anchorSec = playbackEngine.getCurrentTime();
      }

      const { viewStart, viewSpan } = resolveWaveViewForPointerHit({
        durationSec: duration,
        viewPortion: viewPortionRef.current ?? viewPortion,
        isPlaying: isPlayingForWaveRef.current,
        viewStartOverride: waveViewStartOverrideRef.current,
        anchorTimeSec: anchorSec,
        playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
        cueDragArmed: cueDragRef.current?.armed ?? false,
        enginePaused:
          !isPlayingForWaveRef.current || playbackEngine.isPaused(),
        lastDrawRange: lastWaveDrawRangeRef.current,
      });
      if (viewSpan <= 0) {
        basePointerDown(e);
        return;
      }

      const engineSec =
        playbackEngine.getMediaSourceUrl() &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
          ? playbackEngine.getCurrentTime()
          : null;
      const playheadSec = resolvePlayheadSecForWaveInteraction({
        currentTimePropSec: currentTimePropRef.current,
        isPlayingForWave: isPlayingForWaveRef.current,
        playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
        engineTimeSec: engineSec,
      });

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

      const zoomedPc =
        (viewPortionRef.current ?? viewPortion) < 1 - 1e-9 &&
        !useTimelineWaveBridgeStore.getState().portraitActive;

      if (
        !zoomedPc &&
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

      if (
        tryArmWaveDoubleClickOnPointerDown({
          wavePointerGestureRef,
          suppressNextWaveSeekRef,
          pointerId: e.pointerId,
          clientX: e.clientX,
          clientY: e.clientY,
          onCommit: commitWaveDoubleClickAt,
        })
      ) {
        e.preventDefault();
        e.stopPropagation();
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
        const downEvent = pending.downEvent;
        pendingRef.current = null;
        cleanupListeners();
        if (!longPressFired) {
          basePointerDown(downEvent);
        }
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const hadPending = pendingRef.current != null;
        clearPending();
        if (hadPending && !longPressFired) {
          const now = performance.now();
          const dblFollowUp = isWaveDoubleClickFollowUp(
            wavePointerGestureRef.current.lastPointerUpAtMs,
            now
          );
          wavePointerGestureRef.current.lastPointerUpAtMs = now;
          if (dblFollowUp) {
            commitWaveDoubleClickAt(originX, originY);
            suppressNextWaveSeekRef.current = true;
          } else {
            seekTimelineAtClientX(originX);
            suppressNextWaveSeekRef.current = true;
          }
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
      cueDragRef,
      cuesSorted,
      currentTimePropRef,
      duration,
      isPlayingForWaveRef,
      lastWaveDrawRangeRef,
      playheadScrubDragRef,
      waveViewStartOverrideRef,
      viewPortionRef,
      viewPortion,
      openGapRouteMenuAtPointer,
      peaks,
      peaksRef,
      projectViewMode,
      seekTimelineAtClientX,
      suppressNextWaveSeekRef,
      wavePointerGestureRef,
      commitWaveDoubleClickAt,
    ]
  );

  return { onWaveCanvasPointerDown, clearPending };
}
