import { useCallback, useEffect, useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { Cue } from "../types/choreography";
import { sortCuesByStart } from "../core/timelineController";
import { playbackEngine } from "../core/playbackEngine";
import {
  gapConnectorPixelBounds,
  getWaveViewForDraw,
  waveTimeToExtentX,
  type CueDragEdgeMode,
} from "../lib/timelineWaveGeometry";

export type UseWaveCanvasRendererArgs = {
  canvasRef: RefObject<HTMLCanvasElement>;
  playheadLineOverlayRef: RefObject<HTMLDivElement>;
  peaksRef: RefObject<number[] | null>;
  durationRef: RefObject<number>;
  viewPortionRef: RefObject<number>;
  trimRef: RefObject<{ start: number; end: number | null }>;
  cuesRef: RefObject<Cue[]>;
  cueDragRef: RefObject<{ cueId: string } | null>;
  cueDragPreviewRangeRef: RefObject<{ cueId: string; tStart: number; tEnd: number } | null>;
  newCueRangePreviewRef: RefObject<{ tStart: number; tEnd: number } | null>;
  selectedCueIdsRef: RefObject<string[]>;
  waveHoverCueRef: RefObject<{ cueId: string; mode: CueDragEdgeMode } | null>;
  waveAmpRef: RefObject<number>;
  lastWaveDrawRangeRef: RefObject<{ viewStart: number; viewSpan: number }>;
  /** カーソル位置ズーム用: null でなければ viewStart をこの値で固定 */
  waveViewStartOverrideRef: RefObject<number | null>;
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

  const drawWaveformAt = useCallback(
    (playheadTime: number) => {
      const c = canvasRef.current;
      const pk = peaksRef.current;
      const d = durationRef.current;
      const vp = viewPortionRef.current;
      const { start: trimS, end: trimE } = trimRef.current;
      if (!c || !pk) return;
      const w = c.width;
      const h = c.height;
      const g = c.getContext("2d");
      if (!g) return;
      const startOverride =
        !isPlayingForWaveRef.current ? waveViewStartOverrideRef.current : null;
      const { start: viewStart, span: viewSpan } =
        startOverride !== null && d > 0
          ? { start: startOverride, span: Math.max(0.08, d * vp) }
          : getWaveViewForDraw(d, vp, playheadTime);
      const viewEnd = viewStart + viewSpan;
      lastWaveDrawRangeRef.current = { viewStart, viewSpan };
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
      g.strokeStyle = "#6366f1";
      g.lineWidth = 1;
      const mid = h / 2;
      pk.forEach((p, i) => {
        if (d <= 0 || viewSpan <= 0) return;
        const t = pk.length <= 1 ? d / 2 : (i / (pk.length - 1)) * d;
        if (t < viewStart || t > viewEnd) return;
        const x = waveTimeToExtentX(t, viewStart, viewSpan, w);
        if (x < -1 || x > w + 1) return;
        const ph = Math.min(h * 0.45, ((p * h) / 2) * waveAmpRef.current);
        g.beginPath();
        g.moveTo(x, mid - ph);
        g.lineTo(x, mid + ph);
        g.stroke();
      });
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
          const nonLinearGapRoute = Boolean(next.gapApproachFromPrev);
          if (nonLinearGapRoute) {
            g.fillStyle = "rgba(250, 204, 21, 0.45)";
            g.strokeStyle = "rgba(180, 83, 9, 0.9)";
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
        const baseLw = opts.isSel ? 1.75 : opts.isDrag ? 1.65 : 1.35;
        const gold =
          opts.isSel || opts.isDrag
            ? "rgba(234, 200, 95, 0.98)"
            : opts.isHover
              ? "rgba(212, 175, 55, 0.92)"
              : "rgba(212, 175, 55, 0.82)";
        const goldEdge = opts.hoverStart || opts.hoverEnd ? "rgba(250, 230, 160, 0.98)" : gold;
        g.strokeStyle = gold;
        g.lineWidth = baseLw;
        g.lineJoin = "miter";
        g.lineCap = "butt";
        g.strokeRect(left + inset, top, width - inset * 2, boxH);
        g.strokeStyle = goldEdge;
        g.lineWidth = 3.25;
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
        g.lineWidth = opts.hoverStart || opts.hoverEnd ? 3.6 : 2.4;
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
          const isSel = (selectedCueIdsRef.current ?? []).includes(cue.id);
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
      if (d > 0 && viewSpan > 0) {
        let xPlay = waveTimeToExtentX(playheadTime, viewStart, viewSpan, w);
        xPlay = Number.isFinite(xPlay)
          ? Math.min(w, Math.max(0, Math.round(xPlay * 2) / 2))
          : 0;
        g.strokeStyle = "#ef4444";
        g.lineWidth = 2.5;
        g.lineCap = "butt";
        g.beginPath();
        g.moveTo(xPlay + 0.5, 0);
        g.lineTo(xPlay + 0.5, h);
        g.stroke();
        if (lineEl) {
          lineEl.style.display = "block";
          lineEl.style.left = `${((xPlay + 0.5) / w) * 100}%`;
        }
      } else if (lineEl) {
        lineEl.style.display = "none";
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
      const bw = Math.max(280, Math.min(1600, Math.round(cssW * dpr)));
      const bh = Math.round(waveCanvasCssH * 2);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      if (!peaksRef.current) return;
      const tRedraw =
        isPlayingForWaveRef.current &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
          ? playbackEngine.getCurrentTime()
          : currentTimePropRef.current;
      drawWaveformAt(tRedraw);
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
  ]);

  useEffect(() => {
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
      const t =
        !playbackEngine.isPaused() && Number.isFinite(playbackEngine.getCurrentTime())
          ? playbackEngine.getCurrentTime()
          : currentTimePropRef.current;
      drawWaveformAt(t);
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
  ]);

  return { drawWaveformAt };
}
