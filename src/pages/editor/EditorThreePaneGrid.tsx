import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { StageBoard } from "../../components/StageBoard";
import { EditorStageWorkbench, WorkbenchCuePager } from "../../components/EditorStageWorkbench";
import { RosterTimelineStrip } from "../../components/RosterTimelineStrip";
import { btnAccent, btnSecondary } from "../../components/stageButtonStyles";
import { panelCard, shell } from "../../theme/choreoShell";
import { EDITOR_GRID_GAP_PX, STAGE_RESIZER_PX } from "./editorConstants";
import type { EditorLayoutProps } from "./editorLayoutProps";
import { useAssignRef, useAttachElementRef } from "./useSafeElementRef";
import { formatMmSsFloor } from "../../lib/timeFormat";
import { createDefaultFloorTextPlaceSession } from "../../lib/floorTextPlaceSession";
import { useMobileShellBridgeStore } from "../../store/useMobileShellBridgeStore";
import { useVideoExportUiStore } from "../../store/videoExportUiStore";
import {
  ChoreoViewerLandscapeRail,
  ChoreoViewerTransportControls,
  PUBLIC_VIEWER_MARKER_DISPLAY_SCALE,
} from "../../components/ChoreoViewerBottomBar";

const Stage3DView = lazy(() =>
  import("../../components/Stage3DView").then((m) => ({ default: m.Stage3DView }))
);


export function EditorThreePaneGrid(props: EditorLayoutProps) {
  const activeFormationId = props.activeFormationId as never;
  const addCueDialogEl = props.addCueDialogEl as never;
  const addDancerFromStageToolbar = props.addDancerFromStageToolbar as never;
  const aiSuggestOpen = props.aiSuggestOpen as never;
  const applyStageAreaSettingsDraft = props.applyStageAreaSettingsDraft as never;
  const beginGestureHistory = props.beginGestureHistory as never;
  const browseFloorMarkup = props.browseFloorMarkup as never;
  const browseFormationDancers = props.browseFormationDancers as never;
  const browseSetPieces = props.browseSetPieces as never;
  const cancelGestureHistory = props.cancelGestureHistory as never;
  const choreoMemberSheetOpen = props.choreoMemberSheetOpen as never;
  const choreoPublicView = props.choreoPublicView as never;
  const choreoStudentPick = props.choreoStudentPick as never;
  const choreoToolbarSharedProps = props.choreoToolbarSharedProps as never;
  const cloudSaveDialogOpen = props.cloudSaveDialogOpen as never;
  const collabActive = props.collabActive as never;
  const color = props.color as never;
  const commitFloorTextPlace = props.commitFloorTextPlace as never;
  const commitStageGridCmInput = props.commitStageGridCmInput as never;
  const confirmAddSetPiece = props.confirmAddSetPiece as never;
  const crew = props.crew as never;
  const cue = props.cue as never;
  const cueById = props.cueById as never;
  const cueListModalOpen = props.cueListModalOpen as never;
  const cuesSortedForStageJump = props.cuesSortedForStageJump as never;
  const currentTime = props.currentTime as never;
  const d = props.d as never;
  const dancersFor3d = props.dancersFor3d as never;
  const defaultName = props.defaultName as never;
  const duration = props.duration as never;
  const dynamicContainerStyle = props.dynamicContainerStyle as never;
  const dynamicStageShellStyle = props.dynamicStageShellStyle as never;
  const dynamicToolsAsideStyle = props.dynamicToolsAsideStyle as never;
  const editTargetId = props.editTargetId as never;
  const editorMobileLandscape = props.editorMobileLandscape as never;
  const editorPaneGridTemplateColumns = props.editorPaneGridTemplateColumns as never;
  const editorPaneGridTemplateRows = props.editorPaneGridTemplateRows as never;
  const editorPaneRef = props.editorPaneRef as never;
  const editorSurfaceEl = props.editorSurfaceEl as never;
  const editorViewerSheetOpen = props.editorViewerSheetOpen as never;
  const endGestureHistory = props.endGestureHistory as never;
  const endSplitDrag = props.endSplitDrag as never;
  const endTopDockResize = props.endTopDockResize as never;
  const exportDialogEl = props.exportDialogEl as never;
  const f = props.f as never;
  const fid = props.fid as never;
  const floorMarkupTool = props.floorMarkupTool as never;
  const floorTextPlaceSession = props.floorTextPlaceSession as never;
  const floorTextSideSheetOpen = props.floorTextSideSheetOpen as never;
  const flowLibraryDialogEl = props.flowLibraryDialogEl as never;
  const fontFamily = props.fontFamily as never;
  const formationBoxManagerDialogEl = props.formationBoxManagerDialogEl as never;
  const setFormationPresetPickerOpen = props.setFormationPresetPickerOpen as never;
  const formationById = props.formationById as never;
  const formationId = props.formationId as never;
  const getWavePeaksSnapshot = props.getWavePeaksSnapshot as never;
  const grid = props.grid as never;
  const gridDepthCmInput = props.gridDepthCmInput as never;
  const gridNudgeDidRepeatRef = props.gridNudgeDidRepeatRef as never;
  const gridWidthCmInput = props.gridWidthCmInput as never;
  const hasRosterMembers = props.hasRosterMembers as never;
  const importCrewCsvFromStageToolbar = props.importCrewCsvFromStageToolbar as never;
  const input = props.input as never;
  const isPlaying = props.isPlaying as never;
  const jumpToPagerSlot = props.jumpToPagerSlot as never;
  const markHistorySkipNextPush = props.markHistorySkipNextPush as never;
  const me = props.me as never;
  const memberRosterSheetOpen = props.memberRosterSheetOpen as never;
  const mobileEditorToolsExpanded = props.mobileEditorToolsExpanded as never;
  const mobileEditorWaveExpanded = props.mobileEditorWaveExpanded as never;
  const mobileStackEditor = props.mobileStackEditor as never;
  const n = props.n as never;
  const next = props.next as never;
  const nudgeStageGridCm = props.nudgeStageGridCm as never;
  const onChange = props.onChange as never;
  const onFloorTextPlaceSessionChange = props.onFloorTextPlaceSessionChange as never;
  const onRosterConfirmReturnToTimeline = props.onRosterConfirmReturnToTimeline as never;
  const onSplitLostCapture = props.onSplitLostCapture as never;
  const onSplitPointerDown = props.onSplitPointerDown as never;
  const onSplitPointerMove = props.onSplitPointerMove as never;
  const onStageGridCmInput = props.onStageGridCmInput as never;
  const onTopDockResizeDoubleClick = props.onTopDockResizeDoubleClick as never;
  const onTopDockResizeDown = props.onTopDockResizeDown as never;
  const onTopDockResizeMove = props.onTopDockResizeMove as never;
  const onUpdateGlobalFloorMarkup = props.onUpdateGlobalFloorMarkup as never;
  const openAudioImport = props.openAudioImport as never;
  const p = props.p as never;
  const pathEditorCueId = props.pathEditorCueId as never;
  const performCloudSave = props.performCloudSave as never;
  const playbackAudioElement = props.playbackAudioElement as never;
  const playbackDancersForStage = props.playbackDancersForStage as never;
  const playbackFloorMarkupForStage = props.playbackFloorMarkupForStage as never;
  const playbackSetPiecesForStage = props.playbackSetPiecesForStage as never;
  const project = props.project as never;
  const projectName = props.projectName as never;
  const publicNarrowLayout = props.publicNarrowLayout as never;
  const publicViewTightHeight = props.publicViewTightHeight as never;
  const viewerChromeCollapsed = props.viewerChromeCollapsed as never;
  const resyncViewerPlayback = props.resyncViewerPlayback as never;
  const raw = props.raw as never;
  const redo = props.redo as never;
  const result = props.result as never;
  const rightPaneCollapsed = props.rightPaneCollapsed as never;
  const rightPaneStackRef = props.rightPaneStackRef as never;
  const rightPaneTopSectionStyle = props.rightPaneTopSectionStyle as never;
  const rosterImportSheetEl = props.rosterImportSheetEl as never;
  const rosterOnlyMode = props.rosterOnlyMode as never;
  const row = props.row as never;
  const saveStageToFormationBox = props.saveStageToFormationBox as never;
  const saving = props.saving as never;
  const scale = props.scale as never;
  const selectedCue = props.selectedCue as never;
  const selectedCueId = props.selectedCueId as never;
  const serverId = props.serverId as never;
  const setAddCueDialogOpen = props.setAddCueDialogOpen as never;
  const setAiSuggestOpen = props.setAiSuggestOpen as never;
  const setChoreoMemberSheetOpen = props.setChoreoMemberSheetOpen as never;
  const setChoreoStudentPick = props.setChoreoStudentPick as never;
  const setCloudSaveDialogOpen = props.setCloudSaveDialogOpen as never;
  const setCueListModalOpen = props.setCueListModalOpen as never;
  const setCueListPortalEl = props.setCueListPortalEl as never;
  const setEditorSurfaceEl = props.setEditorSurfaceEl as never;
  const setEditorViewerPreviewPick = props.setEditorViewerPreviewPick as never;
  const setEditorViewerSheetOpen = props.setEditorViewerSheetOpen as never;
  const setFloorMarkupTool = props.setFloorMarkupTool as never;
  const setFloorTextPlaceSession = props.setFloorTextPlaceSession as never;
  const setFloorTextSideSheetOpen = props.setFloorTextSideSheetOpen as never;
  const setFlowLibraryOpen = props.setFlowLibraryOpen as never;
  const setMemberRosterSheetOpen = props.setMemberRosterSheetOpen as never;
  const setMobileEditorToolsExpanded = props.setMobileEditorToolsExpanded as never;
  const setMobileEditorWaveExpanded = props.setMobileEditorWaveExpanded as never;
  const setPathEditorCueId = props.setPathEditorCueId as never;
  const setPiecePickerOpen = props.setPiecePickerOpen as never;
  const setProjectSafe = props.setProjectSafe as never;
  const setRightPaneCollapsed = props.setRightPaneCollapsed as never;
  const setSelectedCueIds = props.setSelectedCueIds as never;
  const setSetPiecePickerOpen = props.setSetPiecePickerOpen as never;
  const setShareLinksOpen = props.setShareLinksOpen as never;
  const setShortcutsHelpOpen = props.setShortcutsHelpOpen as never;
  const setShowMotionArrows = props.setShowMotionArrows as never;
  const setStageAreaPresetList = props.setStageAreaPresetList as never;
  const setStageAreaPresetSelectNonce = props.setStageAreaPresetSelectNonce as never;
  const setStageAreaSettingsDraft = props.setStageAreaSettingsDraft as never;
  const setStageAreaSettingsOpen = props.setStageAreaSettingsOpen as never;
  const setStagePreviewDancers = props.setStagePreviewDancers as never;
  const setStageSettingsOpen = props.setStageSettingsOpen as never;
  const setStageShapePickerOpen = props.setStageShapePickerOpen as never;
  const setStageView = props.setStageView as never;
  const setStageZenFullscreen = props.setStageZenFullscreen as never;
  const setTextPanelPortalEl = props.setTextPanelPortalEl as never;
  const shareLinksOpen = props.shareLinksOpen as never;
  const shareLinksUrls = props.shareLinksUrls as never;
  const shortcutsHelpOpen = props.shortcutsHelpOpen as never;
  const showMotionArrows = props.showMotionArrows as never;
  const showTopWaveDock = props.showTopWaveDock as never;
  const sortedCuesForEditor = props.sortedCuesForEditor as never;
  const stageAreaDraftHasMainFloor = props.stageAreaDraftHasMainFloor as never;
  const stageAreaPresetList = props.stageAreaPresetList as never;
  const stageAreaPresetSelectNonce = props.stageAreaPresetSelectNonce as never;
  const stageAreaSettingsDraft = props.stageAreaSettingsDraft as never;
  const stageAreaSettingsDraftRef = props.stageAreaSettingsDraftRef as never;
  const stageAreaSettingsOpen = props.stageAreaSettingsOpen as never;
  const stageBoardProject = props.stageBoardProject as never;
  const stagePreviewDancers = props.stagePreviewDancers as never;
  const stageRedoDisabled = props.stageRedoDisabled as never;
  const stageSectionRef = props.stageSectionRef as never;
  const stageSettingsOpen = props.stageSettingsOpen as never;
  const stageShapePickerOpen = props.stageShapePickerOpen as never;
  const stageUndoDisabled = props.stageUndoDisabled as never;
  const stageWorkbenchProps = props.stageWorkbenchProps as never;
  const stageView = props.stageView as never;
  const stageZenLayout = props.stageZenLayout as never;
  const startGridNudgeRepeat = props.startGridNudgeRepeat as never;
  const stopGridNudgeRepeat = props.stopGridNudgeRepeat as never;
  const studentViewerFocusForStage = props.studentViewerFocusForStage as never;
  const t = props.t as never;
  const text = props.text as never;
  const textPanelPortalEl = props.textPanelPortalEl as never;
  const timelinePanelEl = props.timelinePanelEl as never;
  const timelineRef = props.timelineRef as never;
  const title = props.title as never;
  const topDockSectionRef = props.topDockSectionRef as never;
  const undo = props.undo as never;
  const v = props.v as never;
  const viewerLocalStorageKey = props.viewerLocalStorageKey as never;
  const wideBottomDockPx = props.wideBottomDockPx as never;
  const wideEditorLayout = props.wideEditorLayout as never;
  const workbenchInRightRail = props.workbenchInRightRail as never;
  /** PCワイド＋上部波形: ステージを波形バー直下まで隙間なく広げる */
  const stageFlushTopDock =
    wideEditorLayout && showTopWaveDock && !stageZenLayout && !mobileStackEditor;
  const xPct = props.xPct as never;
  const yPct = props.yPct as never;

  const attachEditorPane = useAttachElementRef(setEditorSurfaceEl, editorPaneRef);
  const attachTopDockSection = useAssignRef(topDockSectionRef);

  // MobileShell 用: stageView・ダイアログ開閉・undo/redo・タブメニューアクション を bridge store に同期
  // 不安定な関数参照を ref に退避して依存配列ループを防ぐ
  const addCueFnRef = useRef(setAddCueDialogOpen as ((open: boolean) => void) | null);
  const stageSettingsFnRef = useRef(setStageAreaSettingsOpen as ((open: boolean) => void) | null);
  const undoFnRef = useRef(undo as (() => void) | null);
  const redoFnRef = useRef(redo as (() => void) | null);
  const saveSpotFnRef = useRef(saveStageToFormationBox as (() => void) | null);
  const addTextFnRef = useRef<(() => void) | null>(null);
  const cueListFnRef = useRef(setCueListModalOpen as ((open: boolean) => void) | null);
  const stageShapeFnRef = useRef(setStageShapePickerOpen as ((open: boolean) => void) | null);
  const setPieceFnRef = useRef(setSetPiecePickerOpen as ((open: boolean) => void) | null);
  const audioImportFnRef = useRef(openAudioImport as (() => void) | null);
  const memberListFnRef = useRef(setMemberRosterSheetOpen as ((open: boolean) => void) | null);
  const rosterImportFnRef = useRef(importCrewCsvFromStageToolbar as (() => void) | null);
  const memberAddFnRef = useRef(setChoreoMemberSheetOpen as ((open: boolean) => void) | null);
  const shareLinksOpenFnRef = useRef(setShareLinksOpen as ((open: boolean) => void) | null);
  const helpFnRef = useRef(setShortcutsHelpOpen as ((open: boolean) => void) | null);
  const flowLibraryFnRef = useRef(setFlowLibraryOpen as ((open: boolean) => void) | null);
  const aiSuggestFnRef = useRef(setAiSuggestOpen as ((open: boolean) => void) | null);
  const videoExportFnRef = useRef<(() => void) | null>(null);

  addCueFnRef.current = setAddCueDialogOpen as ((open: boolean) => void);
  stageSettingsFnRef.current = setStageAreaSettingsOpen as ((open: boolean) => void);
  undoFnRef.current = undo as (() => void);
  redoFnRef.current = redo as (() => void);
  saveSpotFnRef.current = saveStageToFormationBox as (() => void);
  const stageViewRef = useRef(stageView);
  stageViewRef.current = stageView;

  addTextFnRef.current = () => {
    if (stageViewRef.current !== "2d") {
      window.alert(t("editor.layout.floorText2dOnly"));
      return;
    }
    (setFloorTextPlaceSession as (v: unknown) => void)(
      createDefaultFloorTextPlaceSession()
    );
    (setFloorTextSideSheetOpen as (open: boolean) => void)(true);
  };
  cueListFnRef.current = setCueListModalOpen as ((open: boolean) => void);
  stageShapeFnRef.current = setStageShapePickerOpen as ((open: boolean) => void);
  setPieceFnRef.current = setSetPiecePickerOpen as ((open: boolean) => void);
  audioImportFnRef.current = openAudioImport as (() => void);
  memberListFnRef.current = setMemberRosterSheetOpen as ((open: boolean) => void);
  rosterImportFnRef.current = importCrewCsvFromStageToolbar as (() => void);
  memberAddFnRef.current = setChoreoMemberSheetOpen as ((open: boolean) => void);
  shareLinksOpenFnRef.current = setShareLinksOpen as ((open: boolean) => void);
  helpFnRef.current = setShortcutsHelpOpen as ((open: boolean) => void);
  flowLibraryFnRef.current = setFlowLibraryOpen as ((open: boolean) => void);
  aiSuggestFnRef.current = setAiSuggestOpen as ((open: boolean) => void);
  videoExportFnRef.current = () => useVideoExportUiStore.getState().openSheet();

  const jumpToPagerSlotRef = useRef(jumpToPagerSlot as (slotIdx: number) => void);
  jumpToPagerSlotRef.current = jumpToPagerSlot as (slotIdx: number) => void;
  const cueNavRef = useRef({ slotIdx: 0, total: 1, hasRoster: false });

  const handleMobileCuePrev = useCallback(() => {
    const { slotIdx: s } = cueNavRef.current;
    if (s > 0) jumpToPagerSlotRef.current(s - 1);
  }, []);

  const handleMobileCueNext = useCallback(() => {
    const { slotIdx: s, total: t, hasRoster: hr } = cueNavRef.current;
    if (s < 0) {
      jumpToPagerSlotRef.current(hr ? 1 : 0);
      return;
    }
    if (s < t - 1) jumpToPagerSlotRef.current(s + 1);
  }, []);

  const handleMobileSelectCueNearTime = useCallback(
    (tSec: number) => {
      const cues = Array.isArray(sortedCuesForEditor)
        ? (sortedCuesForEditor as Array<{ tStartSec: number }>)
        : [];
      if (cues.length === 0) return;
      let bestIdx = 0;
      let bestDist = Infinity;
      cues.forEach((c, i) => {
        const d = Math.abs(c.tStartSec - tSec);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      if (bestDist > 1.5) return;
      const { hasRoster } = cueNavRef.current;
      jumpToPagerSlotRef.current(hasRoster ? bestIdx + 1 : bestIdx);
    },
    [sortedCuesForEditor]
  );

  const setMobileShellBridge = useMobileShellBridgeStore((s) => s.setMobileShellBridge);
  useEffect(() => {
    const cues = Array.isArray(cuesSortedForStageJump)
      ? (cuesSortedForStageJump as Array<{ id: string }>)
      : [];
    const hasRoster = Boolean(hasRosterMembers);
    const rosterHidden =
      (project as { rosterHidesTimeline?: boolean }).rosterHidesTimeline === true;
    const cueIdx =
      selectedCueId != null && selectedCueId !== ""
        ? cues.findIndex((c) => c.id === selectedCueId)
        : -1;

    let slotIdx: number;
    if (hasRoster) {
      if (rosterHidden) slotIdx = 0;
      else if (cueIdx >= 0) slotIdx = cueIdx + 1;
      else slotIdx = -1;
    } else {
      slotIdx = cueIdx;
    }

    const total = Math.max(1, hasRoster ? cues.length + 1 : cues.length);
    cueNavRef.current = { slotIdx, total, hasRoster };

    setMobileShellBridge({
      stageView: stageView as "2d" | "3d",
      undoDisabled: stageUndoDisabled as boolean,
      redoDisabled: stageRedoDisabled as boolean,
      currentCueIndex: slotIdx >= 0 ? slotIdx : 0,
      totalCues: total,
      onCuePrev: handleMobileCuePrev,
      onCueNext: handleMobileCueNext,
      onStageViewChange: (v: "2d" | "3d") => (setStageView as (v: "2d" | "3d") => void)(v),
      onAddCue: () => addCueFnRef.current?.(true),
      onStageSettings: () => stageSettingsFnRef.current?.(true),
      onUndo: () => undoFnRef.current?.(),
      onRedo: () => redoFnRef.current?.(),
      onSaveSpot: () => saveSpotFnRef.current?.(),
      onAddText: () => addTextFnRef.current?.(),
      onCueList: () => cueListFnRef.current?.(true),
      onStageShape: () => stageShapeFnRef.current?.(true),
      onSetPiece: () => setPieceFnRef.current?.(true),
      onAudioImport: () => audioImportFnRef.current?.(),
      onAiSuggest: () => aiSuggestFnRef.current?.(true),
      onRosterImport: () => rosterImportFnRef.current?.(),
      onMemberList: () => memberListFnRef.current?.(true),
      onMemberAdd: () => memberAddFnRef.current?.(true),
      onShareLinks: () => shareLinksOpenFnRef.current?.(true),
      onHelp: () => helpFnRef.current?.(true),
      onFlowLibrary: () => flowLibraryFnRef.current?.(true),
      onVideoExport: () => videoExportFnRef.current?.(),
      cueStartTimes: Array.isArray(sortedCuesForEditor)
        ? (sortedCuesForEditor as Array<{ tStartSec: number }>).map((c) => c.tStartSec)
        : [],
      onSelectCueNearTime: handleMobileSelectCueNearTime,
      trimStartSec:
        typeof (project as { trimStartSec?: number })?.trimStartSec === "number"
          ? (project as { trimStartSec: number }).trimStartSec
          : 0,
      trimEndSec:
        (project as { trimEndSec?: number | null })?.trimEndSec ?? null,
    });
  }, [
    stageView,
    stageUndoDisabled,
    stageRedoDisabled,
    setStageView,
    setMobileShellBridge,
    sortedCuesForEditor,
    cuesSortedForStageJump,
    selectedCueId,
    hasRosterMembers,
    project,
    handleMobileCuePrev,
    handleMobileCueNext,
    handleMobileSelectCueNearTime,
  ]);

  return (
      <div
        ref={attachEditorPane}
        className={[
          "editor-three-pane",
          mobileStackEditor && "editor-mobile-stack",
          publicNarrowLayout && "editor-three-pane--public-narrow",
          publicNarrowLayout &&
            publicViewTightHeight &&
            "editor-three-pane--public-tight",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "visible",
          ...(mobileStackEditor
            ? {
                ...dynamicContainerStyle,
                gap: 0,
                padding: mobileStackEditor
                  ? "2px max(4px, env(safe-area-inset-right, 0px)) max(6px, env(safe-area-inset-bottom, 0px)) max(4px, env(safe-area-inset-left, 0px))"
                  : "4px max(6px, env(safe-area-inset-right, 0px)) max(8px, env(safe-area-inset-bottom, 0px)) max(6px, env(safe-area-inset-left, 0px))",
                marginTop: 0,
              }
            : {
                display: "grid",
                gridTemplateColumns: editorPaneGridTemplateColumns,
                gridTemplateRows: editorPaneGridTemplateRows,
                gap: wideEditorLayout ? (stageFlushTopDock ? "0" : "4px") : `${EDITOR_GRID_GAP_PX}px`,
                padding: publicNarrowLayout
                  ? "0"
                  : wideEditorLayout
                    ? "0px 0px 0px 0px"
                    : "6px max(6px, env(safe-area-inset-right, 0px)) calc(max(8px, 2cm) + env(safe-area-inset-bottom, 0px)) max(6px, env(safe-area-inset-left, 0px))",
                paddingBottom:
                  choreoPublicView &&
                  choreoStudentPick &&
                  !viewerChromeCollapsed
                    ? publicViewTightHeight
                      ? "max(4px, env(safe-area-inset-bottom, 0px))"
                      : "calc(var(--choreo-viewer-bar-h, 104px) + env(safe-area-inset-bottom, 0px))"
                    : choreoPublicView
                      ? "max(4px, env(safe-area-inset-bottom, 0px))"
                      : undefined,
                paddingLeft:
                  choreoPublicView &&
                  publicViewTightHeight &&
                  choreoStudentPick &&
                  !viewerChromeCollapsed
                    ? "max(52px, calc(44px + env(safe-area-inset-left, 0px)))"
                    : undefined,
                marginTop: 0,
              }),
        }}
      >
        {showTopWaveDock && !stageZenLayout && !wideEditorLayout && !publicNarrowLayout && !mobileStackEditor ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={t("editor.layout.wavePlaybackResizeAria")}
            title={t("editor.layout.wavePlaybackResizeTitle")}
            onPointerDown={onTopDockResizeDown}
            onPointerMove={onTopDockResizeMove}
            onPointerUp={endTopDockResize}
            onPointerCancel={endTopDockResize}
            onDoubleClick={onTopDockResizeDoubleClick}
            style={{
              gridColumn: "1 / -1",
              gridRow: 2,
              cursor: "row-resize",
              touchAction: "none",
              userSelect: "none",
              alignSelf: "stretch",
              justifySelf: "stretch",
              position: "relative",
              zIndex: 2,
              flexShrink: 0,
              pointerEvents: "auto",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                height: 1,
                background: "#334155",
              }}
            />
          </div>
        ) : null}
        {!wideEditorLayout && !choreoPublicView && !mobileStackEditor ? (
          null
        ) : null}
        <section
          ref={stageSectionRef}
          className={[
            "editor-stage-section",
            publicNarrowLayout ? "editor-stage-section--public-view" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            ...panelCard,
            padding: publicNarrowLayout
              ? 0
              : mobileStackEditor
                ? "3px 4px"
                : stageFlushTopDock
                  ? "0"
                  : "5px",
            minHeight: 0,
            minWidth: 0,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
            ...(stageFlushTopDock
              ? {
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  borderTop: "none",
                }
              : {}),
            ...(wideEditorLayout
              ? {
                  gridColumn: stageZenLayout ? "1 / -1" : 1,
                  gridRow: stageZenLayout
                    ? "1 / -1"
                    : 1,
                  ...(stageZenLayout
                    ? { position: "relative" as const }
                    : {}),
                }
              : { gridRow: publicNarrowLayout ? 1 : 2 }),
            ...dynamicStageShellStyle,
            // 縦画面: order -2 でタイムライン(order -3)の直後に配置。横画面: CSS Grid で配置するため order 不要
            ...(mobileStackEditor && !editorMobileLandscape ? { order: -2 } : {}),
          }}
        >
          {stageZenLayout ? (
            <button
              type="button"
              onClick={() => setStageZenFullscreen(false)}
              style={{
                position: "absolute",
                top: 8,
                right: 10,
                zIndex: 200,
                ...btnSecondary,
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 700,
              }}
              title={t("editor.layout.exitStageZenTitle")}
              aria-label={t("editor.layout.exitStageZenAria")}
            >
              縮小
            </button>
          ) : null}
          {wideEditorLayout && rightPaneCollapsed && !stageFlushTopDock ? (
            <section
              style={{
                ...panelCard,
                padding: "8px",
                marginBottom: "6px",
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              {/* ChoreoCoreToolbar hidden — replaced by NeonIconPanel */}
            </section>
          ) : null}
          {!workbenchInRightRail &&
          !stageZenLayout &&
          !publicNarrowLayout &&
          !mobileStackEditor &&
          !stageFlushTopDock ? (
            <div
              style={
                floorTextPlaceSession
                  ? {
                      position: "relative",
                      zIndex: 130,
                      flexShrink: 0,
                      minWidth: 0,
                      width: "100%",
                    }
                  : { flexShrink: 0, minWidth: 0, width: "100%" }
              }
            >
              <EditorStageWorkbench key="stage-wb" layout="stage" {...stageWorkbenchProps} />
            </div>
          ) : null}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              gap: 0,
            }}
          >
            <div
              style={{
                position: "relative",
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/*
                キュー・2D/3D は床と重ねない（絶対配置＋高 z-index だと回転ハンドルが隠れる）。
                ステージ列の右上に、床の上の一行として並べる。
              */}
              <div
                className="editor-stage-viewcontrols"
                style={{
                  flexShrink: 0,
                  display: stageZenLayout ? "none" : "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 3,
                  padding: stageFlushTopDock ? "4px 4px 0 0" : "0 2px 2px",
                  minWidth: 0,
                  maxWidth: "100%",
                  pointerEvents: "auto",
                  ...(stageFlushTopDock
                    ? {
                        position: "absolute",
                        top: 0,
                        right: 0,
                        zIndex: 45,
                      }
                    : {}),
                }}
              >
                {cuesSortedForStageJump.length > 0 || hasRosterMembers ? (
                  !mobileStackEditor && !publicNarrowLayout ? (
                    <div
                      style={{
                        flexShrink: 0,
                        maxWidth: "min(200px, 100%)",
                        lineHeight: 0,
                      }}
                    >
                      <WorkbenchCuePager
                        variant="stageCorner"
                        project={project}
                        cuesSortedForStageJump={cuesSortedForStageJump}
                        selectedCueId={selectedCueId}
                        jumpToPagerSlot={jumpToPagerSlot}
                        includeRosterSlot={hasRosterMembers}
                        rosterTimelineHidden={
                          project.rosterHidesTimeline === true
                        }
                      />
                    </div>
                  ) : null
                ) : null}
                <div
                  role="group"
                  aria-label={t("editor.layout.stageViewAria")}
                  style={{
                    display: choreoPublicView ? "none" : "flex",
                    flexDirection: "row",
                    gap: mobileStackEditor ? 4 : 3,
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      ...(mobileStackEditor
                        ? {
                            width: 36,
                            height: 32,
                            minWidth: 36,
                            minHeight: 32,
                            padding: 0,
                            fontSize: 10,
                            fontWeight: 700,
                            lineHeight: 1,
                            borderRadius: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxSizing: "border-box",
                          }
                        : {
                            padding: "2px 6px",
                            fontSize: "9px",
                            fontWeight: 700,
                            lineHeight: 1.2,
                            borderRadius: 5,
                          }),
                      ...(stageView === "2d"
                        ? { borderColor: "#6366f1", color: "#c7d2fe" }
                        : {}),
                    }}
                    title={t("editor.layout.stage2dTitle")}
                    onClick={() => setStageView("2d")}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      ...(mobileStackEditor
                        ? {
                            width: 36,
                            height: 32,
                            minWidth: 36,
                            minHeight: 32,
                            padding: 0,
                            fontSize: 10,
                            fontWeight: 700,
                            lineHeight: 1,
                            borderRadius: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxSizing: "border-box",
                          }
                        : {
                            padding: "2px 6px",
                            fontSize: "9px",
                            fontWeight: 700,
                            lineHeight: 1.2,
                            borderRadius: 5,
                          }),
                      ...(stageView === "3d"
                        ? { borderColor: "#6366f1", color: "#c7d2fe" }
                        : {}),
                    }}
                    title={t("editor.layout.stage3dTitle")}
                    onClick={() => setStageView("3d")}
                  >
                    3D
                  </button>
                </div>
                {/* 動線矢印トグル（生徒閲覧では非表示） */}
                {!choreoPublicView && stageView === "2d" && (
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      ...(mobileStackEditor
                        ? {
                            width: 36,
                            height: 32,
                            minWidth: 36,
                            minHeight: 32,
                            padding: 0,
                            fontSize: 10,
                            fontWeight: 700,
                            lineHeight: 1,
                            borderRadius: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxSizing: "border-box",
                          }
                        : {
                            padding: "2px 6px",
                            fontSize: "9px",
                            fontWeight: 700,
                            lineHeight: 1.2,
                            borderRadius: 5,
                          }),
                      ...(showMotionArrows
                        ? { borderColor: "#34d399", color: "#6ee7b7", background: "rgba(52,211,153,0.12)" }
                        : {}),
                    }}
                    title={showMotionArrows ? t("editor.layout.motionArrowsHide") : t("editor.layout.motionArrowsShow")}
                    onClick={() => setShowMotionArrows((v) => !v)}
                  >
                    {mobileStackEditor ? "→" : t("editor.layout.motionArrowsLabel")}
                  </button>
                )}
              </div>
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {stageView === "2d" ? (
                  <StageBoard
                    project={stageBoardProject}
                    setProject={setProjectSafe}
                    playbackDancers={playbackDancersForStage}
                    browseFormationDancers={browseFormationDancers}
                    previewDancers={stagePreviewDancers}
                    playbackSetPieces={playbackSetPiecesForStage}
                    browseSetPieces={browseSetPieces}
                    playbackFloorMarkup={playbackFloorMarkupForStage}
                    browseFloorMarkup={browseFloorMarkup}
                    globalFloorMarkup={project.globalFloorMarkup ?? []}
                    onUpdateGlobalFloorMarkup={onUpdateGlobalFloorMarkup}
                    editFormationId={
                      selectedCue?.formationId ?? project.activeFormationId
                    }
                    stageInteractionsEnabled={
                      project.viewMode !== "view" &&
                      (project.cues.length === 0 || Boolean(selectedCueId))
                    }
                    floorTextPlaceSession={floorTextPlaceSession}
                    onFloorTextPlaceSessionChange={onFloorTextPlaceSessionChange}
                    floorMarkupTool={floorMarkupTool}
                    onFloorMarkupToolChange={setFloorMarkupTool}
                    hideFloorMarkupFloatingToolbars={showTopWaveDock}
                    textPanelPortalTarget={showTopWaveDock ? textPanelPortalEl : null}
                    onOpenTextEditSheet={showTopWaveDock ? (id, draft, isGlobal, markup) => {
                      // 既存テキストをサイドシートで編集するため、session に内容を詰める
                      setFloorTextPlaceSession({
                        editTargetId: id,
                        body: draft.body,
                        fontSizePx: draft.fontSizePx,
                        fontWeight: draft.fontWeight,
                        color: draft.color,
                        fontFamily: draft.fontFamily,
                        xPct: markup?.xPct ?? 50,
                        yPct: markup?.yPct ?? 50,
                        scale: markup?.scale ?? 1,
                        scope: isGlobal ? "global" : "formation",
                      });
                      setFloorTextSideSheetOpen(true);
                    } : undefined}
                    onGestureHistoryBegin={
                      collabActive ? undefined : beginGestureHistory
                    }
                    onGestureHistoryEnd={
                      collabActive ? undefined : endGestureHistory
                    }
                    onGestureHistoryCancel={
                      collabActive ? undefined : cancelGestureHistory
                    }
                    markHistorySkipNextPush={
                      collabActive ? undefined : markHistorySkipNextPush
                    }
                    viewportTextOverlayRoot={editorSurfaceEl}
                    studentViewerFocus={studentViewerFocusForStage}
                    markerDisplayScale={
                      choreoPublicView ? PUBLIC_VIEWER_MARKER_DISPLAY_SCALE : 1
                    }
                    showMotionArrows={showMotionArrows}
                    onOpenDancerPathEditor={
                      choreoPublicView
                        ? undefined
                        : selectedCueId
                          ? () => setPathEditorCueId(selectedCueId)
                          : undefined
                    }
                  />
                ) : (
                  <Suspense
                    fallback={
                      <div
                        style={{ padding: 24, color: shell.textSubtle, fontSize: "13px" }}
                      >
                        3D ビューを読み込み中…
                      </div>
                    }
                  >
                    <Stage3DView
                      dancers={dancersFor3d}
                      markerDiameterPx={
                        project.dancerMarkerDiameterPx ??
                        DEFAULT_DANCER_MARKER_DIAMETER_PX
                      }
                    />
                  </Suspense>
                )}
                {!choreoPublicView &&
                project.viewMode !== "view" &&
                stageView === "2d" &&
                !(mobileStackEditor && editorMobileLandscape) ? (
                  <button
                    type="button"
                    onClick={() => setFormationPresetPickerOpen(true)}
                    title="立ち位置の雛形を選ぶ"
                    aria-label="立ち位置の雛形を選ぶ"
                    style={{
                      position: "absolute",
                      top: mobileStackEditor ? 8 : 6,
                      left: mobileStackEditor ? 8 : 6,
                      zIndex: 45,
                      pointerEvents: "auto",
                      ...btnSecondary,
                      ...(mobileStackEditor
                        ? {
                            padding: "6px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 8,
                          }
                        : {
                            padding: "4px 8px",
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                          }),
                      borderColor: "#d4af37",
                      color: "#fef3c7",
                      background: "rgba(15,23,42,0.88)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                    }}
                  >
                    Change
                  </button>
                ) : null}
                {mobileStackEditor &&
                editorMobileLandscape &&
                !choreoPublicView &&
                project.viewMode !== "view" ? (() => {
                  const cues = Array.isArray(cuesSortedForStageJump)
                    ? (cuesSortedForStageJump as Array<{ id: string }>)
                    : [];
                  const hasRoster = Boolean(hasRosterMembers);
                  const rosterHidden = project.rosterHidesTimeline === true;
                  const showChangeBtn = stageView === "2d";

                  return (
                    <div className="editor-stage-landscape-stack">
                      {showChangeBtn ? (
                        <button
                          type="button"
                          className="editor-stage-landscape-btn editor-stage-landscape-btn--change"
                          onClick={() => setFormationPresetPickerOpen(true)}
                          title="立ち位置の雛形を選ぶ"
                          aria-label="立ち位置の雛形を選ぶ"
                        >
                          Change
                        </button>
                      ) : null}
                      <div
                        role="group"
                        aria-label={t("editor.layout.stageViewAria")}
                        className="editor-stage-landscape-btnRow"
                      >
                        <button
                          type="button"
                          className={`editor-stage-landscape-btn${stageView === "2d" ? " editor-stage-landscape-btn--active" : ""}`}
                          title={t("editor.layout.stage2dTitle")}
                          onClick={() => setStageView("2d")}
                        >
                          2D
                        </button>
                        <button
                          type="button"
                          className={`editor-stage-landscape-btn${stageView === "3d" ? " editor-stage-landscape-btn--active" : ""}`}
                          title={t("editor.layout.stage3dTitle")}
                          onClick={() => setStageView("3d")}
                        >
                          3D
                        </button>
                      </div>
                      {cues.length > 0 || hasRoster ? (
                        <div className="editor-stage-landscape-pager">
                          <WorkbenchCuePager
                            variant="stageCorner"
                            project={project}
                            cuesSortedForStageJump={cuesSortedForStageJump}
                            selectedCueId={selectedCueId}
                            jumpToPagerSlot={jumpToPagerSlot}
                            includeRosterSlot={hasRosterMembers}
                            rosterTimelineHidden={rosterHidden}
                          />
                        </div>
                      ) : null}
                      <div
                        className="editor-stage-landscape-time"
                        aria-live="polite"
                        aria-label={`再生位置 ${formatMmSsFloor(currentTime)} / ${formatMmSsFloor(duration)}`}
                      >
                        <span className="editor-stage-landscape-timeCurrent">
                          {formatMmSsFloor(currentTime)}
                        </span>
                        {" / "}
                        {formatMmSsFloor(duration)}
                      </div>
                    </div>
                  );
                })() : null}
                {publicNarrowLayout &&
                publicViewTightHeight &&
                choreoStudentPick &&
                !viewerChromeCollapsed ? (
                  <ChoreoViewerLandscapeRail
                    timelineRef={timelineRef}
                    trimStartSec={project.trimStartSec ?? 0}
                    trimEndSec={project.trimEndSec ?? null}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    chromeCollapsed={viewerChromeCollapsed}
                    onBeforeTransport={() => resyncViewerPlayback({ force: true })}
                  />
                ) : null}
                {publicNarrowLayout &&
                (cuesSortedForStageJump.length > 0 || hasRosterMembers) &&
                !viewerChromeCollapsed ? (
                  // 生徒閲覧: タイムラインを非表示にしたため、position:fixed でボトムバーの上にフロート
                  <div
                    className="choreo-viewer-cuepager"
                    style={{
                      position: "fixed",
                      bottom: publicViewTightHeight
                        ? "calc(var(--choreo-viewer-bar-h, 44px) + max(8px, env(safe-area-inset-bottom, 0px)) + 8px)"
                        : "calc(var(--choreo-viewer-bar-h, 104px) + max(8px, env(safe-area-inset-bottom, 0px)) + 8px)",
                      left: publicViewTightHeight
                        ? "50%"
                        : "50%",
                      transform: "translateX(-50%)",
                      zIndex: 91,
                      pointerEvents: "auto",
                      maxWidth: publicViewTightHeight
                        ? "min(calc(100% - 72px), 320px)"
                        : "min(calc(100% - 16px), 320px)",
                    }}
                  >
                    <WorkbenchCuePager
                      variant="inline"
                      project={project}
                      cuesSortedForStageJump={cuesSortedForStageJump}
                      selectedCueId={selectedCueId}
                      jumpToPagerSlot={jumpToPagerSlot}
                      includeRosterSlot={hasRosterMembers}
                      rosterTimelineHidden={project.rosterHidesTimeline === true}
                    />
                  </div>
                ) : null}
                {mobileStackEditor &&
                !editorMobileLandscape &&
                (cuesSortedForStageJump.length > 0 || hasRosterMembers) ? (
                  <div
                    className="editor-stage-cuepager"
                    style={{
                      position: "absolute",
                      bottom: "max(16px, env(safe-area-inset-bottom, 0px))",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 50,
                      pointerEvents: "auto",
                    }}
                  >
                    <WorkbenchCuePager
                      variant="inline"
                      project={project}
                      cuesSortedForStageJump={cuesSortedForStageJump}
                      selectedCueId={selectedCueId}
                      jumpToPagerSlot={jumpToPagerSlot}
                      includeRosterSlot={hasRosterMembers}
                      rosterTimelineHidden={
                        project.rosterHidesTimeline === true
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/*
          タイムラインはモバイル積み上げ専用（PC は EditorPageLayout 上部ドックに常時 1 箇所だけマウント）。
        */}
        {!stageZenLayout && mobileStackEditor ? (
          <section
            ref={attachTopDockSection}
            className={
              mobileStackEditor && editorMobileLandscape
                ? "editor-landscape-timeline"
                : mobileStackEditor
                ? "editor-mobile-wave-bar"
                : undefined
            }
            style={{
              gridColumn: 1,
              gridRow: publicNarrowLayout ? 2 : 3,
              ...(false
                ? {
                    background: "transparent",
                  }
                : {
                    ...panelCard,
                    padding: rosterOnlyMode ? "8px 10px" : "12px",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    minHeight: 0,
                    ...(rosterOnlyMode
                      ? {
                          flex: "0 0 auto",
                          maxHeight: "min(42vh, 380px)",
                          flexShrink: 0,
                        }
                      : rightPaneTopSectionStyle),
                  }),
              // 生徒閲覧: タイムラインを非表示（音声・状態を維持するため DOM には残す）
              ...(publicNarrowLayout ? { display: "none" } : {}),
              // モバイルスタック時の配置スタイル
              ...(mobileStackEditor
                ? editorMobileLandscape
                  ? {
                      // 横画面: CSS Grid の "wave" エリア（上段全幅）
                      gridArea: "wave",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      overflow: "hidden",
                      minHeight: 0,
                      maxHeight: "none",
                      borderBottom: "1px solid #334155",
                      padding: "2px 6px 2px",
                      backgroundColor: "#0f172a",
                    }
                  : {
                      // 縦画面: flex column 内で上部に配置（order: -3）
                      order: -3,
                      alignSelf: "stretch",
                      width: "100%",
                      maxWidth: "100%",
                      flexGrow: 0,
                      flexShrink: 1,
                      flexBasis: "auto",
                      minHeight: 0,
                      maxHeight: mobileEditorWaveExpanded ? "min(52dvh, 340px)" : undefined,
                      flex: mobileEditorWaveExpanded ? "0 1 auto" : "0 0 auto",
                      padding: rosterOnlyMode ? "6px 8px" : "4px 6px 6px",
                      borderTop: "1px solid #1e293b",
                      borderBottom: "1px solid #334155",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }
                : {}),
            }}
          >
            {wideEditorLayout &&
            showTopWaveDock &&
            hasRosterMembers &&
            !project.rosterHidesTimeline ? (
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  justifyContent: "flex-end",
                  padding: "0 4px 2px",
                }}
              >
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  title={t("editor.layout.showMembersHideTimeline")}
                  onClick={() =>
                    setProjectSafe((p) => ({
                      ...p,
                      rosterHidesTimeline: true,
                      rosterStripCollapsed: false,
                    }))
                  }
                  style={{
                    fontSize: "11px",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    border: "1px solid #14532d",
                    background: "#14532d",
                    color: "#dcfce7",
                    cursor:
                      project.viewMode === "view" ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  メンバーを表示
                </button>
              </div>
            ) : null}
            {!wideEditorLayout && !mobileStackEditor ? (
              rosterOnlyMode ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                    flexShrink: 0,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: shell.textMuted,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    波形・再生
                  </h2>
                  <button
                    type="button"
                    disabled={project.viewMode === "view"}
                    title={t("editor.layout.showMembersHideTimeline")}
                    onClick={() => {
                      setProjectSafe((p) => ({ ...p, rosterHidesTimeline: false }));
                      onRosterConfirmReturnToTimeline();
                    }}
                    style={{
                      ...btnSecondary,
                      fontSize: "11px",
                      padding: "4px 10px",
                      marginLeft: "auto",
                      flexShrink: 0,
                    }}
                  >
                    タイムラインを全表示
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "8px",
                    rowGap: "6px",
                    marginBottom: "8px",
                    flexShrink: 0,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: shell.textMuted,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    タイムライン・楽曲
                  </h2>
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      borderColor: "#0284c7",
                      background: "#0ea5e9",
                      color: "#0b1220",
                      padding: "5px 9px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                    disabled={project.viewMode === "view"}
                    title={t("editor.layout.addCueLongTitle")}
                    aria-label={t("editor.layout.addCueAria")}
                    onClick={() => setAddCueDialogOpen(true)}
                  >
                    <svg
                      viewBox="0 0 22 14"
                      width="20"
                      height="13"
                      aria-hidden
                      style={{ display: "block" }}
                    >
                      <path
                        d="M3 7 L9 7 M6 4 L6 10"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <circle cx="13" cy="3" r="1.2" fill="currentColor" />
                      <circle cx="17" cy="3" r="1.2" fill="currentColor" />
                      <circle cx="12" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="15" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="18" cy="8" r="1.2" fill="currentColor" />
                      <circle
                        cx="13.5"
                        cy="12"
                        r="1"
                        fill="currentColor"
                        opacity="0.7"
                      />
                      <circle
                        cx="16.5"
                        cy="12"
                        r="1"
                        fill="currentColor"
                        opacity="0.7"
                      />
                    </svg>
                    <span style={{ fontSize: "11px", fontWeight: 700 }}>{t("editor.layout.addCue")}</span>
                  </button>
                  {hasRosterMembers && !project.rosterHidesTimeline ? (
                    <button
                      type="button"
                      disabled={project.viewMode === "view"}
                      title={t("editor.layout.showMembersFromTimeline")}
                      onClick={() =>
                        setProjectSafe((p) => ({
                          ...p,
                          rosterHidesTimeline: true,
                          rosterStripCollapsed: false,
                        }))
                      }
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        border: "1px solid #14532d",
                        background: "#14532d",
                        color: "#dcfce7",
                        cursor:
                          project.viewMode === "view" ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        flexShrink: 0,
                        marginLeft: "auto",
                      }}
                    >
                      メンバーを表示
                    </button>
                  ) : null}
                </div>
              )
            ) : null}
            {mobileStackEditor && !mobileEditorWaveExpanded ? (
              editorMobileLandscape ? (
                // 横画面: 1行に全コントロールを並べる
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 6px",
                    flex: "1 1 auto",
                    minWidth: 0,
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <button
                    type="button"
                    disabled={project.viewMode === "view"}
                    style={{
                      ...btnAccent,
                      minWidth: 46,
                      minHeight: 40,
                      padding: "0 10px",
                      fontSize: 18,
                      touchAction: "manipulation",
                      flexShrink: 0,
                    }}
                    aria-label={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
                    onClick={() => timelineRef.current?.togglePlay()}
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      minHeight: 40,
                      padding: "0 10px",
                      touchAction: "manipulation",
                      flexShrink: 0,
                    }}
                    aria-label={t("editor.layout.stop")}
                    onClick={() => timelineRef.current?.stopPlayback()}
                  >
                    ⏹
                  </button>
                  <span
                    style={{
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                      color: shell.text,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {formatMmSsFloor(currentTime)} / {formatMmSsFloor(duration)}
                  </span>
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      minHeight: 40,
                      padding: "0 8px",
                      touchAction: "manipulation",
                      flexShrink: 0,
                      fontSize: 11,
                    }}
                    onClick={() => setMobileEditorWaveExpanded(true)}
                  >
                    波形
                  </button>
                  {(cuesSortedForStageJump.length > 0 || hasRosterMembers) ? (
                    <WorkbenchCuePager
                      variant="inline"
                      project={project}
                      cuesSortedForStageJump={cuesSortedForStageJump}
                      selectedCueId={selectedCueId}
                      jumpToPagerSlot={jumpToPagerSlot}
                      includeRosterSlot={hasRosterMembers}
                      rosterTimelineHidden={project.rosterHidesTimeline === true}
                    />
                  ) : null}
                </div>
              ) : null
            ) : null}
            {mobileStackEditor && !mobileEditorWaveExpanded && !editorMobileLandscape ? (
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                {/* 1行目: 再生コントロール */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px 4px",
                  }}
                >
                  <button
                    type="button"
                    disabled={project.viewMode === "view"}
                    style={{
                      ...btnAccent,
                      minWidth: 56,
                      minHeight: 50,
                      padding: "0 14px",
                      fontSize: 20,
                      touchAction: "manipulation",
                      flexShrink: 0,
                    }}
                    aria-label={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
                    onClick={() => timelineRef.current?.togglePlay()}
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      minHeight: 50,
                      padding: "0 12px",
                      touchAction: "manipulation",
                      flexShrink: 0,
                    }}
                    aria-label={t("editor.layout.stop")}
                    onClick={() => timelineRef.current?.stopPlayback()}
                  >
                    ⏹
                  </button>
                  <span
                    style={{
                      fontSize: 14,
                      fontVariantNumeric: "tabular-nums",
                      color: shell.text,
                      fontWeight: 600,
                      marginLeft: "auto",
                    }}
                  >
                    {formatMmSsFloor(currentTime)} / {formatMmSsFloor(duration)}
                  </span>
                </div>
                {/* 2行目: 波形展開 + キューナビ */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 8px 8px",
                  }}
                >
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      minHeight: 42,
                      padding: "0 12px",
                      touchAction: "manipulation",
                      flexShrink: 0,
                    }}
                    onClick={() => setMobileEditorWaveExpanded(true)}
                  >
                    波形を表示
                  </button>
                  {(cuesSortedForStageJump.length > 0 || hasRosterMembers) ? (
                    <WorkbenchCuePager
                      variant="inline"
                      project={project}
                      cuesSortedForStageJump={cuesSortedForStageJump}
                      selectedCueId={selectedCueId}
                      jumpToPagerSlot={jumpToPagerSlot}
                      includeRosterSlot={hasRosterMembers}
                      rosterTimelineHidden={project.rosterHidesTimeline === true}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                ...(wideEditorLayout && showTopWaveDock
                  ? {
                      overflowX: "hidden" as const,
                      overflowY: "auto" as const,
                    }
                  : {}),
                ...(mobileStackEditor
                  ? {
                      flex: mobileEditorWaveExpanded ? "1 1 auto" : "0 0 0",
                      minHeight: 0,
                      minWidth: 0,
                      maxHeight: mobileEditorWaveExpanded
                        ? editorMobileLandscape
                          ? "min(36dvh, 220px)"
                          : "min(42dvh, 300px)"
                        : 0,
                      overflowX: "hidden" as const,
                      overflowY: mobileEditorWaveExpanded
                        ? ("auto" as const)
                        : ("hidden" as const),
                      WebkitOverflowScrolling: "touch" as const,
                      opacity: mobileEditorWaveExpanded ? 1 : 0,
                      pointerEvents: mobileEditorWaveExpanded
                        ? ("auto" as const)
                        : ("none" as const),
                    }
                  : {}),
              }}
            >
              {timelinePanelEl}
            </div>
          </section>
        ) : null}

        {wideEditorLayout && !rightPaneCollapsed && !stageZenLayout ? (
          <div
            className="editor-pane-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label={t("editor.layout.splitResizeAria")}
            title={t("editor.layout.splitResizeTitle")}
            onPointerDown={onSplitPointerDown}
            onPointerMove={onSplitPointerMove}
            onPointerUp={endSplitDrag}
            onPointerCancel={endSplitDrag}
            onLostPointerCapture={onSplitLostCapture}
            style={{
              position: "relative",
              width: STAGE_RESIZER_PX,
              minWidth: STAGE_RESIZER_PX,
              cursor: "col-resize",
              touchAction: "none",
              userSelect: "none",
              justifySelf: "stretch",
              alignSelf: "stretch",
              zIndex: 2,
              gridColumn: 2,
              gridRow: 1,
              // NeonIconPanel使用時はリサイザー非表示
              display: showTopWaveDock ? "none" : "block",
            }}
          />
        ) : null}

        {stageZenLayout ? null : rightPaneCollapsed && wideEditorLayout ? null : wideEditorLayout && showTopWaveDock ? (
          /* wideEditorLayout: グリッド右列なし。NeonIconPanelは外側flexで配置済み */
          null
        ) : !publicNarrowLayout ? (
          /* 操作パネル:
             縦画面モバイル → flex column 末尾（フル）
             横画面モバイル → CSS Grid の "tools" エリア（右カラム下部、スクロール可）
             デスクトップ  → グリッド右列 */
          <div
            ref={rightPaneStackRef}
            className={
              mobileStackEditor && editorMobileLandscape
                ? "editor-landscape-tools"
                : mobileStackEditor
                ? "editor-mobile-portrait-tools"
                : undefined
            }
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
              ...(wideEditorLayout
                ? {}
                : { gridRow: 4 }),
              ...(floorTextPlaceSession
                ? { position: "relative" as const, zIndex: 140 }
                : {}),
              ...(mobileStackEditor
                ? {
                    // モバイル共通: dynamicToolsAsideStyle に全スタイル集約
                    ...dynamicToolsAsideStyle,
                  }
                : {}),
            }}
          >
            {/* ===== モバイル: 常時コンパクトアイコン（縦=横並び / 横=縦並び） ===== */}
            {mobileStackEditor ? (
              editorMobileLandscape ? (
                // 横画面: 縦一列（親が flex-column & overflow-y: auto）
                <>
                  <button
                    type="button"
                    style={{
                      ...btnAccent,
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      borderRadius: 12,
                      fontSize: 20,
                      touchAction: "manipulation",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                    disabled={project.viewMode === "view"}
                    title={t("editor.layout.addCueAria")}
                    onClick={() => setAddCueDialogOpen(true)}
                  >
                    ＋
                  </button>
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      borderRadius: 12,
                      fontSize: 20,
                      touchAction: "manipulation",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                    title="舞台設定"
                    onClick={() => setStageAreaSettingsOpen(true)}
                  >
                    ⚙
                  </button>
                  <div
                    style={{
                      flex: "1 1 auto",
                      minHeight: 0,
                      overflowY: "auto",
                      overflowX: "hidden",
                      width: "100%",
                    }}
                  >
                    <EditorStageWorkbench
                      key="wb-landscape-col"
                      layout="rail"
                      {...stageWorkbenchProps}
                    />
                  </div>
                </>
              ) : (
                // 縦画面: 横一列（親が flex-row & overflow-x: auto）
                <>
                  <button
                    type="button"
                    style={{
                      ...btnAccent,
                      minWidth: 52,
                      minHeight: 52,
                      flexShrink: 0,
                      borderRadius: 14,
                      fontSize: 22,
                      touchAction: "manipulation",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                    disabled={project.viewMode === "view"}
                    title={t("editor.layout.addCueAria")}
                    onClick={() => setAddCueDialogOpen(true)}
                  >
                    ＋
                  </button>
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      minWidth: 52,
                      minHeight: 52,
                      flexShrink: 0,
                      borderRadius: 14,
                      fontSize: 22,
                      touchAction: "manipulation",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                    title="舞台設定"
                    onClick={() => setStageAreaSettingsOpen(true)}
                  >
                    ⚙
                  </button>
                  <div style={{ flex: "1 1 auto", minWidth: 0, overflowX: "auto" }}>
                    <EditorStageWorkbench
                      key="wb-portrait-row"
                      layout="rail"
                      {...stageWorkbenchProps}
                    />
                  </div>
                </>
              )
            ) : (
              // ===== デスクトップ: 既存の展開パネル =====
              <>
                {rosterOnlyMode ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      flex: "1 1 0",
                      minHeight: 0,
                      ...rightPaneTopSectionStyle,
                    }}
                  >
                    <RosterTimelineStrip
                      project={project}
                      setProject={setProjectSafe}
                      onConfirmReturnToTimeline={onRosterConfirmReturnToTimeline}
                      onStagePreviewChange={setStagePreviewDancers}
                    />
                  </div>
                ) : null}
                {workbenchInRightRail ? (
                  /* テキストボタンレール非表示 — NeonIconPanelに統合済み */
                  null
                ) : (
                  <section
                    className="editor-right-tools-section"
                    style={{
                      ...panelCard,
                      padding: "6px 5px",
                      flex: "0 0 auto",
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    <div className="editor-right-tools-host">
                      <div className="editor-right-tools-tiles">
                        <EditorStageWorkbench
                          key="wb-desktop-rail"
                          layout="rail"
                          {...stageWorkbenchProps}
                        />
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
  );
}
