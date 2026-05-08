import { useRef } from "react";
import type { RefObject } from "react";
import type { Cue } from "../types/choreography";
import { useWaveCanvasRenderer } from "./useWaveCanvasRenderer";
import type { CueDragEdgeMode } from "../lib/timelineWaveGeometry";

type Params = {
  peaks: number[] | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  viewPortion: number;
  viewPortionRef: RefObject<number>;
  waveViewStartOverrideRef: RefObject<number | null>;
  trimStartSec: number;
  trimEndSec: number | null;
  cuesSorted: Cue[];
  selectedCueIds: string[];
  waveformAmplitudeScale?: number;
  wideWorkbench: boolean;
  waveCanvasCssH: number;
};

/**
 * 波形キャンバス用 DOM ref・ドラッグ用 ref・`peaksRef` 等の同期と `drawWaveformAt`。
 */
export function useTimelineWaveCanvasModel({
  peaks,
  duration,
  currentTime,
  isPlaying,
  viewPortion,
  viewPortionRef,
  waveViewStartOverrideRef,
  trimStartSec,
  trimEndSec,
  cuesSorted,
  selectedCueIds,
  waveformAmplitudeScale,
  wideWorkbench,
  waveCanvasCssH,
}: Params) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadLineOverlayRef = useRef<HTMLDivElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);

  const peaksRef = useRef(peaks);
  const durationRef = useRef(duration);
  const trimRef = useRef({ start: 0, end: null as number | null });
  const currentTimePropRef = useRef(currentTime);

  const cuesRef = useRef<Cue[]>(cuesSorted);
  const selectedCueIdsRef = useRef<string[]>(selectedCueIds);
  const waveAmpRef = useRef(1);

  const lastWaveDrawRangeRef = useRef({ viewStart: 0, viewSpan: 1 });

  const cueDragRef = useRef<{
    pointerId: number;
    cueId: string;
    mode: CueDragEdgeMode;
    moved: boolean;
    grabOffset: number;
    origStart: number;
    origEnd: number;
  } | null>(null);
  const cueDragPreviewRangeRef = useRef<{
    cueId: string;
    tStart: number;
    tEnd: number;
  } | null>(null);
  const newCueRangePreviewRef = useRef<{ tStart: number; tEnd: number } | null>(
    null
  );
  const emptyWaveDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startT: number;
    trimLo: number;
    trimHi: number;
    active: boolean;
  } | null>(null);
  const suppressNextWaveSeekRef = useRef(false);
  const playheadScrubDragRef = useRef<{
    pointerId: number;
    wasPlaying: boolean;
  } | null>(null);
  const waveHoverCueRef = useRef<{
    cueId: string;
    mode: CueDragEdgeMode;
  } | null>(null);

  const isPlayingForWaveRef = useRef(isPlaying);

  peaksRef.current = peaks;
  durationRef.current = duration;
  trimRef.current = { start: trimStartSec, end: trimEndSec };
  currentTimePropRef.current = currentTime;
  cuesRef.current = cuesSorted;
  selectedCueIdsRef.current = selectedCueIds;
  waveAmpRef.current = waveformAmplitudeScale ?? 1;
  isPlayingForWaveRef.current = isPlaying;

  const { drawWaveformAt } = useWaveCanvasRenderer({
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
  });

  return {
    canvasRef,
    playheadLineOverlayRef,
    waveContainerRef,
    peaksRef,
    durationRef,
    trimRef,
    currentTimePropRef,
    cuesRef,
    selectedCueIdsRef,
    waveAmpRef,
    lastWaveDrawRangeRef,
    cueDragRef,
    cueDragPreviewRangeRef,
    newCueRangePreviewRef,
    emptyWaveDragRef,
    suppressNextWaveSeekRef,
    playheadScrubDragRef,
    waveHoverCueRef,
    isPlayingForWaveRef,
    drawWaveformAt,
  };
}
