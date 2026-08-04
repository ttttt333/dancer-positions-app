import { useRef, useCallback, type ChangeEvent, type Ref } from "react";
import type { PlaybackScrubSession } from "../lib/playbackTransport";
import { useWavePeaksStore } from "../store/wavePeaksStore";
import type {
  TimelinePanelBodyProps,
  TimelinePanelHandle,
} from "../components/timelinePanelTypes";
import type { BuildTimelinePanelLayoutInput } from "../lib/timelinePanelLayoutProps";
import { useTimelinePlayback } from "./useTimelinePlayback";
import { useTimelineCueActions } from "./useTimelineCueActions";
import { useAuth } from "../context/AuthContext";
import { useProUpgrade } from "../components/ProUpgradeProvider";
import {
  isDancerCountOverFreeLimit,
  isNextCueOverFreeLimit,
} from "../lib/proFeatureLimits";
import { useTimelineWaveHeightDrag } from "./useTimelineWaveHeightDrag";
import { useTimelineWaveWheelZoom } from "./useTimelineWaveWheelZoom";
import { useTimelineWaveViewport } from "./useTimelineWaveViewport";
import { useTimelineWaveButtonZoom } from "./useTimelineWaveButtonZoom";
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
  | "onWaveCanvasPointerLeave"
  | "onPlayheadLinePointerDown"
  | "onPlayheadLinePointerMove"
  | "onPlayheadLinePointerUp"
  | "onPlayheadLinePointerCancel";

export type TimelinePanelLayoutInputWithoutWavePointers = Omit<
  BuildTimelinePanelLayoutInput,
  WavePointerKeys
>;

export type TimelinePanelSessionBundleResult = {
  waveBundleParams: TimelinePanelWaveHandlersBundleParams;
  layoutInputWithoutWavePointers: TimelinePanelLayoutInputWithoutWavePointers;
  viewportControls: {
    setViewPortion: (portion: number) => void;
    setWaveViewStartOverride: (start: number | null) => void;
  };
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
    showFormationChange = false,
    onOpenFormationChange,
    cueListPortalTarget = null,
    topDockHeightPx = null,
    onSave,
    onOpenAudioImport,
    onOpenPathEditor,
    publicShareView = false,
    audioFileInputRef,
    extractProgress = null,
    onPickAudio,
    onRequestAddCueAtTime,
  } = props;

  const {
    currentTime,
    setCurrentTime,
    isPlaying,
    duration,
    setDuration,
    setPlaybackTrustedDurationSec,
  } = useTimelinePlaybackUi();
  const peaks = useWavePeaksStore((s) => s.peaks);
  const playheadScrubDragRef = useRef<{
    pointerId: number;
    scrubSession: PlaybackScrubSession | null;
    originX: number;
    originY: number;
    armed: boolean;
  } | null>(null);
  const {
    viewPortion,
    setViewPortion,
    viewPortionRef,
    waveViewStartOverride,
    setWaveViewStartOverride,
    waveViewStartOverrideRef,
    waveView,
  } = useTimelineWaveViewport({
    peaks,
    duration,
    currentTime,
    isPlaying,
    playheadScrubDragRef,
  });
  const {
    brandRailCss,
    waveCanvasCssH,
    setWaveCanvasCssH,
    waveCanvasCssHRef,
  } = useTimelineWaveDockLayout({
    wideWorkbench,
    compactTopDock,
    editorMobileStack,
    topDockHeightPx,
  });

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
    waveSeekSnapLatchRef,
    wavePointerGestureRef,
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
    playheadScrubDragRef,
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

  const openAudioImport = onOpenAudioImport ?? (() => {});

  useTimelineWaveWheelZoom({
    waveContainerRef,
    durationRef,
    viewPortionRef,
    waveViewStartOverrideRef,
    currentTimePropRef,
    isPlayingForWaveRef,
    cueDragRef,
    emptyWaveDragRef,
    setViewPortion,
    setWaveViewStartOverride,
  });

  const { zoomWaveIn, zoomWaveOut } = useTimelineWaveButtonZoom({
    durationRef,
    currentTimePropRef,
    isPlayingForWaveRef,
    cueDragRef,
    emptyWaveDragRef,
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
    setDuration,
    setPlaybackTrustedDurationSec,
    togglePlay,
    stopPlayback,
    seekForward5Sec,
    seekBackward5Sec,
    openAudioImport,
  });

  useTimelineUnmountStagePreviewClear(onStagePreviewChange);

  const { me } = useAuth();
  const { requestProUpgrade } = useProUpgrade();
  const assertCanAddCue = useCallback(() => {
    if (isNextCueOverFreeLimit(me, project.cues.length)) {
      requestProUpgrade("cue_limit");
      return false;
    }
    return true;
  }, [me, project.cues.length, requestProUpgrade]);
  const assertCanSetDancerCount = useCallback(
    (nextCount: number) => {
      if (isDancerCountOverFreeLimit(me, nextCount)) {
        requestProUpgrade("dancer_limit");
        return false;
      }
      return true;
    },
    [me, requestProUpgrade]
  );

  const {
    addCueStartingAtTime,
    removeCue,
    updateCue,
    duplicateCueSameSettings,
    duplicateCueAtTimelineEnd,
    duplicateCueAfterSource,
    duplicateCueAtTime,
    requestAddCueAtTime,
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
    onRequestAddCueAtTime,
    assertCanAddCue,
    assertCanSetDancerCount,
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
    viewport: { viewPortion, waveViewStartOverride, setWaveViewStartOverride },
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
      waveSeekSnapLatchRef,
      wavePointerGestureRef,
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
      peaksRef,
    },
    menus: {
      setWaveCueMenu,
      setGapRouteMenu,
      setWaveCueConfirm,
    },
    cueActions: {
      addCueStartingAtTime,
      duplicateCueAfterSource,
      duplicateCueAtTime,
      requestAddCueAtTime,
    },
  };

  const layoutInputWithoutWavePointers: TimelinePanelLayoutInputWithoutWavePointers =
    {
      audioFileInputRef,
      extractProgress,
      onPickAudio: onPickAudio ?? ((_e: ChangeEvent<HTMLInputElement>) => {}),
      audioChromeRenderedExternally: audioFileInputRef != null,
      compactTopDock,
      editorMobileStack,
      topDockHeightPx,
      compactDockLeading,
      showFormationChange,
      onOpenFormationChange,
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
      onWaveZoomIn: zoomWaveIn,
      onWaveZoomOut: zoomWaveOut,
      onSave,
      onOpenAudioImport,
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
      onOpenPathEditor,
    };

  return {
    waveBundleParams,
    layoutInputWithoutWavePointers,
    viewportControls: { setViewPortion, setWaveViewStartOverride },
  };
}
