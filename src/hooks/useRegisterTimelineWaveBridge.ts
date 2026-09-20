import { useEffect, useMemo, useRef } from "react";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";
import type { TimelinePanelWaveHandlersBundleParams } from "./useTimelinePanelWaveHandlersBundle";
import type { TimelineWaveBridgeHandlers } from "../store/timelineWaveBridgeStore";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import {
  pickCueDragKindAtWave,
  resolveCueEdgeGrabPx,
  resolveWaveDrawView,
} from "../lib/timelineWaveGeometry";

type Handlers = TimelineWaveBridgeHandlers;

type ViewportControls = {
  setViewPortion: (portion: number) => void;
  setWaveViewStartOverride: (start: number | null) => void;
};

/** TimelinePanel の波形ハンドラを縦画面ポートレート波形へ共有 */
export function useRegisterTimelineWaveBridge(
  waveBundleParams: TimelinePanelWaveHandlersBundleParams,
  handlers: Handlers & {
    openGapRouteMenuAtPointer: (clientX: number, clientY: number) => void;
    openWaveCueMenuAtPointer: (clientX: number, clientY: number) => void;
  },
  viewport: ViewportControls,
  isPlaying: boolean
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const paramsRef = useRef(waveBundleParams);
  paramsRef.current = waveBundleParams;

  const stableHandlers = useMemo<Handlers>(
    () => ({
      onWaveCanvasPointerDown: (e) => handlersRef.current.onWaveCanvasPointerDown(e),
      onWaveCanvasPointerMove: (e) => handlersRef.current.onWaveCanvasPointerMove(e),
      onWaveCanvasPointerLeave: () => handlersRef.current.onWaveCanvasPointerLeave(),
      onWaveClick: (e) => handlersRef.current.onWaveClick(e),
      onWaveDoubleClick: (e) => handlersRef.current.onWaveDoubleClick(e),
      onWaveContextMenu: (e) => handlersRef.current.onWaveContextMenu(e),
    }),
    []
  );

  const drawWaveformAt = waveBundleParams.canvas.drawWaveformAt;
  const duration = waveBundleParams.playback.duration;
  const hasPeaks = (waveBundleParams.peaks?.length ?? 0) > 0;

  const isCueEdgeAtPointer = useMemo(
    () => (clientX: number, clientY: number) => {
      const p = paramsRef.current;
      const c = resolveActiveWaveCanvas(p.canvas.canvasRef);
      if (!c || duration <= 0) return false;
      const portion = Math.min(
        1,
        Math.max(0.02, p.canvas.viewPortionRef.current ?? p.viewport.viewPortion)
      );
      const playhead = p.canvas.currentTimePropRef.current;
      const override = p.canvas.waveViewStartOverrideRef.current;
      const drawView = resolveWaveDrawView({
        durationSec: duration,
        viewPortion: portion,
        anchorTimeSec: playhead,
        isPlaying,
        viewStartOverride: override,
      });
      const hit = pickCueDragKindAtWave(
        clientX,
        clientY,
        c,
        p.projectSlice.cuesSorted,
        drawView.start,
        drawView.span,
        p.canvas.cueDragPreviewRangeRef.current,
        resolveCueEdgeGrabPx(true),
        p.canvas.selectedCueIdsRef.current,
        true
      );
      return hit?.mode === "start" || hit?.mode === "end";
    },
    [duration, isPlaying]
  );

  useEffect(() => {
    useTimelineWaveBridgeStore.getState().register({
      handlers: stableHandlers,
      drawWaveformAt,
      setViewPortion: viewport.setViewPortion,
      setWaveViewStartOverride: viewport.setWaveViewStartOverride,
      openGapRouteMenuAtPointer: (clientX, clientY) =>
        handlersRef.current.openGapRouteMenuAtPointer(clientX, clientY),
      openWaveCueMenuAtPointer: (clientX, clientY) =>
        handlersRef.current.openWaveCueMenuAtPointer(clientX, clientY),
      isCueEdgeAtPointer,
      duration,
      isPlaying,
      hasPeaks,
    });
    return () => useTimelineWaveBridgeStore.getState().register(null);
  }, [
    stableHandlers,
    drawWaveformAt,
    viewport.setViewPortion,
    viewport.setWaveViewStartOverride,
    isCueEdgeAtPointer,
    duration,
    isPlaying,
    hasPeaks,
  ]);
}
