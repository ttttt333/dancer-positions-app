import { useCallback, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ChoreographyProjectJson, Cue } from "../types/choreography";
import {
  clampSeekTimeSec,
  cloneFormationForNewCue,
  resolveCueIntervalNonOverlap,
  applyCueWaveDragCommit,
  sortCuesByStart,
  trimHiSecForCueTimeline,
  trimPlaybackEndSec,
} from "../core/timelineController";
import { playbackEngine } from "../core/playbackEngine";
import {
  beginPlaybackScrubSession,
  endPlaybackScrubSession,
  seekPlaybackClampedAndSyncStore,
  seekPlaybackScrubAudible,
  syncPlaybackHeadAfterCueEdit,
  type PlaybackScrubSession,
} from "../lib/playbackTransport";
import {
  hitPlayheadStripForScrub,
  PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX,
  pickCueDragKindAtWave,
  resolveWaveViewForPointerHit,
  waveExtentXToTime,
  type CueDragEdgeMode,
} from "../lib/timelineWaveGeometry";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import { panWaveViewStartAtClientX } from "../lib/waveEdgeScrollDuringScrub";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";
import { PLAYHEAD_SCRUB_ARM_PX, WAVE_DRAG_ARM_PX } from "../lib/waveLongPress";

export type UseWaveCanvasPointerDragArgs = {
  projectViewMode: ChoreographyProjectJson["viewMode"];
  duration: number;
  peaks: number[] | null;
  canvasRef: RefObject<HTMLCanvasElement>;
  lastWaveDrawRangeRef: RefObject<{ viewStart: number; viewSpan: number }>;
  waveViewStartOverrideRef: RefObject<number | null>;
  trimStartSec: number;
  trimEndSec: number | null;
  currentTimePropRef: RefObject<number>;
  isPlayingForWaveRef: RefObject<boolean>;
  viewPortionRef: RefObject<number>;
  viewPortion: number;
  setWaveViewStartOverride: Dispatch<SetStateAction<number | null>>;
  drawWaveformAt: (playheadTime: number) => void;
  cuesSorted: Cue[];
  cuesRef: RefObject<Cue[]>;
  cueDragRef: RefObject<{
    pointerId: number;
    cueId: string;
    mode: CueDragEdgeMode;
    moved: boolean;
    armed: boolean;
    originX: number;
    originY: number;
    grabOffset: number;
    origStart: number;
    origEnd: number;
  } | null>;
  cueDragPreviewRangeRef: RefObject<{ cueId: string; tStart: number; tEnd: number } | null>;
  playheadScrubDragRef: RefObject<{
    pointerId: number;
    scrubSession: PlaybackScrubSession | null;
    originX: number;
    originY: number;
    armed: boolean;
  } | null>;
  emptyWaveDragRef: RefObject<{
    pointerId: number;
    startClientX: number;
    startT: number;
    trimLo: number;
    trimHi: number;
    active: boolean;
  } | null>;
  newCueRangePreviewRef: RefObject<{ tStart: number; tEnd: number } | null>;
  waveHoverCueRef: RefObject<{ cueId: string; mode: CueDragEdgeMode } | null>;
  setCurrentTime: (t: number) => void;
  onSelectedCueIdsChange: Dispatch<SetStateAction<string[]>>;
  suppressNextWaveSeekRef: RefObject<boolean>;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  durationRef: RefObject<number>;
  formationIdForNewCue: string;
  formations: ChoreographyProjectJson["formations"];
  onFormationChosenFromCueList?: () => void;
};

/**
 * 波形キャンバス上のポインタダウン（再生ヘッドスクラブ・キュー帯ドラッグ・空きドラッグ新規キュー）。
 */
export function useWaveCanvasPointerDrag({
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
  setProject,
  durationRef,
  formationIdForNewCue,
  formations,
  onFormationChosenFromCueList,
}: UseWaveCanvasPointerDragArgs) {
  const edgeScrollRafRef = useRef(0);
  const scrubClientXRef = useRef<number | null>(null);

  const applyEdgeScroll = useCallback(
    (clientX: number) => {
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c) return;
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
      });
      const vp = viewPortionRef.current ?? viewPortion;
      const nextStart = panWaveViewStartAtClientX({
        clientX,
        canvasRect: c.getBoundingClientRect(),
        viewStart,
        viewSpan,
        durationSec: duration,
        viewPortion: vp,
      });
      if (nextStart != null) {
        setWaveViewStartOverride(nextStart);
      }
    },
    [
      canvasRef,
      duration,
      currentTimePropRef,
      isPlayingForWaveRef,
      waveViewStartOverrideRef,
      setWaveViewStartOverride,
      viewPortion,
      viewPortionRef,
    ]
  );

  return useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (projectViewMode === "view" || duration <= 0 || !peaks) return;
      const c = e.currentTarget as HTMLCanvasElement;
      if (!c || c.tagName !== "CANVAS") return;
      const anchorSec = () => {
        if (
          isPlayingForWaveRef.current &&
          playbackEngine.getMediaSourceUrl() &&
          !playbackEngine.isPaused() &&
          Number.isFinite(playbackEngine.getCurrentTime())
        ) {
          return playbackEngine.getCurrentTime();
        }
        return currentTimePropRef.current;
      };
      const viewForPointer = () =>
        resolveWaveViewForPointerHit({
          durationSec: duration,
          viewPortion: viewPortionRef.current ?? viewPortion,
          isPlaying: isPlayingForWaveRef.current,
          viewStartOverride: waveViewStartOverrideRef.current,
          anchorTimeSec: anchorSec(),
        });
      const { viewStart, viewSpan } = viewForPointer();
      const trimLo = trimStartSec;
      const trimHi = trimPlaybackEndSec({
        trimEndSec,
        durationSec: duration,
        durationFallbackSec: duration,
      });
      const rawWaveTimeFromClientX = (clientX: number) => {
        const r = c.getBoundingClientRect();
        const x = clientX - r.left;
        const { viewStart: vs, viewSpan: vsp } = viewForPointer();
        return waveExtentXToTime(x, vs, vsp, r.width);
      };
      const timeFromClientX = (clientX: number) =>
        clampSeekTimeSec({
          t: rawWaveTimeFromClientX(clientX),
          trimStartSec: trimLo,
          trimEndSec,
          durationSec: duration,
          durationFallbackSec: duration,
        });
      const seekTimelineAtClientX = (clientX: number) => {
        const moved = seekPlaybackClampedAndSyncStore({
          t: rawWaveTimeFromClientX(clientX),
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
      const redraw = () => {
        let tRedraw = currentTimePropRef.current;
        if (
          isPlayingForWaveRef.current &&
          !playbackEngine.isPaused() &&
          Number.isFinite(playbackEngine.getCurrentTime())
        ) {
          tRedraw = playbackEngine.getCurrentTime();
        }
        drawWaveformAt(tRedraw);
      };

      let playheadSecForHit = currentTimePropRef.current;
      if (
        isPlayingForWaveRef.current &&
        playbackEngine.getMediaSourceUrl() &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
      ) {
        playheadSecForHit = playbackEngine.getCurrentTime();
      }

      const cueHit = pickCueDragKindAtWave(
        e.clientX,
        e.clientY,
        c,
        cuesSorted,
        viewStart,
        viewSpan,
        null
      );
      const cueId = cueHit?.cueId ?? null;
      if (cueId) {
        e.stopPropagation();
        waveHoverCueRef.current = null;
        const cue = cuesSorted.find((x) => x.id === cueId);
        if (!cue) return;
        onSelectedCueIdsChange([cueId]);
        const pointerT0 = timeFromClientX(e.clientX);
        const mode = cueHit?.mode ?? "move";
        const grabOffset = pointerT0 - cue.tStartSec;
        cueDragRef.current = {
          pointerId: e.pointerId,
          cueId,
          mode,
          moved: false,
          armed: false,
          originX: e.clientX,
          originY: e.clientY,
          grabOffset,
          origStart: cue.tStartSec,
          origEnd: cue.tEndSec,
        };
        cueDragPreviewRangeRef.current = { cueId, tStart: cue.tStartSec, tEnd: cue.tEndSec };
        const MIN_CUE_DUR = 0.05;
        const applyCueDragAtClientX = (clientX: number) => {
          const drag = cueDragRef.current;
          if (!drag) return;
          drag.moved = true;
          const cur = timeFromClientX(clientX);
          let ns = drag.origStart;
          let ne = drag.origEnd;
          if (drag.mode === "move") {
            const dur = drag.origEnd - drag.origStart;
            ns = cur - drag.grabOffset;
            ne = ns + dur;
            if (ne > trimHi) {
              ne = trimHi;
              ns = ne - dur;
            }
            if (ns < trimLo) {
              ns = trimLo;
              ne = ns + dur;
            }
            if (ne <= ns) ne = ns + MIN_CUE_DUR;
          } else if (drag.mode === "start") {
            ns = Math.max(trimLo, Math.min(cur, drag.origEnd - MIN_CUE_DUR));
            ne = drag.origEnd;
          } else {
            ne = Math.min(trimHi, Math.max(cur, drag.origStart + MIN_CUE_DUR));
            ns = drag.origStart;
          }
          cueDragPreviewRangeRef.current = {
            cueId,
            tStart: ns,
            tEnd: ne,
          };
          redraw();
        };
        if (useTimelineWaveBridgeStore.getState().portraitActive) {
          useTimelineWaveBridgeStore
            .getState()
            .setPortraitWaveEdgeScrollTick(applyCueDragAtClientX);
        }
        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== e.pointerId || !cueDragRef.current) return;
          const drag = cueDragRef.current;
          if (!drag.armed) {
            const dx = ev.clientX - drag.originX;
            const dy = ev.clientY - drag.originY;
            if (Math.hypot(dx, dy) < WAVE_DRAG_ARM_PX) return;
            drag.armed = true;
            try {
              c.setPointerCapture(ev.pointerId);
            } catch {
              /* ignore */
            }
            ev.preventDefault();
          }
          if (useTimelineWaveBridgeStore.getState().portraitActive) {
            useTimelineWaveBridgeStore.getState().portraitWaveScrubAtClientX?.(
              ev.clientX,
              false,
              false
            );
          }
          applyCueDragAtClientX(ev.clientX);
        };
        const onUp = (ev: PointerEvent) => {
          if (ev.pointerId !== e.pointerId || !cueDragRef.current) return;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          if (useTimelineWaveBridgeStore.getState().portraitActive) {
            useTimelineWaveBridgeStore.getState().portraitWaveScrubAtClientX?.(
              ev.clientX,
              true
            );
            useTimelineWaveBridgeStore.getState().setPortraitWaveEdgeScrollTick(null);
          }
          try {
            c.releasePointerCapture(ev.pointerId);
          } catch {
            /* ignore */
          }
          const drag = cueDragRef.current;
          cueDragRef.current = null;
          const preview = cueDragPreviewRangeRef.current;
          cueDragPreviewRangeRef.current = null;
          if (!drag) return;
          const { cueId: cid, mode: dragMode, moved, armed, origStart, origEnd } = drag;
          onSelectedCueIdsChange([cid]);
          if (!armed || !moved) {
            redraw();
            return;
          }
          suppressNextWaveSeekRef.current = true;
          if (
            preview &&
            Number.isFinite(preview.tStart) &&
            Number.isFinite(preview.tEnd) &&
            (Math.abs(preview.tStart - origStart) > 1e-4 ||
              Math.abs(preview.tEnd - origEnd) > 1e-4)
          ) {
            const previewStart = preview.tStart;
            const previewEnd = preview.tEnd;
            setProject((p) => {
              const trimHiNow = trimHiSecForCueTimeline(
                p.trimEndSec,
                durationRef.current
              );
              return {
                ...p,
                cues: applyCueWaveDragCommit(
                  p.cues,
                  cid,
                  dragMode,
                  previewStart,
                  previewEnd,
                  p.trimStartSec,
                  trimHiNow
                ),
              };
            });
          }
          redraw();
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
        redraw();
        return;
      }

      if (
        playbackEngine.getMediaSourceUrl() &&
        viewSpan > 0 &&
        hitPlayheadStripForScrub(
          e.clientX,
          c,
          viewStart,
          viewSpan,
          playheadSecForHit,
          duration,
          useTimelineWaveBridgeStore.getState().portraitActive
            ? PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX
            : undefined
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
        waveHoverCueRef.current = null;
        playheadScrubDragRef.current = {
          pointerId: e.pointerId,
          scrubSession: null,
          originX: e.clientX,
          originY: e.clientY,
          armed: false,
        };
        const capturePid = e.pointerId;
        c.setPointerCapture(capturePid);
        const onPhMove = (ev: PointerEvent) => {
          const drag = playheadScrubDragRef.current;
          if (ev.pointerId !== capturePid || !drag) return;
          if (!drag.armed) {
            const dx = ev.clientX - drag.originX;
            const dy = ev.clientY - drag.originY;
            if (Math.hypot(dx, dy) < PLAYHEAD_SCRUB_ARM_PX) return;
            drag.armed = true;
            drag.scrubSession = beginPlaybackScrubSession();
          }
          if (!playbackEngine.getMediaElement()) return;
          if (useTimelineWaveBridgeStore.getState().portraitActive) {
            useTimelineWaveBridgeStore.getState().portraitWaveScrubAtClientX?.(
              ev.clientX,
              false,
              false
            );
          } else {
            applyEdgeScroll(ev.clientX);
          }
          const tMoved = seekPlaybackScrubAudible({
            t: rawWaveTimeFromClientX(ev.clientX),
            durationSec: duration,
            trimStartSec: trimLo,
            trimEndSec,
            roundHeadForStore: true,
          });
          drawWaveformAt(tMoved ?? timeFromClientX(ev.clientX));
        };
        const onPhUp = (ev: PointerEvent) => {
          if (ev.pointerId !== capturePid || !playheadScrubDragRef.current) return;
          window.removeEventListener("pointermove", onPhMove);
          window.removeEventListener("pointerup", onPhUp);
          window.removeEventListener("pointercancel", onPhUp);
          const drag = playheadScrubDragRef.current;
          playheadScrubDragRef.current = null;
          try {
            c.releasePointerCapture(ev.pointerId);
          } catch {
            /* ignore */
          }
          if (!drag.armed) {
            redraw();
            return;
          }
          if (useTimelineWaveBridgeStore.getState().portraitActive) {
            useTimelineWaveBridgeStore.getState().portraitWaveScrubAtClientX?.(ev.clientX, true);
          }
          suppressNextWaveSeekRef.current = true;
          if (playbackEngine.getMediaElement()) {
            seekPlaybackScrubAudible({
              t: rawWaveTimeFromClientX(ev.clientX),
              durationSec: duration,
              trimStartSec: trimLo,
              trimEndSec,
              roundHeadForStore: true,
            });
            endPlaybackScrubSession(drag.scrubSession);
          }
          redraw();
        };
        window.addEventListener("pointermove", onPhMove);
        window.addEventListener("pointerup", onPhUp);
        window.addEventListener("pointercancel", onPhUp);
        return;
      }

      /** 縦画面: 空きドラッグ新規キューは使わない（タップ=シーク・ダブルタップ=追加） */
      if (useTimelineWaveBridgeStore.getState().portraitActive) {
        return;
      }

      e.stopPropagation();
      waveHoverCueRef.current = null;
      emptyWaveDragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startT: timeFromClientX(e.clientX),
        trimLo,
        trimHi,
        active: false,
      };
      newCueRangePreviewRef.current = null;
      const onEmptyMove = (ev: PointerEvent) => {
        const st = emptyWaveDragRef.current;
        if (!st || ev.pointerId !== st.pointerId) return;
        if (!st.active) {
          if (Math.abs(ev.clientX - st.startClientX) < WAVE_DRAG_ARM_PX) return;
          st.active = true;
          try {
            c.setPointerCapture(ev.pointerId);
          } catch {
            /* ignore */
          }
          ev.preventDefault();
        }
        const tCur = timeFromClientX(ev.clientX);
        const t0 = st.startT;
        newCueRangePreviewRef.current = { tStart: Math.min(t0, tCur), tEnd: Math.max(t0, tCur) };
        redraw();
      };
      const onEmptyUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId || !emptyWaveDragRef.current) return;
        window.removeEventListener("pointermove", onEmptyMove);
        window.removeEventListener("pointerup", onEmptyUp);
        window.removeEventListener("pointercancel", onEmptyUp);
        try {
          c.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        const st = emptyWaveDragRef.current;
        emptyWaveDragRef.current = null;
        const preview = newCueRangePreviewRef.current;
        newCueRangePreviewRef.current = null;
        if (st?.active) suppressNextWaveSeekRef.current = true;
        if (st && !st.active && playbackEngine.getMediaSourceUrl() && durationRef.current > 0) {
          seekTimelineAtClientX(ev.clientX);
          onSelectedCueIdsChange([]);
          suppressNextWaveSeekRef.current = true;
        }
        if (st?.active && preview && Number.isFinite(preview.tStart) && Number.isFinite(preview.tEnd)) {
          let ts = Math.round(Math.min(preview.tStart, preview.tEnd) * 100) / 100;
          let te = Math.round(Math.max(preview.tStart, preview.tEnd) * 100) / 100;
          if (te - ts < 0.1) {
            te = Math.round(Math.min(st.trimHi, ts + 0.1) * 100) / 100;
            if (te <= ts) ts = Math.round(Math.max(st.trimLo, te - 0.1) * 100) / 100;
          }
          if (te > ts && ts >= st.trimLo && te <= st.trimHi) {
            if (cuesSorted.length >= 100 || formations.length === 0) {
              redraw();
              return;
            }
            const newCueId = crypto.randomUUID();
            const rNew = resolveCueIntervalNonOverlap(cuesRef.current, newCueId, ts, te, st.trimLo, st.trimHi);
            const tsFinal = rNew.tStartSec;
            const teFinal = rNew.tEndSec;
            if (teFinal <= tsFinal + 1e-9) {
              redraw();
              return;
            }
            const appliedT = tsFinal;
            setProject((p) => {
              if (p.cues.length >= 100) return p;
              if (p.cues.some((c0) => c0.id === newCueId)) return p;
              const sourceF = p.formations.find((f) => f.id === formationIdForNewCue) ?? p.formations[0];
              if (!sourceF) return p;
              const newFm = cloneFormationForNewCue(sourceF);
              const cue: Cue = { id: newCueId, tStartSec: tsFinal, tEndSec: teFinal, formationId: newFm.id };
              return {
                ...p,
                formations: [...p.formations, newFm],
                cues: sortCuesByStart([...p.cues, cue]),
                activeFormationId: newFm.id,
              };
            });
            syncPlaybackHeadAfterCueEdit({
              t: appliedT,
              durationSec: durationRef.current,
              trimStartSec,
              trimEndSec,
            });
            onSelectedCueIdsChange([newCueId]);
            onFormationChosenFromCueList?.();
          }
        }
        redraw();
      };
      window.addEventListener("pointermove", onEmptyMove);
      window.addEventListener("pointerup", onEmptyUp);
      window.addEventListener("pointercancel", onEmptyUp);
      redraw();
    },
    [
      projectViewMode,
      duration,
      peaks,
      canvasRef,
      lastWaveDrawRangeRef,
      waveViewStartOverrideRef,
      viewPortionRef,
      viewPortion,
      applyEdgeScroll,
      trimStartSec,
      trimEndSec,
      currentTimePropRef,
      isPlayingForWaveRef,
      drawWaveformAt,
      cuesSorted,
      waveHoverCueRef,
      playheadScrubDragRef,
      setCurrentTime,
      suppressNextWaveSeekRef,
      onSelectedCueIdsChange,
      cueDragRef,
      cueDragPreviewRangeRef,
      cuesRef,
      setProject,
      durationRef,
      emptyWaveDragRef,
      newCueRangePreviewRef,
      formations.length,
      formationIdForNewCue,
      onFormationChosenFromCueList,
    ]
  );
}
