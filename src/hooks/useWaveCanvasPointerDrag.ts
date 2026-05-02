import { useCallback } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ChoreographyProjectJson, Cue } from "../types/choreography";
import { generateId } from "../lib/generateId";
import {
  clampSeekTimeSec,
  cloneFormationForNewCue,
  resolveCueIntervalNonOverlap,
  sortCuesByStart,
  trimHiSecForCueTimeline,
  trimPlaybackEndSec,
} from "../core/timelineController";
import { playbackEngine } from "../core/playbackEngine";
import {
  seekPlaybackClampedAndSyncStore,
  syncPlaybackHeadAfterCueEdit,
} from "../lib/playbackTransport";
import {
  hitPlayheadStripForScrub,
  pickCueDragKindAtWave,
  waveExtentXToTime,
  type CueDragEdgeMode,
} from "../lib/timelineWaveGeometry";

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
  drawWaveformAt: (playheadTime: number) => void;
  cuesSorted: Cue[];
  cuesRef: RefObject<Cue[]>;
  cueDragRef: RefObject<{
    pointerId: number;
    cueId: string;
    mode: CueDragEdgeMode;
    moved: boolean;
    grabOffset: number;
    origStart: number;
    origEnd: number;
  } | null>;
  cueDragPreviewRangeRef: RefObject<{ cueId: string; tStart: number; tEnd: number } | null>;
  playheadScrubDragRef: RefObject<{ pointerId: number; wasPlaying: boolean } | null>;
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
  void waveViewStartOverrideRef;
  void viewPortionRef;
  return useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (projectViewMode === "view" || duration <= 0 || !peaks) return;
      const c = canvasRef.current;
      if (!c) return;
      const { viewStart, viewSpan } = lastWaveDrawRangeRef.current;
      const trimLo = trimStartSec;
      const trimHi = trimPlaybackEndSec({
        trimEndSec,
        durationSec: duration,
        durationFallbackSec: duration,
      });
      const rawWaveTimeFromClientX = (clientX: number) => {
        const r = c.getBoundingClientRect();
        const x = clientX - r.left;
        return waveExtentXToTime(x, viewStart, viewSpan, r.width);
      };
      const timeFromClientX = (clientX: number) =>
        clampSeekTimeSec({
          t: rawWaveTimeFromClientX(clientX),
          trimStartSec: trimLo,
          trimEndSec,
          durationSec: duration,
          durationFallbackSec: duration,
        });
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
      if (
        playbackEngine.getMediaSourceUrl() &&
        viewSpan > 0 &&
        hitPlayheadStripForScrub(
          e.clientX,
          c,
          viewStart,
          viewSpan,
          playheadSecForHit,
          duration
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
        waveHoverCueRef.current = null;
        const wasPlaying = !playbackEngine.isPaused();
        playheadScrubDragRef.current = { pointerId: e.pointerId, wasPlaying };
        const t0e = seekPlaybackClampedAndSyncStore({
          t: rawWaveTimeFromClientX(e.clientX),
          durationSec: duration,
          trimStartSec: trimLo,
          trimEndSec,
          roundHeadForStore: true,
        });
        if (playbackEngine.isPaused()) {
          void playbackEngine.play();
        }
        const capturePid = e.pointerId;
        c.setPointerCapture(capturePid);
        const onPhMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capturePid || !playheadScrubDragRef.current) return;
          if (!playbackEngine.getMediaElement()) return;
          const tMoved = seekPlaybackClampedAndSyncStore({
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
          try {
            c.releasePointerCapture(ev.pointerId);
          } catch {
            /* ignore */
          }
          const drag = playheadScrubDragRef.current;
          playheadScrubDragRef.current = null;
          suppressNextWaveSeekRef.current = true;
          if (playbackEngine.getMediaElement()) {
            seekPlaybackClampedAndSyncStore({
              t: rawWaveTimeFromClientX(ev.clientX),
              durationSec: duration,
              trimStartSec: trimLo,
              trimEndSec,
              roundHeadForStore: true,
            });
            if (!drag?.wasPlaying) playbackEngine.pause();
          }
          redraw();
        };
        window.addEventListener("pointermove", onPhMove);
        window.addEventListener("pointerup", onPhUp);
        window.addEventListener("pointercancel", onPhUp);
        drawWaveformAt(t0e ?? timeFromClientX(e.clientX));
        return;
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
        e.preventDefault();
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
          grabOffset,
          origStart: cue.tStartSec,
          origEnd: cue.tEndSec,
        };
        cueDragPreviewRangeRef.current = { cueId, tStart: cue.tStartSec, tEnd: cue.tEndSec };
        c.setPointerCapture(e.pointerId);
        const MIN_CUE_DUR = 0.05;
        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== e.pointerId || !cueDragRef.current) return;
          cueDragRef.current.moved = true;
          const drag = cueDragRef.current;
          const cur = timeFromClientX(ev.clientX);
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
            ns = Math.round(cur * 100) / 100;
            ns = Math.max(trimLo, Math.min(ns, drag.origEnd - MIN_CUE_DUR));
            ne = drag.origEnd;
          } else {
            ne = Math.round(cur * 100) / 100;
            ne = Math.min(trimHi, Math.max(ne, drag.origStart + MIN_CUE_DUR));
            ns = drag.origStart;
          }
          ns = Math.round(ns * 100) / 100;
          ne = Math.round(ne * 100) / 100;
          const resolved = resolveCueIntervalNonOverlap(cuesRef.current, cueId, ns, ne, trimLo, trimHi);
          cueDragPreviewRangeRef.current = {
            cueId,
            tStart: resolved.tStartSec,
            tEnd: resolved.tEndSec,
          };
          redraw();
        };
        const onUp = (ev: PointerEvent) => {
          if (ev.pointerId !== e.pointerId || !cueDragRef.current) return;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          try {
            c.releasePointerCapture(ev.pointerId);
          } catch {
            /* ignore */
          }
          const drag = cueDragRef.current;
          cueDragRef.current = null;
          const preview = cueDragPreviewRangeRef.current;
          cueDragPreviewRangeRef.current = null;
          suppressNextWaveSeekRef.current = true;
          if (!drag) return;
          const { cueId: cid, moved, origStart, origEnd } = drag;
          onSelectedCueIdsChange([cid]);
          if (
            preview &&
            Number.isFinite(preview.tStart) &&
            Number.isFinite(preview.tEnd) &&
            moved &&
            (Math.abs(preview.tStart - origStart) > 1e-4 || Math.abs(preview.tEnd - origEnd) > 1e-4)
          ) {
            const ns = preview.tStart;
            const ne = preview.tEnd;
            setProject((p) => {
              const trimHiNow = trimHiSecForCueTimeline(
                p.trimEndSec,
                durationRef.current
              );
              const r = resolveCueIntervalNonOverlap(p.cues, cid, ns, ne, p.trimStartSec, trimHiNow);
              return {
                ...p,
                cues: sortCuesByStart(
                  p.cues.map((x) => (x.id === cid ? { ...x, tStartSec: r.tStartSec, tEndSec: r.tEndSec } : x))
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

      e.preventDefault();
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
      c.setPointerCapture(e.pointerId);
      const onEmptyMove = (ev: PointerEvent) => {
        const st = emptyWaveDragRef.current;
        if (!st || ev.pointerId !== st.pointerId) return;
        if (!st.active) {
          if (Math.abs(ev.clientX - st.startClientX) < 5) return;
          st.active = true;
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
          const cnv = canvasRef.current;
          if (cnv) {
            const { viewStart: vs, viewSpan: vsp } = lastWaveDrawRangeRef.current;
            if (vsp > 0) {
              const rr = cnv.getBoundingClientRect();
              if (rr.width > 0) {
                let tSeek = waveExtentXToTime(ev.clientX - rr.left, vs, vsp, rr.width);
                tSeek = Math.max(st.trimLo, Math.min(st.trimHi, tSeek));
                if (playbackEngine.getMediaElement()) {
                  playbackEngine.seek(tSeek);
                  setCurrentTime(tSeek);
                }
                onSelectedCueIdsChange([]);
                suppressNextWaveSeekRef.current = true;
                redraw();
              }
            }
          }
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
            const newCueId = generateId();
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
