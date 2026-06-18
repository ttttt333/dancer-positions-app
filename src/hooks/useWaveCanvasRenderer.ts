import { useCallback, useEffect, useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { Cue } from "../types/choreography";
import { sortCuesByStart, cueActiveAtTime } from "../core/timelineController";
import { playbackEngine } from "../core/playbackEngine";
import {
  effectiveWaveViewStartOverride,
  gapConnectorPixelBounds,
  isPlayheadSecInWaveView,
  playheadOverlayPositionStyles,
  resolveWaveDrawView,
  waveTimeToExtentX,
  type CueDragEdgeMode,
} from "../lib/timelineWaveGeometry";
import { publishWaveDrawRange } from "../lib/waveDrawRangeSync";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import { drawWavePeaksColumns } from "../lib/drawWavePeaksColumns";
import { WAVE_CANVAS_BITMAP_HEIGHT_SCALE } from "../lib/waveDockMetrics";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";

/** 波形上のキュー枠（CSS 表示 px）。ビットマップ線幅は `waveBitmapPxPerCssPx` を掛ける */
const WAVE_CUE_FRAME_BORDER_CSS_PX = 2;
const WAVE_CUE_FRAME_BORDER_SELECTED_CSS_PX = 2.25;

export type UseWaveCanvasRendererArgs = {
  canvasRef: RefObject<HTMLCanvasElement>;
  playheadLineOverlayRef: RefObject<HTMLDivElement>;
  peaksRef: RefObject<number[] | null>;
  durationRef: RefObject<number>;
  viewPortionRef: RefObject<number>;
  trimRef: RefObject<{ start: number; end: number | null }>;
  cuesRef: RefObject<Cue[]>;
  cueDragRef: RefObject<{ cueId: string; armed?: boolean } | null>;
  cueDragPreviewRangeRef: RefObject<{ cueId: string; tStart: number; tEnd: number } | null>;
  newCueRangePreviewRef: RefObject<{ tStart: number; tEnd: number } | null>;
  selectedCueIdsRef: RefObject<string[]>;
  waveHoverCueRef: RefObject<{ cueId: string; mode: CueDragEdgeMode } | null>;
  waveAmpRef: RefObject<number>;
  lastWaveDrawRangeRef: RefObject<{ viewStart: number; viewSpan: number }>;
  /** カーソル位置ズーム用: null でなければ viewStart をこの値で固定 */
  waveViewStartOverrideRef: RefObject<number | null>;
  playheadScrubDragRef: RefObject<{ armed: boolean } | null>;
  isPlayingForWaveRef: RefObject<boolean>;
  currentTimePropRef: RefObject<number>;
  wideWorkbench: boolean;
  waveCanvasCssH: number;
  peaks: number[] | null;
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  viewPortion: number;
  trimStartSec: number;
  trimEndSec: number | null;
  cuesSorted: Cue[];
  selectedCueIds: string[];
  waveformAmplitudeScale?: number;
};

/**
 * 波形キャンバスのビットマップ描画とオーバーレイ同期（`drawWaveformAt`）。
 */
export function useWaveCanvasRenderer(args: UseWaveCanvasRendererArgs) {
  const {
    canvasRef,
    playheadLineOverlayRef,
    peaksRef,
    durationRef,
    viewPortionRef,
    trimRef,
    cuesRef,
    cueDragRef,
    cueDragPreviewRangeRef,
    newCueRangePreviewRef,
    selectedCueIdsRef,
    waveHoverCueRef,
    waveAmpRef,
    lastWaveDrawRangeRef,
    waveViewStartOverrideRef,
    playheadScrubDragRef,
    isPlayingForWaveRef,
    currentTimePropRef,
    wideWorkbench,
    waveCanvasCssH,
    peaks,
    currentTime,
    isPlaying,
    duration,
    viewPortion,
    trimStartSec,
    trimEndSec,
    cuesSorted,
    selectedCueIds,
    waveformAmplitudeScale,
  } = args;

  const resolvePlayheadPaintTime = useCallback(() => {
    if (playheadScrubDragRef.current?.armed) {
      return currentTimePropRef.current;
    }
    if (
      isPlayingForWaveRef.current &&
      !playbackEngine.isPaused() &&
      Number.isFinite(playbackEngine.getCurrentTime())
    ) {
      return playbackEngine.getCurrentTime();
    }
    return currentTimePropRef.current;
  }, [currentTimePropRef, isPlayingForWaveRef, playheadScrubDragRef]);

  const drawWaveformAt = useCallback(
    (playheadTime: number) => {
      const c = resolveActiveWaveCanvas(canvasRef);
      const pk = peaksRef.current;
      const d = durationRef.current;
      const vp = viewPortionRef.current;
      const { start: trimS, end: trimE } = trimRef.current;
      if (!c || !pk) return;
      const w = c.width;
      const h = c.height;
      const g = c.getContext("2d");
      if (!g) return;
      const cssRect = c.getBoundingClientRect();
      const waveBitmapPxPerCssPx = Math.max(
        w / Math.max(cssRect.width, 1),
        h / Math.max(cssRect.height, 1)
      );
      const viewOverride = effectiveWaveViewStartOverride(
        waveViewStartOverrideRef.current,
        { viewPortion: vp }
      );
      const { start: viewStart, span: viewSpan } = resolveWaveDrawView({
        durationSec: d,
        viewPortion: vp,
        anchorTimeSec: playheadTime,
        isPlaying: isPlayingForWaveRef.current,
        viewStartOverride: viewOverride,
        playheadScrubArmed: playheadScrubDragRef.current?.armed ?? false,
        cueDragArmed: cueDragRef.current?.armed ?? false,
      });
      const viewEnd = viewStart + viewSpan;
      lastWaveDrawRangeRef.current = { viewStart, viewSpan };
      publishWaveDrawRange(viewStart, viewSpan);
      if (
        isPlayingForWaveRef.current &&
        !playheadScrubDragRef.current?.armed &&
        !(cueDragRef.current?.armed ?? false) &&
        vp < 1 - 1e-9 &&
        viewOverride !== null &&
        !isPlayheadSecInWaveView(playheadTime, viewOverride, viewSpan)
      ) {
        waveViewStartOverrideRef.current = viewStart;
      }
      g.fillStyle = "#0f172a";
      g.fillRect(0, 0, w, h);
      if (d > 0 && trimS > 0) {
        const xTrim = waveTimeToExtentX(trimS, viewStart, viewSpan, w);
        if (xTrim > 0 && xTrim < w) {
          g.fillStyle = "rgba(15,23,42,0.55)";
          g.fillRect(0, 0, xTrim, h);
        }
      }
      if (d > 0 && trimE != null && trimE < d) {
        const xTrim = waveTimeToExtentX(trimE, viewStart, viewSpan, w);
        if (xTrim > 0 && xTrim < w) {
          g.fillStyle = "rgba(15,23,42,0.55)";
          g.fillRect(xTrim, 0, w - xTrim, h);
        }
      }
      g.fillStyle = "#6366f1";
      drawWavePeaksColumns(g, pk, d, viewStart, viewSpan, w, h, waveAmpRef.current);
      const cueList = cuesRef.current;
      if (d > 0 && viewSpan > 0 && cueList.length >= 2) {
        const sortedWave = sortCuesByStart(cueList);
        const dragPrevDraw = cueDragPreviewRangeRef.current;
        for (let i = 0; i < sortedWave.length - 1; i++) {
          const prev = sortedWave[i]!;
          const next = sortedWave[i + 1]!;
          let prevEnd = prev.tEndSec;
          let nextStart = next.tStartSec;
          if (dragPrevDraw && dragPrevDraw.cueId === prev.id) prevEnd = dragPrevDraw.tEnd;
          if (dragPrevDraw && dragPrevDraw.cueId === next.id) nextStart = dragPrevDraw.tStart;
          const b = gapConnectorPixelBounds(
            prevEnd,
            nextStart,
            viewStart,
            viewSpan,
            viewEnd,
            w,
            h
          );
          if (!b) continue;
          const configuredGapMovement =
            Boolean(next.gapApproachFromPrev) ||
            (next.dancerCustomPaths != null &&
              Object.keys(next.dancerCustomPaths).length > 0);
          if (configuredGapMovement) {
            g.fillStyle = "rgba(248, 113, 113, 0.38)";
            g.strokeStyle = "rgba(220, 38, 38, 0.88)";
          } else {
            g.fillStyle = "rgba(255, 255, 255, 0.07)";
            g.strokeStyle = "rgba(248, 250, 252, 0.22)";
          }
          g.fillRect(b.left, b.top, b.width, b.height);
          g.lineWidth = 1;
          g.strokeRect(b.left + 0.5, b.top + 0.5, b.width - 1, b.height - 1);
        }
      }
      const dragCueId = cueDragRef.current?.cueId ?? null;
      const dragPrev = cueDragPreviewRangeRef.current;
      const followPlaybackSelection =
        isPlayingForWaveRef.current &&
        dragCueId == null &&
        !playheadScrubDragRef.current?.armed;
      const playbackActiveCueId = followPlaybackSelection
        ? cueActiveAtTime(cueList, playheadTime)?.id ?? null
        : null;
      const drawWaveCueChrome = (
        left: number,
        width: number,
        opts: {
          isDrag: boolean;
          isSel: boolean;
          hoverStart: boolean;
          hoverEnd: boolean;
          isHover: boolean;
        }
      ) => {
        const inset = 0.5;
        const top = inset;
        const boxH = h - inset * 2;
        const edgeSeg = Math.min(18, Math.max(6, width * 0.14));
        const baseLw =
          (opts.isSel
            ? WAVE_CUE_FRAME_BORDER_SELECTED_CSS_PX
            : WAVE_CUE_FRAME_BORDER_CSS_PX) * waveBitmapPxPerCssPx;
        const gold =
          opts.isSel
            ? "rgba(239, 68, 68, 0.98)"
            : opts.isDrag
              ? "rgba(234, 200, 95, 0.98)"
              : opts.isHover
                ? "rgba(212, 175, 55, 0.98)"
                : "rgba(196, 155, 40, 0.96)";
        const goldEdge =
          opts.isSel
            ? "rgba(252, 165, 165, 0.98)"
            : opts.hoverStart || opts.hoverEnd
              ? "rgba(250, 230, 160, 0.98)"
              : "rgba(212, 175, 55, 0.98)";
        g.strokeStyle = gold;
        g.lineWidth = baseLw;
        g.lineJoin = "miter";
        g.lineCap = "butt";
        g.strokeRect(left + inset, top, width - inset * 2, boxH);
        g.strokeStyle = goldEdge;
        g.lineWidth = baseLw * 1.55;
        g.beginPath();
        g.moveTo(left + inset, top);
        g.lineTo(left + inset + Math.min(edgeSeg, width * 0.45), top);
        g.stroke();
        g.beginPath();
        g.moveTo(left + width - inset - Math.min(edgeSeg, width * 0.45), top);
        g.lineTo(left + width - inset, top);
        g.stroke();
        g.beginPath();
        g.moveTo(left + inset, top + boxH);
        g.lineTo(left + inset + Math.min(edgeSeg, width * 0.45), top + boxH);
        g.stroke();
        g.beginPath();
        g.moveTo(left + width - inset - Math.min(edgeSeg, width * 0.45), top + boxH);
        g.lineTo(left + width - inset, top + boxH);
        g.stroke();
        g.strokeStyle = goldEdge;
        g.lineWidth =
          opts.hoverStart || opts.hoverEnd ? baseLw * 1.7 : baseLw * 1.15;
        g.lineCap = "butt";
        if (opts.hoverStart) {
          g.beginPath();
          g.moveTo(left + inset, top);
          g.lineTo(left + inset, top + boxH);
          g.stroke();
        }
        if (opts.hoverEnd) {
          g.beginPath();
          g.moveTo(left + width - inset, top);
          g.lineTo(left + width - inset, top + boxH);
          g.stroke();
        }
      };
      if (d > 0 && viewSpan > 0 && cueList.length > 0) {
        for (const cue of cueList) {
          let ts = cue.tStartSec;
          let te = cue.tEndSec;
          if (dragPrev && dragPrev.cueId === cue.id) {
            ts = dragPrev.tStart;
            te = dragPrev.tEnd;
          }
          if (te < viewStart || ts > viewEnd) continue;
          const x1 = waveTimeToExtentX(Math.max(ts, viewStart), viewStart, viewSpan, w);
          const x2 = waveTimeToExtentX(Math.min(te, viewEnd), viewStart, viewSpan, w);
          const left = Math.min(x1, x2);
          const width = Math.max(3, Math.abs(x2 - x1));
          const isDrag = dragCueId === cue.id;
          const isSel = playbackActiveCueId
            ? cue.id === playbackActiveCueId
            : selectedCueIdsRef.current.includes(cue.id);
          const hover = waveHoverCueRef.current;
          const isHover = hover?.cueId === cue.id && (!dragCueId || dragCueId !== cue.id);
          drawWaveCueChrome(left, width, {
            isDrag,
            isSel,
            hoverStart: isHover && hover.mode === "start",
            hoverEnd: isHover && hover.mode === "end",
            isHover,
          });
        }
      }
      const newPrev = newCueRangePreviewRef.current;
      if (d > 0 && viewSpan > 0 && newPrev) {
        let ts = newPrev.tStart;
        let te = newPrev.tEnd;
        if (te < ts) [ts, te] = [te, ts];
        if (te >= viewStart && ts <= viewEnd) {
          const x1 = waveTimeToExtentX(Math.max(ts, viewStart), viewStart, viewSpan, w);
          const x2 = waveTimeToExtentX(Math.min(te, viewEnd), viewStart, viewSpan, w);
          const left = Math.min(x1, x2);
          const width = Math.max(3, Math.abs(x2 - x1));
          const inset = 0.5;
          const top = inset;
          const boxH = h - inset * 2;
          const edgeSeg = Math.min(18, Math.max(6, width * 0.14));
          const teal = "rgba(45, 212, 191, 0.88)";
          const tealHi = "rgba(110, 231, 210, 0.95)";
          g.strokeStyle = teal;
          g.lineWidth = 1.35;
          g.lineJoin = "miter";
          g.lineCap = "butt";
          g.strokeRect(left + inset, top, width - inset * 2, boxH);
          g.strokeStyle = tealHi;
          g.lineWidth = 3.1;
          g.beginPath();
          g.moveTo(left + inset, top);
          g.lineTo(left + inset + Math.min(edgeSeg, width * 0.45), top);
          g.stroke();
          g.beginPath();
          g.moveTo(left + width - inset - Math.min(edgeSeg, width * 0.45), top);
          g.lineTo(left + width - inset, top);
          g.stroke();
          g.beginPath();
          g.moveTo(left + inset, top + boxH);
          g.lineTo(left + inset + Math.min(edgeSeg, width * 0.45), top + boxH);
          g.stroke();
          g.beginPath();
          g.moveTo(left + width - inset - Math.min(edgeSeg, width * 0.45), top + boxH);
          g.lineTo(left + width - inset, top + boxH);
          g.stroke();
        }
      }
      const lineEl = playheadLineOverlayRef.current;
      const portraitCanvas =
        useTimelineWaveBridgeStore.getState().portraitActive &&
        c === useTimelineWaveBridgeStore.getState().portraitCanvasRef?.current;
      const portraitHeadEl =
        useTimelineWaveBridgeStore.getState().portraitPlayheadLineRef?.current;
      const cssW = c.getBoundingClientRect().width;
      const extentForOverlay = cssW > 0 ? cssW : w;
      if (d > 0 && viewSpan > 0) {
        let xPlay = waveTimeToExtentX(
          playheadTime,
          viewStart,
          viewSpan,
          extentForOverlay
        );
        xPlay = Number.isFinite(xPlay)
          ? Math.min(extentForOverlay, Math.max(0, xPlay))
          : 0;
        const xBitmap = waveTimeToExtentX(playheadTime, viewStart, viewSpan, w);
        const xDraw = Number.isFinite(xBitmap)
          ? Math.min(w, Math.max(0, Math.round(xBitmap * 2) / 2))
          : 0;
        if (!portraitCanvas) {
          g.strokeStyle = "#ef4444";
          g.lineWidth = 2.5;
          g.lineCap = "butt";
          g.beginPath();
          g.moveTo(xDraw + 0.5, 0);
          g.lineTo(xDraw + 0.5, h);
          g.stroke();
        }
        const pct =
          extentForOverlay > 0 ? (xPlay / extentForOverlay) * 100 : 0;
        if (lineEl && !portraitCanvas) {
          lineEl.style.display = "block";
          const pos = playheadOverlayPositionStyles(pct);
          lineEl.style.left = pos.left;
          lineEl.style.transform = pos.transform;
        } else if (lineEl && portraitCanvas) {
          lineEl.style.display = "none";
        }
        if (portraitHeadEl && portraitCanvas) {
          portraitHeadEl.style.display = "block";
          const pos = playheadOverlayPositionStyles(pct);
          portraitHeadEl.style.left = pos.left;
          portraitHeadEl.style.transform = pos.transform;
        } else if (portraitHeadEl) {
          portraitHeadEl.style.display = "none";
        }
      } else {
        if (lineEl) lineEl.style.display = "none";
        if (portraitHeadEl) portraitHeadEl.style.display = "none";
      }
    },
    [
      canvasRef,
      peaksRef,
      durationRef,
      viewPortionRef,
      trimRef,
      isPlayingForWaveRef,
      lastWaveDrawRangeRef,
      waveAmpRef,
      cuesRef,
      cueDragPreviewRangeRef,
      cueDragRef,
      selectedCueIdsRef,
      waveHoverCueRef,
      newCueRangePreviewRef,
      playheadLineOverlayRef,
    ]
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const syncBitmapSize = () => {
      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width;
      if (cssW <= 2) return;
      const dpr =
        typeof window !== "undefined"
          ? Math.min(window.devicePixelRatio || 1, wideWorkbench ? 2 : 1.35)
          : 1;
      const heightScale = wideWorkbench ? WAVE_CANVAS_BITMAP_HEIGHT_SCALE : 2;
      const bw = Math.max(280, Math.min(wideWorkbench ? 4096 : 3200, Math.round(cssW * dpr)));
      const bh = Math.round(waveCanvasCssH * heightScale);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      if (!peaksRef.current) return;
      drawWaveformAt(resolvePlayheadPaintTime());
    };
    syncBitmapSize();
    const ro = new ResizeObserver(() => syncBitmapSize());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [
    canvasRef,
    peaksRef,
    isPlayingForWaveRef,
    currentTimePropRef,
    drawWaveformAt,
    wideWorkbench,
    waveCanvasCssH,
    peaks,
    resolvePlayheadPaintTime,
  ]);

  useLayoutEffect(() => {
    if (isPlaying) return;
    drawWaveformAt(currentTime);
  }, [
    isPlaying,
    currentTime,
    drawWaveformAt,
    peaks,
    duration,
    viewPortion,
    trimStartSec,
    trimEndSec,
    cuesSorted,
    selectedCueIds,
    waveformAmplitudeScale,
    waveCanvasCssH,
  ]);

  useEffect(() => {
    if (!isPlaying || !peaks) return;
    let id = 0;
    const paint = () => {
      drawWaveformAt(resolvePlayheadPaintTime());
      id = requestAnimationFrame(paint);
    };
    id = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(id);
  }, [
    isPlaying,
    peaks,
    drawWaveformAt,
    viewPortion,
    duration,
    trimStartSec,
    trimEndSec,
    cuesSorted,
    selectedCueIds,
    waveformAmplitudeScale,
    waveCanvasCssH,
    currentTimePropRef,
    resolvePlayheadPaintTime,
  ]);

  return { drawWaveformAt };
}
