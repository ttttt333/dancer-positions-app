import { useCallback, type MouseEvent } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  clampTimelineHeadForCueOps,
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
} from "../core/timelineController";
import { playbackEngine } from "../core/playbackEngine";
import { seekPlaybackClampedAndSyncStore } from "../lib/playbackTransport";
import {
  getWaveViewForDraw,
  pickGapLinkAtWave,
  pickCueIdAtWave,
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
  currentTime,
  lastWaveDrawRangeRef,
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
  const onWaveClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (suppressNextWaveSeekRef.current) {
        suppressNextWaveSeekRef.current = false;
        return;
      }
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c || duration <= 0 || !playbackEngine.getMediaSourceUrl()) return;
      const d = duration;
      let viewStart = lastWaveDrawRangeRef.current.viewStart;
      let viewSpan = lastWaveDrawRangeRef.current.viewSpan;
      if (viewSpan <= 0) {
        const vp = viewPortion;
        const gv = getWaveViewForDraw(d, vp, currentTime);
        viewStart = gv.start;
        viewSpan = gv.span;
      }
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
      suppressNextWaveSeekRef,
      currentTimePropRef,
      drawWaveformAt,
      canvasRef,
      duration,
      viewPortion,
      currentTime,
      lastWaveDrawRangeRef,
      peaks,
      cuesSorted,
      cueDragPreviewRangeRef,
      onSelectedCueIdsChange,
      viewMode,
      trimStartSec,
      trimEndSec,
      setWaveCueMenu,
      setGapRouteMenu,
    ]
  );

  const onWaveContextMenu = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (viewMode === "view" || duration <= 0 || !peaks) return;
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
      canvasRef,
      lastWaveDrawRangeRef,
      viewPortion,
      currentTime,
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
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c || !playbackEngine.getMediaSourceUrl()) return;
      let viewStart = lastWaveDrawRangeRef.current.viewStart;
      let viewSpan = lastWaveDrawRangeRef.current.viewSpan;
      if (viewSpan <= 0) {
        const gv = getWaveViewForDraw(duration, viewPortion, currentTime);
        viewStart = gv.start;
        viewSpan = gv.span;
      }
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
      canvasRef,
      lastWaveDrawRangeRef,
      viewPortion,
      currentTime,
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
      let viewStart = lastWaveDrawRangeRef.current.viewStart;
      let viewSpan = lastWaveDrawRangeRef.current.viewSpan;
      if (viewSpan <= 0) {
        const gv = getWaveViewForDraw(duration, viewPortion, currentTime);
        viewStart = gv.start;
        viewSpan = gv.span;
      }
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
      lastWaveDrawRangeRef,
      viewPortion,
      currentTime,
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
