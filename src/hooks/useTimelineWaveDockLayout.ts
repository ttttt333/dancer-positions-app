import { useEffect, useMemo, useRef, useState } from "react";
import {
  TIMELINE_BRAND_RAIL_CSS,
  TIMELINE_BRAND_RAIL_WIDE_CSS,
} from "../components/TimelineToolbar";
import {
  estimateWideTopDockToolbarChromePx,
  estimateWideTopDockWaveStripChromePx,
  TOP_DOCK_INNER_BOTTOM_INSET_PX,
  TOP_DOCK_WAVE_STAGE_RESIZER_PX,
  WAVE_CANVAS_H_PC_WIDE_DEFAULT,
  WAVE_STRIP_BORDER_PX,
} from "../lib/waveDockMetrics";
import { WAVE_CANVAS_H_MAX, WAVE_CANVAS_H_MIN } from "./useTimelineWaveHeightDrag";

/** 波形キャンバス既定高さ（CSS px）。`useTimelineWaveHeightDrag` の最小・最大と揃える */
const WAVE_CANVAS_H_DEFAULT = 36;
/** 上部ドック時の既定（コンパクト・非ワイド） */
const WAVE_CANVAS_H_COMPACT_DOCK = 25;
/** スマホ縦積み: 波形の既定をさらに低く（縦・横でステージを確保） */
const WAVE_CANVAS_H_MOBILE_STACK = 20;

/** 非ワイド上部ドック: ツールバー＋波形ストリップ chrome 目安 */
const NARROW_TOP_DOCK_TOOLBAR_CHROME_PX = 48;
const NARROW_WAVE_STRIP_CHROME_PX = 15;

type Params = {
  wideWorkbench: boolean;
  compactTopDock: boolean;
  /** スマホ縦積みエディタ（狭いビューポート） */
  editorMobileStack?: boolean;
  /** PC 上部ドック外枠の高さ（px）。波形キャンバスを残り領域に合わせる */
  topDockHeightPx?: number | null;
};

/** 上部ドック外枠からタイムライン内側の高さを求める */
export function topDockInnerHeightPx(
  outerHeightPx: number,
  wideWorkbench: boolean
): number {
  const bottomInset = wideWorkbench
    ? TOP_DOCK_WAVE_STAGE_RESIZER_PX
    : TOP_DOCK_INNER_BOTTOM_INSET_PX;
  return Math.max(0, outerHeightPx - bottomInset);
}

/** 再生行を除いた波形キャンバス用の残り高さ（px） */
export function resolveWaveCanvasHeightInTopDock(
  outerHeightPx: number,
  wideWorkbench: boolean
): number {
  const innerH = topDockInnerHeightPx(outerHeightPx, wideWorkbench);
  const toolbarChrome = wideWorkbench
    ? estimateWideTopDockToolbarChromePx()
    : NARROW_TOP_DOCK_TOOLBAR_CHROME_PX;
  const waveStripChrome = wideWorkbench
    ? estimateWideTopDockWaveStripChromePx()
    : NARROW_WAVE_STRIP_CHROME_PX;
  const available = Math.round(
    innerH - toolbarChrome - waveStripChrome - WAVE_STRIP_BORDER_PX
  );
  const preferred = wideWorkbench
    ? WAVE_CANVAS_H_PC_WIDE_DEFAULT
    : WAVE_CANVAS_H_MIN;
  const canvasH = Math.min(available, preferred);
  return Math.min(WAVE_CANVAS_H_MAX, Math.max(WAVE_CANVAS_H_MIN, canvasH));
}

/**
 * タイムライン上部ドック時のブランドレール幅（grid 列）と波形帯の CSS 高さ。
 */
export function useTimelineWaveDockLayout({
  wideWorkbench,
  compactTopDock,
  editorMobileStack = false,
  topDockHeightPx = null,
}: Params) {
  const [waveCanvasCssH, setWaveCanvasCssH] = useState(() => {
    if (!compactTopDock) return WAVE_CANVAS_H_DEFAULT;
    if (editorMobileStack) return WAVE_CANVAS_H_MOBILE_STACK;
    if (wideWorkbench) return WAVE_CANVAS_H_PC_WIDE_DEFAULT;
    return WAVE_CANVAS_H_COMPACT_DOCK;
  });
  const waveCanvasCssHRef = useRef(waveCanvasCssH);
  waveCanvasCssHRef.current = waveCanvasCssH;

  const brandRailCss = useMemo(
    () =>
      wideWorkbench
        ? TIMELINE_BRAND_RAIL_WIDE_CSS
        : compactTopDock && editorMobileStack
          ? "minmax(0, 24px)"
          : "minmax(0, min(72px, 18vw))",
    [wideWorkbench, compactTopDock, editorMobileStack]
  );

  useEffect(() => {
    if (!compactTopDock || topDockHeightPx != null) return;
    const floor = editorMobileStack
      ? WAVE_CANVAS_H_MOBILE_STACK
      : WAVE_CANVAS_H_COMPACT_DOCK;
    setWaveCanvasCssH((h) =>
      Math.min(WAVE_CANVAS_H_MAX, Math.max(h, floor))
    );
  }, [compactTopDock, editorMobileStack, topDockHeightPx]);

  /** 再生行は固定・波形だけドック内に収める */
  useEffect(() => {
    if (
      editorMobileStack ||
      !compactTopDock ||
      topDockHeightPx == null ||
      !Number.isFinite(topDockHeightPx) ||
      topDockHeightPx <= 0
    ) {
      return;
    }
    setWaveCanvasCssH(
      resolveWaveCanvasHeightInTopDock(topDockHeightPx, wideWorkbench)
    );
  }, [topDockHeightPx, compactTopDock, editorMobileStack, wideWorkbench]);

  return {
    brandRailCss,
    waveCanvasCssH,
    setWaveCanvasCssH,
    waveCanvasCssHRef,
  };
}
