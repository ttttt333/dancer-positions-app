import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  FloorTextPlaceSession,
  SetPiece,
  StageFloorMarkup,
  StageFloorTextMarkup,
} from "../types/choreography";
import { useStageBoardController } from "../hooks/useStageBoardController";
import { useStageBoardLayoutAfterDraft } from "../hooks/useStageBoardLayoutAfterDraft";
import { useSetPieceBlockElements } from "../hooks/useSetPieceBlockElements";
import { useStageDancerMarkerElements } from "../hooks/useStageDancerMarkerElements";
import type {
  BuildStageBoardExportColumnInput,
  StageBoardBodyOverlaysProps,
  StageBoardBodyProps,
  StageBoardLayoutSlots,
} from "./stageBoardTypes";
import {
  audienceRotationDeg,
  MARKER_DIAMETER_PX_MAX as MARKER_PX_MAX,
  MARKER_DIAMETER_PX_MIN as MARKER_PX_MIN,
} from "../lib/projectDefaults";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
  snapXPctToCenterDistanceMmGrid,
} from "../lib/dancerSpacing";
import { resolveArrangeTargetIds } from "../lib/stageSelectionArrange";
import type { DancerQuickEditApply } from "./DancerQuickEditDialog";
import {
  FloorTextMarkupBlock,
  type FloorTextDraftPayload,
  type FloorTextResizeDragPayload,
  type FloorTextTapOrDragPayload,
} from "./FloorTextMarkupBlock";
import { StageBoardContextMenuLayer } from "./StageBoardContextMenuLayer";
import type { StageBoardContextMenuState } from "./StageBoardContextMenuLayer";
import { StageBoardLayout } from "./StageBoardLayout";

/**
 * StageBoardBodyのコア機能
 * - ステージコントローラー
 * - 状態管理
 * - イベントハンドラ
 */
export function useStageBoardBodyCore({
  project,
  setProject,
  playbackDancers,
  browseFormationDancers = null,
  previewDancers = null,
  onRequestLayoutEditFromStage,
  editFormationId = null,
  stageInteractionsEnabled = true,
  playbackSetPieces = null,
  browseSetPieces = null,
  playbackFloorMarkup = null,
  browseFloorMarkup = null,
  floorTextPlaceSession = null,
  onFloorTextPlaceSessionChange,
  viewportTextOverlayRoot = null,
  floorMarkupTool,
  onFloorMarkupToolChange,
  hideFloorMarkupFloatingToolbars = false,
  onGestureHistoryBegin,
  onGestureHistoryEnd,
  onGestureHistoryCancel,
  markHistorySkipNextPush,
  studentViewerFocus = null,
}: StageBoardBodyProps) {
  const {
    isPlaying,
    formations,
    activeFormationId,
    snapGrid,
    gridSpacingMm,
    audienceEdge,
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
    centerFieldGuideIntervalMm,
    viewMode,
    dancerMarkerDiameterPx,
    dancerMarkerDiameterMm,
    stageGridLinesVertical,
    stageGridLinesHorizontal,
    dancerLabelBelow,
    gridStep,
    hanamichiEnabled,
    hanamichiDepthPct,
    stageShape,
    stageShapeActive,
    stageShapeSvgPoints,
    stageShapeMaskPath,
    floorMarkupTool,
    setFloorMarkupTool,
    floorLineDraft,
    setFloorLineDraft,
    floorLineSessionRef,
    stageMainFloorRef,
    setMainFloorPxWidth,
    baseMarkerPx,
    nameBelowClearanceExtraPx,
  } = useStageBoardController({
    project,
    floorMarkupTool: floorMarkupToolProp,
    onFloorMarkupToolChange,
  });

  return {
    isPlaying,
    formations,
    activeFormationId,
    snapGrid,
    gridSpacingMm,
    audienceEdge,
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
    centerFieldGuideIntervalMm,
    viewMode,
    dancerMarkerDiameterPx,
    dancerMarkerDiameterMm,
    stageGridLinesVertical,
    stageGridLinesHorizontal,
    dancerLabelBelow,
    gridStep,
    hanamichiEnabled,
    hanamichiDepthPct,
    stageShape,
    stageShapeActive,
    stageShapeSvgPoints,
    stageShapeMaskPath,
    floorMarkupTool,
    setFloorMarkupTool,
    floorLineDraft,
    setFloorLineDraft,
    floorLineSessionRef,
    stageMainFloorRef,
    setMainFloorPxWidth,
    baseMarkerPx,
    nameBelowClearanceExtraPx,
  };
}
