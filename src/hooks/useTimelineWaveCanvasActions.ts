import { useCallback, type MouseEvent } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  clampTimelineHeadForCueOps,
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
} from "../core/timelineController";
import { playbackEngine } from "../core/playbackEngine";
import { commitWaveTimelineSeekAtClientX } from "../lib/waveTimelineSeek";
import {
  pickGapLinkAtWave,
  pickCueIdAtWave,
  resolveWaveViewForPointerHit,
  waveExtentXToTime,
} from "../lib/timelineWaveGeometry";
import type { Cue, ChoreographyProjectJson } from "../types/choreography";
import type {
  GapRouteMenuState,
  WaveCueConfirmState,
  WaveCueMenuState,
} from "../components/TimelineWaveMenus";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import { WAVE_DOUBLE_CLICK_CUE_SPAN_SEC } from "../lib/cueInterval";
import { PC_GAP_LONG_PRESS_PAD_PX } from "../lib/waveLongPress";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";

/** スマホ縦画面: キュー間タップ／長押しの当たり判定余白 */
const MOBILE_GAP_TOUCH_PADDING_PX = 40;

export type UseTimelineWaveCanvasActionsParams = {
  suppressNextWaveSeekRef: RefObject<boolean>;
  currentTimePropRef: RefObject<number>;
  drawWaveformAt: (playheadTime: number) => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  duration: number;
  viewPortion: number;
  viewPortionRef: RefObject<number>;
  waveViewStartOverrideRef: RefObject<number | null>;
  setWaveViewStartOverride: React.Dispatch<React.SetStateAction<number | null>>;
  isPlayingForWaveRef: RefObject<boolean>;
  playheadScrubDragRef: RefObject<{ armed: boolean } | null>;
  currentTime: number;
  lastWaveDrawRangeRef: RefObject<{ viewStart: number; viewSpan: number }>;
  peaks: number[] | null;
  cuesSorted: Cue[];
  cueDragPreviewRangeRef: RefObject<{ cueId: string; tStart: number; tEnd: number } | null>;
  onSelectedCueIdsChange: Dispatch<SetStateAction<string[]>>;
  viewMode: ChoreographyProjectJson["viewMode"];
  trimStartSec: number;
  trimEndSec: number | null;
  setWaveCueMenu: Dispatch<SetStateAction<WaveCueMenuState>>;
  setGapRouteMenu: Dispatch<SetStateAction<GapRouteMenuState>>;
  setWaveCueConfirm: Dispatch<SetStateAction<WaveCueConfirmState>>;
  addCueStartingAtTime: (tSec: number) => void;
  duplicateCueAfterSource: (source: Cue) => void;
};

/**
 * 波形キャンバス上のクリック・右クリック・ダブルクリック（キュー選択・ギャップメニュー・シーク・新規キュー）。
 */
export function useTimelineWaveCanvasActions({
  suppressNextWaveSeekRef,
  currentTimePropRef,
  drawWaveformAt,
  canvasRef,
  duration,
  viewPortion,
  viewPortionRef,
  waveViewStartOverrideRef,
  setWaveViewStartOverride,
  isPlayingForWaveRef,
  playheadScrubDragRef,
  peaks,
  cuesSorted,
  cueDragPreviewRangeRef,
  onSelectedCueIdsChange,
  viewMode,
  trimStartSec,
  trimEndSec,
  setWaveCueMenu,
  setGapRouteMenu,
  setWaveCueConfirm,
  addCueStartingAtTime,
  duplicateCueAfterSource,
}: UseTimelineWaveCanvasActionsParams) {
  const waveViewAtPointer = useCallback(() => {
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
      lastDrawRange: lastWaveDrawRangeRef.current,
    });
  }, [
    currentTimePropRef,
    duration,
    isPlayingForWaveRef,
    lastWaveDrawRangeRef,
    playheadScrubDragRef,
    viewPortion,
    viewPortionRef,
    waveViewStartOverrideRef,
  ]);

  const onWaveClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (suppressNextWaveSeekRef.current) {
        suppressNextWaveSeekRef.current = false;
        return;
      }
      const c = e.currentTarget as HTMLCanvasElement;
      if (!c || duration <= 0) return;
      const { viewStart, viewSpan } = waveViewAtPointer();
      if (viewSpan <= 0) return;
      const hitId =
        peaks != null && cuesSorted.length > 0
          ? pickCueIdAtWave(
              e.clientX,
              e.clientY,
              c,
              cuesSorted,
              viewStart,
              viewSpan,
              cueDragPreviewRangeRef.current
            )
          : null;
      if (hitId) {
        if (e.metaKey || e.ctrlKey) {
          onSelectedCueIdsChange((prev) =>
            prev.includes(hitId) ? prev.filter((x) => x !== hitId) : [...prev, hitId]
          );
        } else {
          onSelectedCueIdsChange([hitId]);
        }
      } else {
        onSelectedCueIdsChange([]);
      }
      if (!playbackEngine.getMediaSourceUrl()) return;
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const t = waveExtentXToTime(x, viewStart, viewSpan, r.width);
      if (e.altKey && peaks != null && cuesSorted.length >= 2 && viewMode !== "view") {
        const gapHit = pickGapLinkAtWave(
          e.clientX,
          e.clientY,
          c,
          cuesSorted,
          viewStart,
          viewSpan,
          cueDragPreviewRangeRef.current
        );
        if (gapHit) {
          setWaveCueMenu(null);
          setGapRouteMenu({
            nextCueId: gapHit.nextCueId,
            clientX: e.clientX,
            clientY: e.clientY,
          });
          onSelectedCueIdsChange([gapHit.nextCueId]);
          return;
        }
      }
      const moved = commitWaveTimelineSeekAtClientX({
        clientX: e.clientX,
        canvas: c,
        durationSec: duration,
        viewPortion: viewPortionRef.current ?? viewPortion,
        isPlaying: isPlayingForWaveRef.current,
        viewStartOverride: waveViewStartOverrideRef.current,
        anchorTimeSec: isPlayingForWaveRef.current &&
          !playbackEngine.isPaused() &&
          Number.isFinite(playbackEngine.getCurrentTime())
          ? playbackEngine.getCurrentTime()
          : currentTimePropRef.current,
        playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
        enginePaused:
          !isPlayingForWaveRef.current || playbackEngine.isPaused(),
        trimStartSec,
        trimEndSec,
        setWaveViewStartOverride,
        lastDrawRange: lastWaveDrawRangeRef.current,
      });
      if (moved != null) {
        currentTimePropRef.current = moved;
        drawWaveformAt(moved);
      }
    },
    [
      suppressNextWaveSeekRef,
      currentTimePropRef,
      drawWaveformAt,
      canvasRef,
      duration,
      viewPortion,
      viewPortionRef,
      waveViewAtPointer,
      peaks,
      cuesSorted,
      cueDragPreviewRangeRef,
      onSelectedCueIdsChange,
      viewMode,
      trimStartSec,
      trimEndSec,
      setWaveCueMenu,
      setGapRouteMenu,
      setWaveViewStartOverride,
      isPlayingForWaveRef,
      playheadScrubDragRef,
      lastWaveDrawRangeRef,
      waveViewStartOverrideRef,
    ]
  );

  const onWaveContextMenu = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (viewMode === "view" || duration <= 0 || !peaks) return;
      const c = e.currentTarget as HTMLCanvasElement;
      if (!c) return;
      const { viewStart, viewSpan } = waveViewAtPointer();
      if (viewSpan <= 0) return;
      const portraitActive = useTimelineWaveBridgeStore.getState().portraitActive;
      const gapTouchPad = portraitActive ? MOBILE_GAP_TOUCH_PADDING_PX : 0;

      if (portraitActive) {
        const gapLink = pickGapLinkAtWave(
          e.clientX,
          e.clientY,
          c,
          cuesSorted,
          viewStart,
          viewSpan,
          cueDragPreviewRangeRef.current,
          gapTouchPad
        );
        if (gapLink) {
          e.preventDefault();
          e.stopPropagation();
          setWaveCueMenu(null);
          setWaveCueConfirm(null);
          onSelectedCueIdsChange([gapLink.nextCueId]);
          setGapRouteMenu({
            nextCueId: gapLink.nextCueId,
            clientX: e.clientX,
            clientY: e.clientY,
            fullscreen: true,
          });
          return;
        }
      }

      const id = pickCueIdAtWave(
        e.clientX,
        e.clientY,
        c,
        cuesSorted,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current
      );
      if (id) {
        e.preventDefault();
        e.stopPropagation();
        setGapRouteMenu(null);
        onSelectedCueIdsChange([id]);
        setWaveCueConfirm(null);
        setWaveCueMenu({ cueId: id, clientX: e.clientX, clientY: e.clientY });
        return;
      }
      const gapLink = pickGapLinkAtWave(
        e.clientX,
        e.clientY,
        c,
        cuesSorted,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current,
        gapTouchPad
      );
      if (!gapLink) return;
      e.preventDefault();
      e.stopPropagation();
      setWaveCueMenu(null);
      setWaveCueConfirm(null);
      onSelectedCueIdsChange([gapLink.nextCueId]);
      setGapRouteMenu({
        nextCueId: gapLink.nextCueId,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    [
      viewMode,
      duration,
      peaks,
      waveViewAtPointer,
      cuesSorted,
      cueDragPreviewRangeRef,
      onSelectedCueIdsChange,
      setGapRouteMenu,
      setWaveCueConfirm,
      setWaveCueMenu,
    ]
  );

  const onWaveDoubleClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (viewMode === "view" || duration <= 0 || !peaks) return;
      const c = e.currentTarget as HTMLCanvasElement;
      if (!c) return;
      const { viewStart, viewSpan } = waveViewAtPointer();
      if (viewSpan <= 0) return;
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const hitId = pickCueIdAtWave(
        e.clientX,
        e.clientY,
        c,
        cuesSorted,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current
      );
      e.preventDefault();
      e.stopPropagation();
      suppressNextWaveSeekRef.current = true;
      if (hitId) {
        const source = cuesSorted.find((c0) => c0.id === hitId);
        if (source) {
          duplicateCueAfterSource(source);
          return;
        }
      }
      if (!playbackEngine.getMediaSourceUrl()) return;
      const t = waveExtentXToTime(x, viewStart, viewSpan, r.width);
      const clamped = clampTimelineHeadForCueOps(
        t,
        trimStartSec,
        trimEndSec,
        duration
      );
      addCueStartingAtTime(clamped, WAVE_DOUBLE_CLICK_CUE_SPAN_SEC);
    },
    [
      viewMode,
      duration,
      peaks,
      waveViewAtPointer,
      cuesSorted,
      cueDragPreviewRangeRef,
      trimStartSec,
      trimEndSec,
      suppressNextWaveSeekRef,
      addCueStartingAtTime,
      duplicateCueAfterSource,
    ]
  );

  const openGapRouteMenuAtPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (viewMode === "view" || duration <= 0 || !peaks) return;
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c) return;
      const { viewStart, viewSpan } = waveViewAtPointer();
      if (viewSpan <= 0) return;
      const portraitActive = useTimelineWaveBridgeStore.getState().portraitActive;
      const gapTouchPad = portraitActive ? MOBILE_GAP_TOUCH_PADDING_PX : PC_GAP_LONG_PRESS_PAD_PX;
      const gapLink = pickGapLinkAtWave(
        clientX,
        clientY,
        c,
        cuesSorted,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current,
        gapTouchPad
      );
      if (!gapLink) return;
      setWaveCueMenu(null);
      setWaveCueConfirm(null);
      onSelectedCueIdsChange([gapLink.nextCueId]);
      setGapRouteMenu({
        nextCueId: gapLink.nextCueId,
        clientX,
        clientY,
        ...(portraitActive ? { fullscreen: true } : {}),
      });
    },
    [
      viewMode,
      duration,
      peaks,
      canvasRef,
      waveViewAtPointer,
      cuesSorted,
      cueDragPreviewRangeRef,
      onSelectedCueIdsChange,
      setGapRouteMenu,
      setWaveCueConfirm,
      setWaveCueMenu,
    ]
  );

  return { onWaveClick, onWaveContextMenu, onWaveDoubleClick, openGapRouteMenuAtPointer };
}
