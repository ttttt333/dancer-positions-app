import { useCallback, useEffect, useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { Cue } from "../types/choreography";
import { sortCuesByStart, cueActiveAtTime } from "../core/timelineController";
import { playbackEngine } from "../core/playbackEngine";
import { getLiveEngineTimeSecOrNull } from "../lib/playbackHead";
import {
  effectiveWaveViewStartOverride,
  gapConnectorPixelBounds,
  isPlayheadSecInWaveView,
  playheadOverlayPositionStyles,
  PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC,
  resolveWaveDrawView,
  waveTimeToExtentX,
  type CueDragEdgeMode,
} from "../lib/timelineWaveGeometry";
import { cueSelectionExtentSec } from "../lib/cueSelectionExtent";
import { publishWaveDrawRange } from "../lib/waveDrawRangeSync";
import { resolveActiveWaveCanvas } from "../lib/activeWaveCanvas";
import { drawWavePeaksColumns } from "../lib/drawWavePeaksColumns";
import { drawWaveGapConnectorBand, resolveWaveGapConnectorStyle } from "../lib/drawWaveGapConnector";
import { drawEightCountGrid } from "../lib/audioAnalysis/drawEightCountGrid";
import { drawMusicSectionBands } from "../lib/audioAnalysis/drawMusicSectionBands";
import { WAVE_CANVAS_BITMAP_HEIGHT_SCALE } from "../lib/waveDockMetrics";
import { useWavePeaksStore } from "../store/wavePeaksStore";
import { useMusicSectionOverlayStore } from "../store/musicSectionOverlayStore";
import { useTimelineWaveBridgeStore } from "../store/timelineWaveBridgeStore";
import type { WaveSeekSnapLatch } from "../lib/waveSeekSnapLatch";
import {
  advanceWaveSeekSnapLatch,
  resolveWaveSeekSnapPaint,
} from "../lib/waveSeekSnapLatch";

/** 波形上のキュー枠（CSS 表示 px）。ビットマップ線幅は `waveBitmapPxPerCssPx` を掛ける */
const WAVE_CUE_FRAME_BORDER_CSS_PX = 2;
/** 選択中は FODI / Choreographic 系のように枠を太くし、端を掴みやすくする */
const WAVE_CUE_FRAME_BORDER_SELECTED_CSS_PX = 5.5;
/** 選択キュー左右端のグリップ幅（CSS px）— 枠外へ飛び出す分を含む */
const WAVE_CUE_SELECTED_EDGE_GRIP_CSS_PX = 14;
/** 枠外への飛び出し割合（0.55 = 半分以上が枠の外） */
const WAVE_CUE_SELECTED_EDGE_GRIP_OUTSET = 0.62;

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
  waveSeekSnapLatchRef: RefObject<WaveSeekSnapLatch | null>;
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
    waveSeekSnapLatchRef,
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
    const engineSec = isPlayingForWaveRef.current
      ? getLiveEngineTimeSecOrNull()
      : null;
    const snap = resolveWaveSeekSnapPaint({
      latch: waveSeekSnapLatchRef.current,
      engineSec,
      fallbackSec: currentTimePropRef.current,
    });
    if (snap.pinned) {
      return snap.paintSec;
    }
    if (engineSec != null) {
      return engineSec;
    }
    return currentTimePropRef.current;
  }, [
    currentTimePropRef,
    isPlayingForWaveRef,
    playheadScrubDragRef,
    waveSeekSnapLatchRef,
  ]);

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
      /** 幅基準: canvas の layout border box（`readLayoutViewportSize` とは別系統） */
      const cssRect = c.getBoundingClientRect();
      const waveBitmapPxPerCssPx = Math.max(
        w / Math.max(cssRect.width, 1),
        h / Math.max(cssRect.height, 1)
      );
      const engineSec = isPlayingForWaveRef.current
        ? getLiveEngineTimeSecOrNull()
        : null;
      const snap = resolveWaveSeekSnapPaint({
        latch: waveSeekSnapLatchRef.current,
        engineSec,
        fallbackSec: playheadTime,
      });
      if (!snap.pinned) {
        advanceWaveSeekSnapLatch(waveSeekSnapLatchRef, engineSec);
      }
      const paintHeadSec = snap.pinned ? snap.paintSec : playheadTime;
      const snapPinned = snap.pinned;
      if (snapPinned && snap.viewStartOverride != null) {
        waveViewStartOverrideRef.current = snap.viewStartOverride;
      }
      const viewOverride = snapPinned && snap.viewStartOverride != null
        ? snap.viewStartOverride
        : effectiveWaveViewStartOverride(
            waveViewStartOverrideRef.current,
            { viewPortion: vp }
          );
      const { start: viewStart, span: viewSpan } = resolveWaveDrawView({
        durationSec: d,
        viewPortion: vp,
        anchorTimeSec: paintHeadSec,
        isPlaying: isPlayingForWaveRef.current,
        viewStartOverride: viewOverride,
        playheadScrubArmed:
          (playheadScrubDragRef.current?.armed ?? false) || snapPinned,
        // Pin as soon as a cue pointer session exists (including unarmed move).
        cueDragArmed: cueDragRef.current != null,
      });
      const viewEnd = viewStart + viewSpan;
      lastWaveDrawRangeRef.current = { viewStart, viewSpan };
      publishWaveDrawRange(viewStart, viewSpan);
      if (
        isPlayingForWaveRef.current &&
        !playheadScrubDragRef.current?.armed &&
        !snapPinned &&
        cueDragRef.current == null &&
        vp < 1 - 1e-9 &&
        viewOverride !== null &&
        !isPlayheadSecInWaveView(paintHeadSec, viewOverride, viewSpan)
      ) {
        waveViewStartOverrideRef.current = viewStart;
      }
      g.fillStyle = "#0b1224";
      g.fillRect(0, 0, w, h);
      if (d > 0 && trimS > 0) {
        const xTrim = waveTimeToExtentX(trimS, viewStart, viewSpan, w);
        if (xTrim > 0 && xTrim < w) {
          g.fillStyle = "rgba(11,18,36,0.55)";
          g.fillRect(0, 0, xTrim, h);
        }
      }
      if (d > 0 && trimE != null && trimE < d) {
        const xTrim = waveTimeToExtentX(trimE, viewStart, viewSpan, w);
        if (xTrim > 0 && xTrim < w) {
          g.fillStyle = "rgba(11,18,36,0.55)";
          g.fillRect(xTrim, 0, w - xTrim, h);
        }
      }
      g.fillStyle = "#93c5fd";
      const peaksDurationSec =
        useWavePeaksStore.getState().peaksDurationSec ?? d;
      drawWavePeaksColumns(
        g,
        pk,
        peaksDurationSec,
        viewStart,
        viewSpan,
        w,
        h,
        waveAmpRef.current
      );
      const gridBeats = useMusicSectionOverlayStore.getState().beats;
      if (gridBeats.length > 0) {
        drawEightCountGrid(g, {
          beats: gridBeats,
          viewStart,
          viewSpan,
          canvasWidth: w,
          canvasHeight: h,
        });
      }
      const sectionSegs = useMusicSectionOverlayStore.getState().segments;
      if (sectionSegs.length > 0) {
        drawMusicSectionBands(g, sectionSegs, viewStart, viewSpan, w, h);
      }
      const cueList = cuesRef.current;
      if (d > 0 && viewSpan > 0 && cueList.length >= 2) {
        const sortedWave = sortCuesByStart(cueList);
        const dragPrevDraw = cueDragPreviewRangeRef.current;
        const selectedIds = selectedCueIdsRef.current;
        const followPlaybackSelectionPreview =
          isPlayingForWaveRef.current &&
          (cueDragRef.current?.cueId ?? null) == null &&
          !playheadScrubDragRef.current?.armed;
        const playbackSelId = followPlaybackSelectionPreview
          ? cueActiveAtTime(cueList, paintHeadSec)?.id ?? null
          : null;
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
          const gapOwnedBySelection =
            (playbackSelId != null && prev.id === playbackSelId) ||
            (playbackSelId == null && selectedIds.includes(prev.id));
          const configuredGapMovement =
            Boolean(next.gapApproachFromPrev) ||
            (next.dancerCustomPaths != null &&
              Object.keys(next.dancerCustomPaths).length > 0);
          const gapStyle = resolveWaveGapConnectorStyle({
            ownedBySelection: gapOwnedBySelection,
            configuredGapMovement,
            waveBitmapPxPerCssPx,
          });
          drawWaveGapConnectorBand(g, b, gapStyle);
        }
      }
      const dragCueId = cueDragRef.current?.cueId ?? null;
      const dragPrev = cueDragPreviewRangeRef.current;
      const followPlaybackSelection =
        isPlayingForWaveRef.current &&
        dragCueId == null &&
        !playheadScrubDragRef.current?.armed;
      const playbackActiveCueId = followPlaybackSelection
        ? cueActiveAtTime(cueList, paintHeadSec)?.id ?? null
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
          /** ホールド本体の左右端（空白を含む選択枠と違うとき）。ここに外向きグリップを置く */
          holdLeft?: number;
          holdRight?: number;
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

        /** FODI 風: ホールド端から横に飛び出したリサイズグリップ */
        if (opts.isSel) {
          const gripW = Math.max(
            WAVE_CUE_SELECTED_EDGE_GRIP_CSS_PX * waveBitmapPxPerCssPx,
            baseLw * 2.2
          );
          const gripH = Math.min(
            boxH * 0.72,
            Math.max(28 * waveBitmapPxPerCssPx, boxH * 0.48)
          );
          const gripTop = top + (boxH - gripH) / 2;
          const outset = gripW * WAVE_CUE_SELECTED_EDGE_GRIP_OUTSET;
          const startX = opts.holdLeft ?? left + inset;
          const endX = opts.holdRight ?? left + width - inset;
          const radius = Math.min(4 * waveBitmapPxPerCssPx, gripW * 0.35);

          const drawOutsetGrip = (edgeX: number, side: "start" | "end") => {
            const gx =
              side === "start" ? edgeX - outset : edgeX - (gripW - outset);
            g.fillStyle = "rgba(252, 165, 165, 0.98)";
            g.strokeStyle = "rgba(254, 226, 226, 0.98)";
            g.lineWidth = Math.max(1, waveBitmapPxPerCssPx);
            g.beginPath();
            // roundRect 回避（Safari 古い版）
            const r = radius;
            g.moveTo(gx + r, gripTop);
            g.lineTo(gx + gripW - r, gripTop);
            g.quadraticCurveTo(gx + gripW, gripTop, gx + gripW, gripTop + r);
            g.lineTo(gx + gripW, gripTop + gripH - r);
            g.quadraticCurveTo(
              gx + gripW,
              gripTop + gripH,
              gx + gripW - r,
              gripTop + gripH
            );
            g.lineTo(gx + r, gripTop + gripH);
            g.quadraticCurveTo(gx, gripTop + gripH, gx, gripTop + gripH - r);
            g.lineTo(gx, gripTop + r);
            g.quadraticCurveTo(gx, gripTop, gx + r, gripTop);
            g.closePath();
            g.fill();
            g.stroke();
            /** 掴みやすい縦バー 2 本 */
            g.strokeStyle = "rgba(127, 29, 29, 0.55)";
            g.lineWidth = Math.max(1.2, waveBitmapPxPerCssPx);
            const barGap = gripW * 0.18;
            const bar1 = gx + gripW * 0.38;
            const bar2 = bar1 + barGap;
            g.beginPath();
            g.moveTo(bar1, gripTop + gripH * 0.28);
            g.lineTo(bar1, gripTop + gripH * 0.72);
            g.moveTo(bar2, gripTop + gripH * 0.28);
            g.lineTo(bar2, gripTop + gripH * 0.72);
            g.stroke();
          };

          drawOutsetGrip(startX, "start");
          drawOutsetGrip(endX, "end");
        }

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
          const hx = opts.holdLeft ?? left + inset;
          g.beginPath();
          g.moveTo(hx, top);
          g.lineTo(hx, top + boxH);
          g.stroke();
        }
        if (opts.hoverEnd) {
          const hx = opts.holdRight ?? left + width - inset;
          g.beginPath();
          g.moveTo(hx, top);
          g.lineTo(hx, top + boxH);
          g.stroke();
        }
      };
      if (d > 0 && viewSpan > 0 && cueList.length > 0) {
        const sortedForExtent = sortCuesByStart(cueList);
        for (const cue of cueList) {
          let ts = cue.tStartSec;
          let te = cue.tEndSec;
          if (dragPrev && dragPrev.cueId === cue.id) {
            ts = dragPrev.tStart;
            te = dragPrev.tEnd;
          }
          const isDrag = dragCueId === cue.id;
          const isSel = playbackActiveCueId
            ? cue.id === playbackActiveCueId
            : selectedCueIdsRef.current.includes(cue.id);
          const hover = waveHoverCueRef.current;
          const isHover = hover?.cueId === cue.id && (!dragCueId || dragCueId !== cue.id);

          /** 選択中は次キューまでの空白を枠に含める（コレオグラフィック風） */
          let frameTs = Math.min(ts, te);
          let frameTe = Math.max(ts, te);
          let holdEndSec = frameTe;
          if (isSel || isDrag) {
            const extent = cueSelectionExtentSec(cue, sortedForExtent, dragPrev);
            frameTs = extent.startSec;
            frameTe = extent.endSec;
            holdEndSec = extent.holdEndSec;
          }
          if (frameTe < viewStart || frameTs > viewEnd) continue;
          const x1 = waveTimeToExtentX(
            Math.max(frameTs, viewStart),
            viewStart,
            viewSpan,
            w
          );
          const x2 = waveTimeToExtentX(
            Math.min(frameTe, viewEnd),
            viewStart,
            viewSpan,
            w
          );
          const left = Math.min(x1, x2);
          const width = Math.max(3, Math.abs(x2 - x1));
          const xHoldStart = waveTimeToExtentX(
            Math.max(Math.min(ts, te), viewStart),
            viewStart,
            viewSpan,
            w
          );
          const xHoldEnd = waveTimeToExtentX(
            Math.min(Math.max(ts, te), viewEnd),
            viewStart,
            viewSpan,
            w
          );
          const holdLeft = Math.min(xHoldStart, xHoldEnd);
          const holdRight = Math.max(xHoldStart, xHoldEnd);
          drawWaveCueChrome(left, width, {
            isDrag,
            isSel,
            hoverStart: isHover && hover.mode === "start",
            hoverEnd: isHover && hover.mode === "end",
            isHover,
            holdLeft,
            holdRight,
          });
          /** 空白があるときホールド終端の区切り線のみ（グリップは hold 端の外向き） */
          if (
            (isSel || isDrag) &&
            holdEndSec > frameTs + 1e-3 &&
            holdEndSec < frameTe - 1e-3 &&
            holdEndSec >= viewStart &&
            holdEndSec <= viewEnd
          ) {
            const xHold = waveTimeToExtentX(holdEndSec, viewStart, viewSpan, w);
            const inset = 0.5;
            const top = inset;
            const boxH = h - inset * 2;
            g.strokeStyle = isSel
              ? "rgba(252, 165, 165, 0.75)"
              : "rgba(250, 230, 160, 0.75)";
            g.lineWidth =
              (isSel
                ? WAVE_CUE_FRAME_BORDER_SELECTED_CSS_PX
                : WAVE_CUE_FRAME_BORDER_CSS_PX) *
              waveBitmapPxPerCssPx *
              0.85;
            g.setLineDash([
              3 * waveBitmapPxPerCssPx,
              3 * waveBitmapPxPerCssPx,
            ]);
            g.beginPath();
            g.moveTo(xHold, top);
            g.lineTo(xHold, top + boxH);
            g.stroke();
            g.setLineDash([]);
          }
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
          paintHeadSec,
          viewStart,
          viewSpan,
          extentForOverlay
        );
        xPlay = Number.isFinite(xPlay)
          ? Math.min(extentForOverlay, Math.max(0, xPlay))
          : 0;
        const xBitmap = waveTimeToExtentX(paintHeadSec, viewStart, viewSpan, w);
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
          /**
           * 縦 FODI / 横ドック: 再生バーは常に左寄り固定位置。
           * （曲頭で viewStart がまだ追いつかない瞬間でもバーが横移動しない）
           */
          const fixedPct = PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC * 100;
          const pos = playheadOverlayPositionStyles(fixedPct);
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
      waveViewStartOverrideRef,
      waveSeekSnapLatchRef,
      playheadScrubDragRef,
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

  // 自動解析完了で beats / sections が入ったら、停止中でも即再描画
  useEffect(() => {
    return useMusicSectionOverlayStore.subscribe((state, prev) => {
      if (state.beats === prev.beats && state.segments === prev.segments) return;
      if (isPlayingForWaveRef.current) return;
      drawWaveformAt(resolvePlayheadPaintTime());
    });
  }, [drawWaveformAt, resolvePlayheadPaintTime, isPlayingForWaveRef]);

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
