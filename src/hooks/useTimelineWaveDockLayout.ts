import { useEffect, useMemo, useRef, useState } from "react";
import { TIMELINE_BRAND_RAIL_CSS } from "../components/TimelineToolbar";
import { WAVE_CANVAS_H_MAX } from "./useTimelineWaveHeightDrag";

/** 波形キャンバス既定高さ（CSS px）。`useTimelineWaveHeightDrag` の最小・最大と揃える */
const WAVE_CANVAS_H_DEFAULT = 36;
/** 上部ドック時の既定（コンパクト） */
const WAVE_CANVAS_H_COMPACT_DOCK = 25;

type Params = {
  wideWorkbench: boolean;
  compactTopDock: boolean;
};

/**
 * タイムライン上部ドック時のブランドレール幅（grid 列）と波形帯の CSS 高さ。
 */
export function useTimelineWaveDockLayout({
  wideWorkbench,
  compactTopDock,
}: Params) {
  const [waveCanvasCssH, setWaveCanvasCssH] = useState(() =>
    compactTopDock ? WAVE_CANVAS_H_COMPACT_DOCK : WAVE_CANVAS_H_DEFAULT
  );
  const waveCanvasCssHRef = useRef(waveCanvasCssH);
  waveCanvasCssHRef.current = waveCanvasCssH;

  const brandRailCss = useMemo(
    () =>
      wideWorkbench
        ? TIMELINE_BRAND_RAIL_CSS
        : "minmax(0, min(72px, 18vw))",
    [wideWorkbench]
  );

  /** 右列→上部ドックへ切り替えた直後など、波形高さが既定より小さいままだと帯が潰れて見えなくなるのを防ぐ */
  useEffect(() => {
    if (!compactTopDock) return;
    setWaveCanvasCssH((h) =>
      Math.min(WAVE_CANVAS_H_MAX, Math.max(h, WAVE_CANVAS_H_COMPACT_DOCK))
    );
  }, [compactTopDock]);

  return {
    brandRailCss,
    waveCanvasCssH,
    setWaveCanvasCssH,
    waveCanvasCssHRef,
  };
}
