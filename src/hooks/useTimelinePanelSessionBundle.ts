import { useState, type Ref } from "react";
import type {
  TimelinePanelBodyProps,
  TimelinePanelHandle,
} from "../components/timelinePanelTypes";
import type { BuildTimelinePanelLayoutInput } from "../lib/timelinePanelLayoutProps";
import { useTimelineAudio } from "./useTimelineAudio";
import { useTimelinePlayback } from "./useTimelinePlayback";
import { useTimelineCueActions } from "./useTimelineCueActions";
import { useTimelineWaveHeightDrag } from "./useTimelineWaveHeightDrag";
import { useTimelineWaveWheelZoom } from "./useTimelineWaveWheelZoom";
import { useTimelineWaveViewport } from "./useTimelineWaveViewport";
import { useTimelineWaveMenuState } from "./useTimelineWaveMenuState";
import { useTimelineDeleteSelectedCuesOnKey } from "./useTimelineDeleteSelectedCuesOnKey";
import { useTimelinePanelImperativeHandle } from "./useTimelinePanelImperativeHandle";
import { useTimelinePanelProjectSlice } from "./useTimelinePanelProjectSlice";
import { useTimelinePlaybackUi } from "./useTimelinePlaybackUi";
import { useTimelineWaveCanvasModel } from "./useTimelineWaveCanvasModel";
import { useTimelineWaveDockLayout } from "./useTimelineWaveDockLayout";
import { useTimelineUnmountStagePreviewClear } from "./useTimelineUnmountStagePreviewClear";
import type { TimelinePanelWaveHandlersBundleParams } from "./useTimelinePanelWaveHandlersBundle";

type WavePointerKeys =
  | "onWaveRulerPointerDown"
  | "onWaveClick"
  | "onWaveDoubleClick"
  | "onWaveContextMenu"
  | "onWaveCanvasPointerDown"
  | "onWaveCanvasPointerMove"
  | "onWaveCanvasPointerLeave";

export type TimelinePanelLayoutInputWithoutWavePointers = Omit<
  BuildTimelinePanelLayoutInput,
  WavePointerKeys
>;

export type TimelinePanelSessionBundleResult = {
  waveBundleParams: TimelinePanelWaveHandlersBundleParams;
  layoutInputWithoutWavePointers: TimelinePanelLayoutInputWithoutWavePointers;
};

/**
 * 再生 UI・ビューポート・音源・ホイール・キュー操作まで（波形ポインタ系の直前まで）。
 */
export function useTimelinePanelSessionBundle(
  props: TimelinePanelBodyProps,
  ref: Ref<TimelinePanelHandle>
): TimelinePanelSessionBundleResult {
  const {
    project,
    setProject,
    serverProjectId,
    loggedIn,
    onStagePreviewChange,
    onFormationChosenFromCueList,
    onUndo,
    onRedo,
    undoDisabled = true,
    redoDisabled = true,
    selectedCueIds,
    onSelectedCueIdsChange,
    formationIdForNewCue,
    wideWorkbench = false,
    waveTimelineDockTop = false,
    onWaveTimelineDockTopChange,
    compactTopDock = false,
    editorMobileStack = false,
    compactDockLeading,
    cueListPortalTarget = null,
    onSave,
  } = props;

  const {
    currentTime,
    setCurrentTime,
    isPlaying,
    duration,
    setDuration,
    setPlaybackTrustedDurationSec,
  } = useTimelinePlaybackUi();
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const {
    viewPortion,
    setViewPortion,
    viewPortionRef,
    setWaveViewStartOverride,
    waveViewStartOverrideRef,
    waveView,
  } = useTimelineWaveViewport({
    peaks,
    duration,
    currentTime,
    isPlaying,
  });
  const {
    brandRailCss,
    waveCanvasCssH,
    setWaveCanvasCssH,
    waveCanvasCssHRef,
  } = useTimelineWaveDockLayout({ wideWorkbench, compactTopDock });

  const { cuesSorted, trimStartSec, trimEndSec, formations } =
    useTimelinePanelProjectSlice(project);

  const {
    canvasRef,
    playheadLineOverlayRef,
    waveContainerRef,
    peaksRef,
    durationRef,
    trimRef,
    currentTimePropRef,
    cuesRef,
    selectedCueIdsRef,
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
  } = useTimelineWaveCanvasModel({
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
    waveformAmplitudeScale: project.waveformAmplitudeScale,
    wideWorkbench,
    waveCanvasCssH,
  });

  const {
    waveCueMenu,
    setWaveCueMenu,
    gapRouteMenu,
    setGapRouteMenu,
    waveCueConfirm,
    setWaveCueConfirm,
  } = useTimelineWaveMenuState();

  useTimelineDeleteSelectedCuesOnKey({
    viewMode: project.viewMode,
    selectedCueIdsRef,
    setProject,
    onSelectedCueIdsChange,
  });

  const {
    extractProgress,
    audioFileInputRef,
    onPickAudio,
    openAudioImport,
  } = useTimelineAudio({
    setProject,
    setPeaks,
    loggedIn,
    serverProjectId,
    audioAssetId: project.audioAssetId,
    audioSupabasePath: project.audioSupabasePath,
    flowLocalAudioKey: project.flowLocalAudioKey,
  });

  useTimelineWaveWheelZoom({
    waveContainerRef,
    durationRef,
    lastWaveDrawRangeRef,
    isPlayingForWaveRef,
    setViewPortion,
    setWaveViewStartOverride,
  });

  const { onWaveBorderResizePointerDown } = useTimelineWaveHeightDrag({
    projectViewMode: project.viewMode,
    waveCanvasCssHRef,
    setWaveCanvasCssH,
  });

  const { togglePlay, seekForward5Sec, seekBackward5Sec, stopPlayback } =
    useTimelinePlayback({
      durationSec: duration,
      trimStartSec,
      trimEndSec,
    });

  useTimelinePanelImperativeHandle({
    ref,
    peaksRef,
    setPeaks,
    setDuration,
    setPlaybackTrustedDurationSec,
    togglePlay,
    stopPlayback,
    openAudioImport,
  });

  useTimelineUnmountStagePreviewClear(onStagePreviewChange);

  const {
    addCueStartingAtTime,
    removeCue,
    updateCue,
    duplicateCueSameSettings,
    duplicateCueAtTimelineEnd,
    duplicateCueAfterSource,
    splitCueAtPlayhead,
    saveCueFormationToBoxList,
    adjustFormationDancerCount,
  } = useTimelineCueActions({
    project,
    setProject,
    durationRef,
    currentTime,
    onSelectedCueIdsChange,
    onFormationChosenFromCueList,
    formationIdForNewCue,
    trimStartSec,
    trimEndSec,
  });

  const waveBundleParams: TimelinePanelWaveHandlersBundleParams = {
    project,
    setProject,
    onSelectedCueIdsChange,
    formationIdForNewCue,
    onFormationChosenFromCueList,
    playback: {
      currentTime,
      duration,
      setCurrentTime,
    },
    viewport: { viewPortion },
    projectSlice: {
      cuesSorted,
      trimStartSec,
      trimEndSec,
      formations,
    },
    peaks,
    canvas: {
      canvasRef,
      lastWaveDrawRangeRef,
      cueDragPreviewRangeRef,
      suppressNextWaveSeekRef,
      waveViewStartOverrideRef,
      viewPortionRef,
      drawWaveformAt,
      cuesRef,
      cueDragRef,
      playheadScrubDragRef,
      emptyWaveDragRef,
      newCueRangePreviewRef,
      waveHoverCueRef,
      currentTimePropRef,
      isPlayingForWaveRef,
      durationRef,
    },
    menus: {
      setWaveCueMenu,
      setGapRouteMenu,
      setWaveCueConfirm,
    },
    cueActions: { addCueStartingAtTime },
  };

  const layoutInputWithoutWavePointers: TimelinePanelLayoutInputWithoutWavePointers =
    {
      audioFileInputRef,
      extractProgress,
      onPickAudio,
      compactTopDock,
      editorMobileStack,
      compactDockLeading,
      brandRailCss,
      wideWorkbench,
      waveTimelineDockTop,
      onWaveTimelineDockTopChange,
      viewMode: project.viewMode,
      duration,
      isPlaying,
      currentTime,
      togglePlay,
      stopPlayback,
      seekForward5Sec,
      seekBackward5Sec,
      onSave,
      onUndo,
      onRedo,
      undoDisabled,
      redoDisabled,
      waveContainerRef,
      canvasRef,
      playheadLineOverlayRef,
      peaks,
      waveView,
      waveCanvasCssH,
      onWaveBorderResizePointerDown,
      cuesSorted,
      formations,
      selectedCueIds,
      onSelectedCueIdsChange,
      updateCue,
      adjustFormationDancerCount,
      duplicateCueSameSettings,
      removeCue,
      cueListPortalTarget,
      setProject,
      waveCueMenu,
      setWaveCueMenu,
      gapRouteMenu,
      setGapRouteMenu,
      waveCueConfirm,
      setWaveCueConfirm,
      splitCueAtPlayhead,
      duplicateCueAfterSource,
      duplicateCueAtTimelineEnd,
      saveCueFormationToBoxList,
    };

  return { waveBundleParams, layoutInputWithoutWavePointers };
}
