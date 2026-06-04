import { useEffect, useMemo, useRef, useState } from "react";
import {
  TIMELINE_BRAND_RAIL_CSS,
  TIMELINE_BRAND_RAIL_WIDE_CSS,
} from "../components/TimelineToolbar";
import {
  estimateWideTopDockWaveChromePx,
  WAVE_CANVAS_H_PC_COMPACT_DEFAULT,
  WAVE_CANVAS_H_PC_WIDE_DEFAULT,
} from "../lib/waveDockMetrics";
import { WAVE_CANVAS_H_MAX, WAVE_CANVAS_H_MIN } from "./useTimelineWaveHeightDrag";

/** 波形キャンバス既定高さ（CSS px）。`useTimelineWaveHeightDrag` の最小・最大と揃える */
const WAVE_CANVAS_H_DEFAULT = 36;
/** スマホ縦積み: 波形の既定をさらに低く（縦・横でステージを確保） */
const WAVE_CANVAS_H_MOBILE_STACK = 20;

type Params = {
  wideWorkbench: boolean;
  compactTopDock: boolean;
  /** スマホ縦積みエディタ（狭いビューポート） */
  editorMobileStack?: boolean;
  /** PC 上部ドック外枠の高さ（px）。波形キャンバスを残り領域に合わせる */
  topDockHeightPx?: number | null;
};

/** 上部ドック内で波形キャンバス以外（ツールバー・目盛り・余白・リサイズ枠）の目安 */
export function estimateTopDockWaveChromePx(wideWorkbench: boolean): number {
  if (wideWorkbench) {
    return estimateWideTopDockWaveChromePx();
  }
  return 48;
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
    return WAVE_CANVAS_H_PC_COMPACT_DEFAULT;
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

  /** 右列→上部ドックへ切り替えた直後など、波形高さが既定より小さいままだと帯が潰れて見えなくなるのを防ぐ */
  useEffect(() => {
    if (!compactTopDock) return;
    const floor = editorMobileStack
      ? WAVE_CANVAS_H_MOBILE_STACK
      : wideWorkbench
        ? WAVE_CANVAS_H_PC_WIDE_DEFAULT
        : WAVE_CANVAS_H_PC_COMPACT_DEFAULT;
    setWaveCanvasCssH((h) =>
      Math.min(WAVE_CANVAS_H_MAX, Math.max(h, floor))
    );
  }, [compactTopDock, editorMobileStack, wideWorkbench]);

  /** PC 上部ドック: 再生エリアの高さに合わせて波形キャンバスを伸縮（既定はスマホ同等 96px） */
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
    const chrome = estimateTopDockWaveChromePx(wideWorkbench);
    const next = Math.min(
      WAVE_CANVAS_H_MAX,
      Math.max(WAVE_CANVAS_H_MIN, Math.round(topDockHeightPx - chrome))
    );
    setWaveCanvasCssH(next);
  }, [topDockHeightPx, compactTopDock, editorMobileStack, wideWorkbench]);

  return {
    brandRailCss,
    waveCanvasCssH,
    setWaveCanvasCssH,
    waveCanvasCssHRef,
  };
}
