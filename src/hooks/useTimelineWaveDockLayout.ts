import { useEffect, useMemo, useRef, useState } from "react";
import { TIMELINE_BRAND_RAIL_CSS } from "../components/TimelineToolbar";
import { WAVE_CANVAS_H_MAX } from "./useTimelineWaveHeightDrag";

/** 波形キャンバス既定高さ（CSS px）。`useTimelineWaveHeightDrag` の最小・最大と揃える */
const WAVE_CANVAS_H_DEFAULT = 36;
/** 上部ドック時の既定（コンパクト） */
const WAVE_CANVAS_H_COMPACT_DOCK = 25;
/** スマホ縦積み: 波形の既定をさらに低く（縦・横でステージを確保） */
const WAVE_CANVAS_H_MOBILE_STACK = 20;

type Params = {
  wideWorkbench: boolean;
  compactTopDock: boolean;
  /** スマホ縦積みエディタ（狭いビューポート） */
  editorMobileStack?: boolean;
};

/**
 * タイムライン上部ドック時のブランドレール幅（grid 列）と波形帯の CSS 高さ。
 */
export function useTimelineWaveDockLayout({
  wideWorkbench,
  compactTopDock,
  editorMobileStack = false,
}: Params) {
  const [waveCanvasCssH, setWaveCanvasCssH] = useState(() => {
    if (!compactTopDock) return WAVE_CANVAS_H_DEFAULT;
    if (editorMobileStack) return WAVE_CANVAS_H_MOBILE_STACK;
    return WAVE_CANVAS_H_COMPACT_DOCK;
  });
  const waveCanvasCssHRef = useRef(waveCanvasCssH);
  waveCanvasCssHRef.current = waveCanvasCssH;

  const brandRailCss = useMemo(
    () =>
      wideWorkbench
        ? TIMELINE_BRAND_RAIL_CSS
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
      : WAVE_CANVAS_H_COMPACT_DOCK;
    setWaveCanvasCssH((h) =>
      Math.min(WAVE_CANVAS_H_MAX, Math.max(h, floor))
    );
  }, [compactTopDock, editorMobileStack]);

  return {
    brandRailCss,
    waveCanvasCssH,
    setWaveCanvasCssH,
    waveCanvasCssHRef,
  };
}
