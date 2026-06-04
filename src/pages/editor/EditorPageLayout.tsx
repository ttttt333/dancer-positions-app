import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoGridLogo";
import { StageBoard } from "../../components/StageBoard";
import { DancerPathEditor } from "../../components/DancerPathEditor";
import { RosterTimelineStrip } from "../../components/RosterTimelineStrip";
import { NeonIconPanel } from "../../components/NeonIconPanel";
import { AiSuggestDialog } from "../../components/AiSuggestDialog";
import { EditorStageWorkbench, WorkbenchCuePager } from "../../components/EditorStageWorkbench";
import { StageShapePicker } from "../../components/StageShapePicker";
import { EditorSideSheet } from "../../components/EditorSideSheet";
import { ShareLinksSheetContent } from "../../components/ShareLinksSheetContent";
import { ViewerModeSheetContent } from "../../components/ViewerModeSheetContent";
import { btnAccent, btnSecondary, inputField } from "../../components/stageButtonStyles";
import { panelCard, shell } from "../../theme/choreoShell";
import { modDancerColorIndex, DANCER_COLOR_PALETTE_HEX } from "../../lib/dancerColorPalette";
import { sortCuesByStart, MIN_CUE_DURATION_SEC, DEFAULT_CUE_SPAN_WITH_AUDIO_SEC } from "../../core/timelineController";
import { dancersForLayoutPreset, transferDancerIdentitiesByOrder } from "../../lib/formationLayouts";
import { formatMmSsFloor } from "../../lib/timeFormat";
import { getViewRosterEntries } from "../../lib/viewRoster";
import { listStagePresets, saveStagePreset } from "../../lib/stagePresets";
import { parseMeterCmDraftToMm } from "./stageAreaSettingsDraft";
import { EDITOR_GRID_GAP_PX, STAGE_RESIZER_PX, TOP_DOCK_HEIGHT_PX, TOP_DOCK_ROW_MIN_PX } from "./editorConstants";
import { TOP_DOCK_WAVE_STAGE_RESIZER_PX } from "../../lib/waveDockMetrics";
import type { EditorLayoutProps } from "./editorLayoutProps";

const Stage3DView = lazy(() =>
  import("../../components/Stage3DView").then((m) => ({ default: m.Stage3DView }))
);

import { EditorPageHeader } from "./EditorPageHeader";
import { VideoExportHost } from "../../components/VideoExportHost";
import { EditorDesktopLayout } from "./EditorDesktopLayout";
import { EditorMobileLayout } from "./EditorMobileLayout";
import { useAssignRef } from "./useSafeElementRef";

export function EditorPageLayout(props: EditorLayoutProps) {
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
  const viewerBarHeightPx = props.viewerBarHeightPx as never;
  const publicViewTightHeightForVars = props.publicViewTightHeight as never;
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
  const xPct = props.xPct as never;
  const yPct = props.yPct as never;

  const attachTopDockSection = useAssignRef(topDockSectionRef);

  return (
    <div
      className={[
        choreoPublicView ? "choreo-public-view-root" : "editor-page-root",
        choreoPublicView && viewerChromeCollapsed
          ? "choreo-public-view-root--chrome-collapsed"
          : "",
        choreoPublicView && publicViewTightHeight
          ? "choreo-public-view-root--landscape"
          : "",
        mobileStackEditor ? "editor-page-root--mobile-editor" : "",
        mobileStackEditor && editorMobileLandscape
          ? "editor-page-root--mobile-landscape"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: "100%",
        maxWidth: "100vw",
        height: "100dvh",
        minHeight: "100dvh",
        maxHeight: "100dvh",
        overflow: "hidden",
        background: shell.bgDeep,
        color: shell.text,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        WebkitFontSmoothing: "antialiased",
        display: "flex",
        flexDirection: "column",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxSizing: "border-box",
        ...(choreoPublicView
          ? {
              ["--choreo-viewer-bar-h" as string]: viewerChromeCollapsed
                ? "0px"
                : `${viewerBarHeightPx}px`,
              ["--choreo-viewer-cuepager-h" as string]:
                viewerChromeCollapsed || !publicViewTightHeightForVars
                  ? "0px"
                  : "50px",
            }
          : {}),
      }}
    >
      {playbackAudioElement}
      <VideoExportHost />
      {!choreoPublicView && !wideEditorLayout && !editorMobileLandscape ? (
        <EditorPageHeader {...props} />
      ) : null}

      {/* ─── Main layout: column flex (top wave bar + stage row) ─── */}
      <div
        className={choreoPublicView ? "choreo-public-view-main" : undefined}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "visible" }}
      >

      {showTopWaveDock && !stageZenLayout && !mobileStackEditor ? (
        <div
          className={publicNarrowLayout ? "choreo-viewer-timeline-mount" : undefined}
          style={{
            flexShrink: publicNarrowLayout ? 0 : undefined,
            width: "100%",
            minWidth: 0,
            height: publicNarrowLayout
              ? 1
              : wideEditorLayout
                ? wideBottomDockPx
                : TOP_DOCK_HEIGHT_PX,
            position: publicNarrowLayout ? ("absolute" as const) : "relative",
            left: publicNarrowLayout ? 0 : undefined,
            top: publicNarrowLayout ? 0 : undefined,
            overflow: publicNarrowLayout ? "hidden" : undefined,
            opacity: publicNarrowLayout ? 0 : undefined,
            pointerEvents: publicNarrowLayout ? "none" : undefined,
            background: "transparent",
            marginBottom: wideEditorLayout ? 0 : publicNarrowLayout ? 0 : 4,
            display: publicNarrowLayout ? undefined : undefined,
            visibility: publicNarrowLayout ? ("hidden" as const) : undefined,
          }}
          aria-hidden={publicNarrowLayout ? true : undefined}
        >
          {/* Timeline content */}
          <div
            ref={attachTopDockSection}
            style={{
              position: "absolute",
              inset: wideEditorLayout ? `0 0 ${TOP_DOCK_WAVE_STAGE_RESIZER_PX}px 0` : "0 0 8px 0",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: wideEditorLayout ? 0 : "0 4px 4px",
            }}
          >
            {timelinePanelEl}
          </div>
          {/* 波形バーとステージの境目 — 上下ドラッグで高さ調整 */}
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
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 10,
              cursor: "row-resize",
              touchAction: "none",
              userSelect: "none",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderTop: "1px solid #334155",
              background: "linear-gradient(180deg, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.85) 100%)",
            }}
          >
            <div
              aria-hidden
              style={{
                width: "min(100%, 120px)",
                height: 3,
                borderRadius: 2,
                background: "rgba(148,163,184,0.55)",
                boxShadow: "0 0 0 1px rgba(51,65,85,0.6)",
              }}
            />
          </div>
        </div>
      ) : null}

      {/* ─── Stage row: editor grid + NeonIconPanel ─── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "visible" }}>
        {mobileStackEditor ? (
          <EditorMobileLayout {...props} />
        ) : (
          <EditorDesktopLayout {...props} />
        )}
      </div>{/* end stage row */}

      </div>{/* end main column wrapper */}

      <style>{`
        @media (max-width: 1279px) {
          /* 閲覧ナロー・スマホ縦積み編集は除外（それぞれ専用レイアウト） */
          .editor-three-pane:not(.editor-three-pane--public-narrow):not(.editor-mobile-stack) {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto auto !important;
            overscroll-behavior: contain;
          }
        }
        .editor-pane-resizer::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          background: #334155;
          pointer-events: none;
          transition: background 120ms ease;
        }
        .editor-pane-resizer:hover::after {
          background: rgba(148, 163, 184, 0.75);
        }
      `}</style>
      {/* 個人別ベジェ軌道エディタ */}
      {(() => {
        if (!pathEditorCueId) return null;
        const targetCue = cueById.get(pathEditorCueId);
        if (!targetCue) return null;
        const idx = sortedCuesForEditor.findIndex((c) => c.id === pathEditorCueId);
        const prevCue = idx > 0 ? sortedCuesForEditor[idx - 1] : null;
        if (!prevCue) return null;
        const prevForm = formationById.get(prevCue.formationId);
        const nextForm = formationById.get(targetCue.formationId);
        if (!prevForm || !nextForm) return null;
        return (
          <DancerPathEditor
            cueId={pathEditorCueId}
            prevFormation={prevForm.dancers}
            nextFormation={nextForm.dancers}
            existingPaths={targetCue.dancerCustomPaths}
            setProject={setProjectSafe}
            onClose={() => setPathEditorCueId(null)}
          />
        );
      })()}
    </div>
  );
}
