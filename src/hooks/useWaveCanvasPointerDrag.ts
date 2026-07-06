import { useCallback, useEffect, useRef } from "react";
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
import { getLiveEngineTimeSecOrNull, getLivePlaybackHeadSec } from "../lib/playbackHead";
import {
  beginPlaybackScrubSession,
  endPlaybackScrubSession,
  syncPlaybackHeadAfterCueEdit,
  type PlaybackScrubSession,
} from "../lib/playbackTransport";
import {
  hitPlayheadStripForScrub,
  PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX,
  pickCueDragKindAtWave,
  resolvePlayheadSecForWaveInteraction,
  resolveWaveViewForPointerHit,
  waveExtentXToTime,
  waveTimeAtClientXWithViewLock,
  type CueDragEdgeMode,
  type WavePointerViewLock,
} from "../lib/timelineWaveGeometry";
import { resolveActiveWaveCanvas, resolveWavePointerCanvas } from "../lib/activeWaveCanvas";
import {
  CUE_DRAG_EDGE_SCROLL_PAN_STRENGTH,
  isWaveEdgeScrollZone,
  panWaveViewStartAtClientX,
  PLAYHEAD_SCRUB_EDGE_SCROLL_PAN_STRENGTH,
  WAVE_EDGE_SCROLL_ZONE_MIN_PX,
  WAVE_EDGE_SCROLL_ZONE_RATIO,
} from "../lib/waveEdgeScrollDuringScrub";
import {
  commitWaveTimelineSeekAtClientX,
  panWaveViewStartForPlayheadAtClientX,
} from "../lib/waveTimelineSeek";
import type { WaveSeekSnapLatch } from "../lib/waveSeekSnapLatch";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";
import {
  isWaveDoubleClickFollowUp,
  PLAYHEAD_SCRUB_ARM_PX,
  tryArmWaveDoubleClickOnPointerDown,
  WAVE_DRAG_ARM_PX,
} from "../lib/waveLongPress";

export type UseWaveCanvasPointerDragArgs = {
  projectViewMode: ChoreographyProjectJson["viewMode"];
  duration: number;
  peaks: number[] | null;
  peaksRef: RefObject<number[] | null>;
  canvasRef: RefObject<HTMLCanvasElement>;
  lastWaveDrawRangeRef: RefObject<{ viewStart: number; viewSpan: number }>;
  waveViewStartOverrideRef: RefObject<number | null>;
  trimStartSec: number;
  trimEndSec: number | null;
  currentTimePropRef: RefObject<number>;
  isPlayingForWaveRef: RefObject<boolean>;
  viewPortionRef: RefObject<number>;
  viewPortion: number;
  waveViewStartOverride: number | null;
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
    startCanvasWidth: number;
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
  waveSeekSnapLatchRef: RefObject<WaveSeekSnapLatch | null>;
  wavePointerGestureRef: RefObject<{ lastPointerUpAtMs: number }>;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  durationRef: RefObject<number>;
  formationIdForNewCue: string;
  formations: ChoreographyProjectJson["formations"];
  onFormationChosenFromCueList?: () => void;
  commitWaveDoubleClickAt: (clientX: number, clientY: number) => void;
};

/**
 * 波形キャンバス上のポインタダウン（再生ヘッドスクラブ・キュー帯ドラッグ・空きドラッグ新規キュー）。
 */
export function useWaveCanvasPointerDrag({
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
  waveViewStartOverride,
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
}: UseWaveCanvasPointerDragArgs) {
  const playheadEdgeScrollRafRef = useRef(0);
  const playheadScrubClientXRef = useRef<number | null>(null);
  const cueEdgeScrollRafRef = useRef(0);
  const cueDragScrollClientXRef = useRef<number | null>(null);
  /** レイアウト／ズーム変更で進行中ドラッグを無効化（誤コミット防止） */
  const waveDragSessionRef = useRef(0);
  const cueDragViewLockRef = useRef<WavePointerViewLock | null>(null);

  const abortActiveWaveDrags = useCallback(() => {
    waveDragSessionRef.current += 1;
    cueDragRef.current = null;
    cueDragPreviewRangeRef.current = null;
    cueDragViewLockRef.current = null;
    emptyWaveDragRef.current = null;
    newCueRangePreviewRef.current = null;
    if (cueEdgeScrollRafRef.current) {
      cancelAnimationFrame(cueEdgeScrollRafRef.current);
      cueEdgeScrollRafRef.current = 0;
    }
    cueDragScrollClientXRef.current = null;
    if (playheadEdgeScrollRafRef.current) {
      cancelAnimationFrame(playheadEdgeScrollRafRef.current);
      playheadEdgeScrollRafRef.current = 0;
    }
    playheadScrubClientXRef.current = null;
    let tRedraw = currentTimePropRef.current;
    if (isPlayingForWaveRef.current) {
      tRedraw = getLivePlaybackHeadSec(tRedraw);
    }
    drawWaveformAt(tRedraw);
  }, [
    cueDragPreviewRangeRef,
    cueDragRef,
    currentTimePropRef,
    drawWaveformAt,
    emptyWaveDragRef,
    isPlayingForWaveRef,
    newCueRangePreviewRef,
  ]);

  useEffect(() => {
    useTimelineWaveBridgeStore.getState().registerAbortPointerGestures(abortActiveWaveDrags);
    return () => useTimelineWaveBridgeStore.getState().registerAbortPointerGestures(null);
  }, [abortActiveWaveDrags]);

  useEffect(() => {
    if (cueDragRef.current?.armed || emptyWaveDragRef.current?.active) return;
    if (viewPortion === 1 && waveViewStartOverride == null) return;
    abortActiveWaveDrags();
  }, [viewPortion, waveViewStartOverride, abortActiveWaveDrags, cueDragRef, emptyWaveDragRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => abortActiveWaveDrags();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [abortActiveWaveDrags]);

  useEffect(() => {
    const canvas = resolveActiveWaveCanvas(canvasRef);
    if (!canvas || typeof ResizeObserver === "undefined") return;
    let lastW = canvas.getBoundingClientRect().width;
    const ro = new ResizeObserver(() => {
      const w = canvas.getBoundingClientRect().width;
      if (w <= 2) {
        lastW = w;
        abortActiveWaveDrags();
        return;
      }
      const dragging =
        cueDragRef.current?.armed === true ||
        emptyWaveDragRef.current?.active === true;
      if (!dragging && Math.abs(w - lastW) > 0.5) {
        abortActiveWaveDrags();
      }
      lastW = w;
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef, abortActiveWaveDrags, cueDragRef, emptyWaveDragRef]);

  const stopCueEdgeScrollLoop = useCallback(() => {
    if (cueEdgeScrollRafRef.current) {
      cancelAnimationFrame(cueEdgeScrollRafRef.current);
      cueEdgeScrollRafRef.current = 0;
    }
    cueDragScrollClientXRef.current = null;
  }, []);

  const applyEdgeScroll = useCallback(
    (clientX: number) => {
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c) return;
      let anchorSec = currentTimePropRef.current;
      if (isPlayingForWaveRef.current) {
        anchorSec = getLivePlaybackHeadSec(anchorSec);
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
      lastWaveDrawRangeRef,
      playheadScrubDragRef,
      waveViewStartOverrideRef,
      setWaveViewStartOverride,
      viewPortion,
      viewPortionRef,
    ]
  );

  /** キュー枠ドラッグ中の端スクロール（ゆっくり・表示窓ロックも追従） */
  const applyCueDragEdgeScroll = useCallback(
    (clientX: number): boolean => {
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c) return false;
      let anchorSec = currentTimePropRef.current;
      if (isPlayingForWaveRef.current) {
        anchorSec = getLivePlaybackHeadSec(anchorSec);
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
      const vp = viewPortionRef.current ?? viewPortion;
      const nextStart = panWaveViewStartAtClientX({
        clientX,
        canvasRect: c.getBoundingClientRect(),
        viewStart,
        viewSpan,
        durationSec: duration,
        viewPortion: vp,
        panStrength: CUE_DRAG_EDGE_SCROLL_PAN_STRENGTH,
      });
      if (nextStart == null) return false;
      setWaveViewStartOverride(nextStart);
      const lock = cueDragViewLockRef.current;
      if (lock) {
        cueDragViewLockRef.current = { viewStart: nextStart, viewSpan: lock.viewSpan };
      }
      return true;
    },
    [
      canvasRef,
      duration,
      currentTimePropRef,
      isPlayingForWaveRef,
      lastWaveDrawRangeRef,
      playheadScrubDragRef,
      waveViewStartOverrideRef,
      setWaveViewStartOverride,
      viewPortion,
      viewPortionRef,
    ]
  );

  const stopPlayheadEdgeScrollLoop = useCallback(() => {
    if (playheadEdgeScrollRafRef.current) {
      cancelAnimationFrame(playheadEdgeScrollRafRef.current);
      playheadEdgeScrollRafRef.current = 0;
    }
    playheadScrubClientXRef.current = null;
  }, []);

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

  const applyPlayheadEdgeScroll = useCallback(
    (clientX: number) => {
      const c = resolveActiveWaveCanvas(canvasRef);
      if (!c) return;
      let anchorSec = currentTimePropRef.current;
      if (isPlayingForWaveRef.current) {
        anchorSec = getLivePlaybackHeadSec(anchorSec);
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
      const vp = viewPortionRef.current ?? viewPortion;
      const nextStart = panWaveViewStartAtClientX({
        clientX,
        canvasRect: c.getBoundingClientRect(),
        viewStart,
        viewSpan,
        durationSec: duration,
        viewPortion: vp,
        panStrength: PLAYHEAD_SCRUB_EDGE_SCROLL_PAN_STRENGTH,
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
      lastWaveDrawRangeRef,
      playheadScrubDragRef,
      waveViewStartOverrideRef,
      setWaveViewStartOverride,
      viewPortion,
      viewPortionRef,
    ]
  );

  const applyPlayheadScrubViewPan = useCallback(
    (clientX: number, scrubTimeSec: number) => {
      applyPlayheadScrubViewFollow(clientX, scrubTimeSec);
      applyPlayheadEdgeScroll(clientX);
    },
    [applyPlayheadScrubViewFollow, applyPlayheadEdgeScroll]
  );

  return useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const peaksReady = peaks ?? peaksRef.current;
      if (projectViewMode === "view" || duration <= 0 || !peaksReady) return;
      const c = resolveWavePointerCanvas(canvasRef, e.currentTarget);
      if (!c) return;
      const anchorSec = () => {
        if (isPlayingForWaveRef.current) {
          return getLivePlaybackHeadSec(currentTimePropRef.current);
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
          playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
          cueDragArmed: cueDragRef.current?.armed ?? false,
          enginePaused:
            !isPlayingForWaveRef.current || playbackEngine.isPaused(),
          lastDrawRange: lastWaveDrawRangeRef.current,
        });
      const trimLo = trimStartSec;
      const trimHi = trimPlaybackEndSec({
        trimEndSec,
        durationSec: duration,
        durationFallbackSec: duration,
      });
      const rawWaveTimeFromClientX = (clientX: number) => {
        const lock = cueDragViewLockRef.current;
        if (lock) {
          return waveTimeAtClientXWithViewLock(clientX, c, lock);
        }
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
      const seekTimelineAtClientX = (clientX: number, scrubSession?: PlaybackScrubSession | null) => {
        let anchorSec = currentTimePropRef.current;
        if (isPlayingForWaveRef.current) {
          anchorSec = getLivePlaybackHeadSec(anchorSec);
        }
        const moved = commitWaveTimelineSeekAtClientX({
          clientX,
          canvas: c,
          durationSec: duration,
          viewPortion: viewPortionRef.current ?? viewPortion,
          isPlaying: isPlayingForWaveRef.current,
          viewStartOverride: waveViewStartOverrideRef.current,
          anchorTimeSec: anchorSec,
          playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
          enginePaused:
            !isPlayingForWaveRef.current || playbackEngine.isPaused(),
          lastDrawRange: lastWaveDrawRangeRef.current,
          trimStartSec: trimLo,
          trimEndSec,
          setWaveViewStartOverride,
          scrubSession: scrubSession ?? null,
          waveSeekSnapLatchRef,
        });
        if (moved != null) {
          currentTimePropRef.current = moved;
          drawWaveformAt(moved);
        }
        return moved;
      };
      const redraw = () => {
        let tRedraw = currentTimePropRef.current;
        if (isPlayingForWaveRef.current) {
          tRedraw = getLivePlaybackHeadSec(tRedraw);
        }
        drawWaveformAt(tRedraw);
      };

      const engineSec = getLiveEngineTimeSecOrNull();
      const playheadSecForHit = resolvePlayheadSecForWaveInteraction({
        currentTimePropSec: currentTimePropRef.current,
        isPlayingForWave: isPlayingForWaveRef.current,
        playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
        engineTimeSec: engineSec,
      });

      const { viewStart, viewSpan } = viewForPointer();
      const zoomedPc =
        (viewPortionRef.current ?? viewPortion) < 1 - 1e-9 &&
        !useTimelineWaveBridgeStore.getState().portraitActive;
      const dragKind = pickCueDragKindAtWave(
        e.clientX,
        e.clientY,
        c,
        cuesSorted,
        viewStart,
        viewSpan,
        cueDragPreviewRangeRef.current
      );
      const cueId = dragKind?.cueId ?? null;
      if (cueId) {
        e.stopPropagation();
        waveHoverCueRef.current = null;
        const cue = cuesSorted.find((x) => x.id === cueId);
        if (!cue) return;
        const cueDragSession = waveDragSessionRef.current;
        cueDragViewLockRef.current = { viewStart, viewSpan };
        onSelectedCueIdsChange([cueId]);
        const pointerT0 = timeFromClientX(e.clientX);
        const mode = dragKind?.mode ?? "move";
        const grabOffset = pointerT0 - cue.tStartSec;
        const startCanvasWidth = c.getBoundingClientRect().width;
        cueDragRef.current = {
          pointerId: e.pointerId,
          cueId,
          mode,
          moved: false,
          armed: mode === "start" || mode === "end",
          originX: e.clientX,
          originY: e.clientY,
          grabOffset,
          origStart: cue.tStartSec,
          origEnd: cue.tEndSec,
          startCanvasWidth,
        };
        cueDragPreviewRangeRef.current = { cueId, tStart: cue.tStartSec, tEnd: cue.tEndSec };
        if (cueDragRef.current.armed) {
          e.preventDefault();
          try {
            c.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        const MIN_CUE_DUR = 0.05;
        const applyCueDragAtClientX = (clientX: number, markMoved = false) => {
          const drag = cueDragRef.current;
          if (!drag) return;
          const rect = c.getBoundingClientRect();
          if (rect.width <= 8) return;
          if (markMoved) drag.moved = true;
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
            .setPortraitWaveEdgeScrollTick((clientX) =>
              applyCueDragAtClientX(clientX, true)
            );
        }
        const tickCueEdgeScrollLoop = () => {
          cueEdgeScrollRafRef.current = 0;
          const x = cueDragScrollClientXRef.current;
          const drag = cueDragRef.current;
          if (x == null || !drag?.armed) return;
          const vpLoop = viewPortionRef.current ?? viewPortion;
          if (vpLoop >= 1 - 1e-9) return;
          applyCueDragEdgeScroll(x);
          applyCueDragAtClientX(x, true);
          cueEdgeScrollRafRef.current = requestAnimationFrame(tickCueEdgeScrollLoop);
        };
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
          applyCueDragAtClientX(ev.clientX, true);
          const vpMove = viewPortionRef.current ?? viewPortion;
          if (vpMove < 1 - 1e-9) {
            cueDragScrollClientXRef.current = ev.clientX;
            if (!cueEdgeScrollRafRef.current) {
              cueEdgeScrollRafRef.current = requestAnimationFrame(tickCueEdgeScrollLoop);
            }
          }
        };
        const detachCueDragListeners = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
        };
        const cleanupCueDrag = (redrawAfter = true) => {
          stopCueEdgeScrollLoop();
          detachCueDragListeners();
          if (useTimelineWaveBridgeStore.getState().portraitActive) {
            useTimelineWaveBridgeStore.getState().setPortraitWaveEdgeScrollTick(null);
          }
          cueDragRef.current = null;
          cueDragPreviewRangeRef.current = null;
          cueDragViewLockRef.current = null;
          if (redrawAfter) redraw();
        };
        const onCancel = (ev: PointerEvent) => {
          if (ev.pointerId !== e.pointerId || !cueDragRef.current) return;
          try {
            c.releasePointerCapture(ev.pointerId);
          } catch {
            /* ignore */
          }
          cleanupCueDrag(true);
        };
        const onUp = (ev: PointerEvent) => {
          if (ev.pointerId !== e.pointerId || !cueDragRef.current) return;
          stopCueEdgeScrollLoop();
          detachCueDragListeners();
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
          cueDragViewLockRef.current = null;
          if (!drag) return;
          if (waveDragSessionRef.current !== cueDragSession) {
            redraw();
            return;
          }
          const { cueId: cid, mode: dragMode, moved, origStart, origEnd, startCanvasWidth } =
            drag;
          onSelectedCueIdsChange([cid]);
          if (!moved) {
            cueDragPreviewRangeRef.current = null;
            redraw();
            return;
          }
          const endRect = c.getBoundingClientRect();
          const widthDelta = Math.abs(endRect.width - startCanvasWidth);
          if (
            endRect.width <= 8 ||
            widthDelta / Math.max(startCanvasWidth, 1) > 0.12
          ) {
            redraw();
            return;
          }
          const dragPx = Math.hypot(ev.clientX - drag.originX, ev.clientY - drag.originY);
          if (dragPx < WAVE_DRAG_ARM_PX) {
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
        window.addEventListener("pointercancel", onCancel);
        redraw();
        return;
      }

      if (
        !zoomedPc &&
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
        const vpAtDown = viewPortionRef.current ?? viewPortion;
        const zoomed = vpAtDown < 1 - 1e-9;
        playheadScrubDragRef.current = {
          pointerId: e.pointerId,
          scrubSession: zoomed ? beginPlaybackScrubSession() : null,
          originX: e.clientX,
          originY: e.clientY,
          armed: zoomed,
        };
        const capturePid = e.pointerId;
        c.setPointerCapture(capturePid);
        if (zoomed && playbackEngine.getMediaElement()) {
          seekTimelineAtClientX(e.clientX, playheadScrubDragRef.current.scrubSession);
        }
        const tickPlayheadEdgeScrollLoop = () => {
          playheadEdgeScrollRafRef.current = 0;
          const x = playheadScrubClientXRef.current;
          const drag = playheadScrubDragRef.current;
          if (x == null || !drag?.armed) return;
          if (useTimelineWaveBridgeStore.getState().portraitActive) {
            useTimelineWaveBridgeStore.getState().portraitWaveScrubAtClientX?.(x, false, false);
          } else {
            applyPlayheadEdgeScroll(x);
            if (playbackEngine.getMediaElement()) {
              const moved = seekTimelineAtClientX(x, drag.scrubSession);
              const rect = c.getBoundingClientRect();
              if (
                moved != null &&
                !isWaveEdgeScrollZone(x, rect)
              ) {
                applyPlayheadScrubViewFollow(x, moved);
              }
            }
          }
          if (
            useTimelineWaveBridgeStore.getState().portraitActive &&
            playbackEngine.getMediaElement()
          ) {
            seekTimelineAtClientX(x, drag.scrubSession);
          }
          const vpLoop = viewPortionRef.current ?? viewPortion;
          if (vpLoop < 1 - 1e-9) {
            playheadEdgeScrollRafRef.current = requestAnimationFrame(
              tickPlayheadEdgeScrollLoop
            );
          }
        };
        const onPhMove = (ev: PointerEvent) => {
          const drag = playheadScrubDragRef.current;
          if (ev.pointerId !== capturePid || !drag) return;
          if (!drag.armed) {
            const dx = ev.clientX - drag.originX;
            const dy = ev.clientY - drag.originY;
            if (Math.hypot(dx, dy) < PLAYHEAD_SCRUB_ARM_PX) return;
            drag.armed = true;
            if (!drag.scrubSession) {
              drag.scrubSession = beginPlaybackScrubSession();
            }
          }
          if (!playbackEngine.getMediaElement()) return;
          const rect = c.getBoundingClientRect();
          const inEdge = isWaveEdgeScrollZone(ev.clientX, rect);
          if (useTimelineWaveBridgeStore.getState().portraitActive) {
            useTimelineWaveBridgeStore.getState().portraitWaveScrubAtClientX?.(
              ev.clientX,
              false,
              false
            );
          } else {
            const vp = viewPortionRef.current ?? viewPortion;
            if (vp < 1 - 1e-9) {
              if (inEdge) {
                applyPlayheadEdgeScroll(ev.clientX);
              }
              playheadScrubClientXRef.current = ev.clientX;
              if (!playheadEdgeScrollRafRef.current) {
                playheadEdgeScrollRafRef.current = requestAnimationFrame(
                  tickPlayheadEdgeScrollLoop
                );
              }
            }
          }
          const moved = seekTimelineAtClientX(ev.clientX, drag.scrubSession);
          if (
            !useTimelineWaveBridgeStore.getState().portraitActive &&
            moved != null &&
            !inEdge
          ) {
            applyPlayheadScrubViewFollow(ev.clientX, moved);
          }
        };
        const onPhUp = (ev: PointerEvent) => {
          if (ev.pointerId !== capturePid || !playheadScrubDragRef.current) return;
          stopPlayheadEdgeScrollLoop();
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
            if (playbackEngine.getMediaElement()) {
              seekTimelineAtClientX(ev.clientX, null);
            }
            suppressNextWaveSeekRef.current = true;
            redraw();
            return;
          }
          if (useTimelineWaveBridgeStore.getState().portraitActive) {
            useTimelineWaveBridgeStore.getState().portraitWaveScrubAtClientX?.(ev.clientX, true);
          }
          suppressNextWaveSeekRef.current = true;
          if (playbackEngine.getMediaElement()) {
            seekTimelineAtClientX(ev.clientX, drag.scrubSession);
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

      e.stopPropagation();
      waveHoverCueRef.current = null;
      const emptyDragSession = waveDragSessionRef.current;
      const { viewStart: emptyViewStart, viewSpan: emptyViewSpan } = viewForPointer();
      cueDragViewLockRef.current = { viewStart: emptyViewStart, viewSpan: emptyViewSpan };
      emptyWaveDragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startT: timeFromClientX(e.clientX),
        trimLo,
        trimHi,
        active: false,
      };
      newCueRangePreviewRef.current = null;
      if (playbackEngine.getMediaSourceUrl() && durationRef.current > 0) {
        seekTimelineAtClientX(e.clientX);
      }
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
      const onEmptyCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId || !emptyWaveDragRef.current) return;
        window.removeEventListener("pointermove", onEmptyMove);
        window.removeEventListener("pointerup", onEmptyUp);
        window.removeEventListener("pointercancel", onEmptyCancel);
        try {
          c.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        emptyWaveDragRef.current = null;
        newCueRangePreviewRef.current = null;
        cueDragViewLockRef.current = null;
        redraw();
      };
      const onEmptyUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId || !emptyWaveDragRef.current) return;
        window.removeEventListener("pointermove", onEmptyMove);
        window.removeEventListener("pointerup", onEmptyUp);
        window.removeEventListener("pointercancel", onEmptyCancel);
        try {
          c.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        const st = emptyWaveDragRef.current;
        emptyWaveDragRef.current = null;
        const preview = newCueRangePreviewRef.current;
        newCueRangePreviewRef.current = null;
        cueDragViewLockRef.current = null;
        const dragAborted = waveDragSessionRef.current !== emptyDragSession;
        if (st?.active) suppressNextWaveSeekRef.current = true;
        if (dragAborted) {
          redraw();
          return;
        }
        if (st && !st.active && durationRef.current > 0) {
          const now = performance.now();
          const dblFollowUp = isWaveDoubleClickFollowUp(
            wavePointerGestureRef.current.lastPointerUpAtMs,
            now
          );
          wavePointerGestureRef.current.lastPointerUpAtMs = now;
          if (dblFollowUp) {
            commitWaveDoubleClickAt(ev.clientX, ev.clientY);
            suppressNextWaveSeekRef.current = true;
          } else if (playbackEngine.getMediaSourceUrl()) {
            seekTimelineAtClientX(ev.clientX);
            onSelectedCueIdsChange([]);
            suppressNextWaveSeekRef.current = true;
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
      window.addEventListener("pointercancel", onEmptyCancel);
      redraw();
    },
    [
      projectViewMode,
      duration,
      peaks,
      peaksRef,
      canvasRef,
      lastWaveDrawRangeRef,
      waveViewStartOverrideRef,
      viewPortionRef,
      viewPortion,
      applyEdgeScroll,
      applyPlayheadScrubViewPan,
      stopPlayheadEdgeScrollLoop,
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
      wavePointerGestureRef,
      stopCueEdgeScrollLoop,
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
      commitWaveDoubleClickAt,
      waveViewStartOverride,
      abortActiveWaveDrags,
    ]
  );
}
