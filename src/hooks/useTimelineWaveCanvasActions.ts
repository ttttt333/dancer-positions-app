import { useCallback, type MouseEvent } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { clampTimelineHeadForCueOps } from "../core/timelineController";
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

export type UseTimelineWaveCanvasActionsParams = {
  suppressNextWaveSeekRef: RefObject<boolean>;
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
};

/**
 * 波形キャンバス上のクリック・右クリック・ダブルクリック（キュー選択・ギャップメニュー・シーク・新規キュー）。
 */
export function useTimelineWaveCanvasActions({
  suppressNextWaveSeekRef,
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
}: UseTimelineWaveCanvasActionsParams) {
  const onWaveClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (suppressNextWaveSeekRef.current) {
        suppressNextWaveSeekRef.current = false;
        return;
      }
      const c = canvasRef.current;
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
      seekPlaybackClampedAndSyncStore({
        t,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
      });
    },
    [
      suppressNextWaveSeekRef,
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
      const c = canvasRef.current;
      if (!c) return;
      let viewStart = lastWaveDrawRangeRef.current.viewStart;
      let viewSpan = lastWaveDrawRangeRef.current.viewSpan;
      if (viewSpan <= 0) {
        const gv = getWaveViewForDraw(duration, viewPortion, currentTime);
        viewStart = gv.start;
        viewSpan = gv.span;
      }
      if (viewSpan <= 0) return;
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
        cueDragPreviewRangeRef.current
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
      const c = canvasRef.current;
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
      const t = waveExtentXToTime(x, viewStart, viewSpan, r.width);
      const clamped = clampTimelineHeadForCueOps(
        t,
        trimStartSec,
        trimEndSec,
        duration
      );
      e.preventDefault();
      e.stopPropagation();
      suppressNextWaveSeekRef.current = true;
      addCueStartingAtTime(clamped);
    },
    [
      viewMode,
      duration,
      peaks,
      canvasRef,
      lastWaveDrawRangeRef,
      viewPortion,
      currentTime,
      trimStartSec,
      trimEndSec,
      suppressNextWaveSeekRef,
      addCueStartingAtTime,
    ]
  );

  return { onWaveClick, onWaveContextMenu, onWaveDoubleClick };
}
