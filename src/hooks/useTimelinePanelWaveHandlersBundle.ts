import type { Dispatch, SetStateAction } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { useTimelineWaveCanvasActions } from "./useTimelineWaveCanvasActions";
import { useTimelineWaveSurfaceHandlers } from "./useTimelineWaveSurfaceHandlers";

type PlaybackUiSlice = ReturnType<
  typeof import("./useTimelinePlaybackUi").useTimelinePlaybackUi
>;
type ViewportSlice = ReturnType<
  typeof import("./useTimelineWaveViewport").useTimelineWaveViewport
>;
type ProjectSlice = ReturnType<
  typeof import("./useTimelinePanelProjectSlice").useTimelinePanelProjectSlice
>;
type CanvasModelSlice = ReturnType<
  typeof import("./useTimelineWaveCanvasModel").useTimelineWaveCanvasModel
>;
type CueActionsSlice = ReturnType<
  typeof import("./useTimelineCueActions").useTimelineCueActions
>;
type MenuSlice = ReturnType<
  typeof import("./useTimelineWaveMenuState").useTimelineWaveMenuState
>;

type WaveHandlersBundleParams = {
  project: ChoreographyProjectJson;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  onSelectedCueIdsChange: Dispatch<SetStateAction<string[]>>;
  formationIdForNewCue: string;
  onFormationChosenFromCueList?: () => void;
  playback: Pick<
    PlaybackUiSlice,
    "currentTime" | "duration" | "setCurrentTime"
  >;
  viewport: Pick<ViewportSlice, "viewPortion">;
  projectSlice: Pick<
    ProjectSlice,
    "cuesSorted" | "trimStartSec" | "trimEndSec" | "formations"
  >;
  peaks: number[] | null;
  canvas: Pick<
    CanvasModelSlice,
    | "canvasRef"
    | "lastWaveDrawRangeRef"
    | "cueDragPreviewRangeRef"
    | "suppressNextWaveSeekRef"
    | "waveViewStartOverrideRef"
    | "viewPortionRef"
    | "drawWaveformAt"
    | "cuesRef"
    | "cueDragRef"
    | "playheadScrubDragRef"
    | "emptyWaveDragRef"
    | "newCueRangePreviewRef"
    | "waveHoverCueRef"
    | "currentTimePropRef"
    | "isPlayingForWaveRef"
    | "durationRef"
  >;
  menus: Pick<
    MenuSlice,
    "setWaveCueMenu" | "setGapRouteMenu" | "setWaveCueConfirm"
  >;
  cueActions: Pick<CueActionsSlice, "addCueStartingAtTime">;
};

export type TimelinePanelWaveHandlersBundleParams = WaveHandlersBundleParams;

/** 波形キャンバス・目盛りのポインタ系（CanvasActions + SurfaceHandlers） */
export function useTimelinePanelWaveHandlersBundle({
  project,
  setProject,
  onSelectedCueIdsChange,
  formationIdForNewCue,
  onFormationChosenFromCueList,
  playback,
  viewport,
  projectSlice,
  peaks,
  canvas,
  menus,
  cueActions,
}: WaveHandlersBundleParams) {
  const { onWaveClick, onWaveContextMenu, onWaveDoubleClick } =
    useTimelineWaveCanvasActions({
      suppressNextWaveSeekRef: canvas.suppressNextWaveSeekRef,
      canvasRef: canvas.canvasRef,
      duration: playback.duration,
      viewPortion: viewport.viewPortion,
      currentTime: playback.currentTime,
      lastWaveDrawRangeRef: canvas.lastWaveDrawRangeRef,
      peaks,
      cuesSorted: projectSlice.cuesSorted,
      cueDragPreviewRangeRef: canvas.cueDragPreviewRangeRef,
      onSelectedCueIdsChange,
      viewMode: project.viewMode,
      trimStartSec: projectSlice.trimStartSec,
      trimEndSec: projectSlice.trimEndSec,
      setWaveCueMenu: menus.setWaveCueMenu,
      setGapRouteMenu: menus.setGapRouteMenu,
      setWaveCueConfirm: menus.setWaveCueConfirm,
      addCueStartingAtTime: cueActions.addCueStartingAtTime,
    });

  const {
    onWaveRulerPointerDown,
    onWaveCanvasPointerDown,
    onWaveCanvasPointerMove,
    onWaveCanvasPointerLeave,
  } = useTimelineWaveSurfaceHandlers({
    projectViewMode: project.viewMode,
    duration: playback.duration,
    peaks,
    canvasRef: canvas.canvasRef,
    lastWaveDrawRangeRef: canvas.lastWaveDrawRangeRef,
    waveViewStartOverrideRef: canvas.waveViewStartOverrideRef,
    trimStartSec: projectSlice.trimStartSec,
    trimEndSec: projectSlice.trimEndSec,
    currentTimePropRef: canvas.currentTimePropRef,
    isPlayingForWaveRef: canvas.isPlayingForWaveRef,
    viewPortionRef: canvas.viewPortionRef,
    drawWaveformAt: canvas.drawWaveformAt,
    cuesSorted: projectSlice.cuesSorted,
    cuesRef: canvas.cuesRef,
    cueDragRef: canvas.cueDragRef,
    cueDragPreviewRangeRef: canvas.cueDragPreviewRangeRef,
    playheadScrubDragRef: canvas.playheadScrubDragRef,
    emptyWaveDragRef: canvas.emptyWaveDragRef,
    newCueRangePreviewRef: canvas.newCueRangePreviewRef,
    waveHoverCueRef: canvas.waveHoverCueRef,
    setCurrentTime: playback.setCurrentTime,
    onSelectedCueIdsChange,
    suppressNextWaveSeekRef: canvas.suppressNextWaveSeekRef,
    setProject,
    durationRef: canvas.durationRef,
    formationIdForNewCue,
    formations: projectSlice.formations,
    onFormationChosenFromCueList,
    viewPortion: viewport.viewPortion,
    currentTime: playback.currentTime,
  });

  return {
    onWaveClick,
    onWaveContextMenu,
    onWaveDoubleClick,
    onWaveRulerPointerDown,
    onWaveCanvasPointerDown,
    onWaveCanvasPointerMove,
    onWaveCanvasPointerLeave,
  };
}
