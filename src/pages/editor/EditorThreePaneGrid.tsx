import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { StageBoard } from "../../components/StageBoard";
import { EditorStageWorkbench, WorkbenchCuePager } from "../../components/EditorStageWorkbench";
import { RosterTimelineStrip } from "../../components/RosterTimelineStrip";
import { btnAccent, btnSecondary } from "../../components/stageButtonStyles";
import { panelCard, shell } from "../../theme/choreoShell";
import { EDITOR_GRID_GAP_PX, STAGE_RESIZER_PX } from "./editorConstants";
import type { EditorLayoutProps } from "./editorLayoutProps";
import { useAssignRef, useAttachElementRef } from "./useSafeElementRef";

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
  const xPct = props.xPct as never;
  const yPct = props.yPct as never;

  const attachEditorPane = useAttachElementRef(setEditorSurfaceEl, editorPaneRef);
  const attachTopDockSection = useAssignRef(topDockSectionRef);

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
                gap: wideEditorLayout ? "4px" : `${EDITOR_GRID_GAP_PX}px`,
                padding: publicNarrowLayout
                  ? "4px max(4px, env(safe-area-inset-right, 0px)) max(6px, env(safe-area-inset-bottom, 0px)) max(4px, env(safe-area-inset-left, 0px))"
                  : wideEditorLayout
                    ? "0px 0px 0px 0px"
                    : "6px max(6px, env(safe-area-inset-right, 0px)) calc(max(8px, 2cm) + env(safe-area-inset-bottom, 0px)) max(6px, env(safe-area-inset-left, 0px))",
                paddingBottom:
                  choreoPublicView && choreoStudentPick
                    ? publicViewTightHeight
                      ? "calc(4px + min(100px, 24dvh) + env(safe-area-inset-bottom, 0px))"
                      : "calc(6px + min(132px, 30dvh) + env(safe-area-inset-bottom, 0px))"
                    : undefined,
                marginTop: 0,
              }),
        }}
      >
        {showTopWaveDock && !stageZenLayout && !wideEditorLayout ? (
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
          style={{
            ...panelCard,
            padding: mobileStackEditor ? "3px 4px" : "5px",
            minHeight: 0,
            minWidth: 0,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
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
            ...(mobileStackEditor ? { order: -2 } : {}),
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
          {wideEditorLayout && rightPaneCollapsed ? (
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
          !mobileStackEditor ? (
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
                style={{
                  flexShrink: 0,
                  display: stageZenLayout ? "none" : "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 3,
                  padding: "0 2px 2px",
                  minWidth: 0,
                  maxWidth: "100%",
                  pointerEvents: "auto",
                }}
              >
                {cuesSortedForStageJump.length > 0 || hasRosterMembers ? (
                  !mobileStackEditor ? (
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
                    display: "flex",
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
                {/* 動線矢印トグル */}
                {stageView === "2d" && (
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
                    showMotionArrows={showMotionArrows}
                    onOpenDancerPathEditor={
                      selectedCueId
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
                {mobileStackEditor &&
                (cuesSortedForStageJump.length > 0 || hasRosterMembers) ? (
                  <div
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
          タイムラインは常にこの 1 ブロックだけにマウントする（ワイド⇔狭いで別ブランチに置くと
          TimelinePanel が再マウントされ、波形・音源の内部状態が消える）。
          グリッド行だけワイド時は 1 行目、狭いときはステージの下（3 行目）に固定する。
        */}
        {/* wideEditorLayout時の波形バーはflex下段に独立配置 */}
        {!stageZenLayout && !(wideEditorLayout && showTopWaveDock) ? (
          <section
            ref={attachTopDockSection}
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
              ...(mobileStackEditor
                ? {
                    order: -3,
                    alignSelf: "stretch",
                    width: "100%",
                    maxWidth: "100%",
                    flexGrow: 0,
                    flexShrink: 1,
                    flexBasis: "auto",
                    minHeight: 0,
                    maxHeight: mobileEditorWaveExpanded
                      ? editorMobileLandscape
                        ? "min(44dvh, 260px)"
                        : "min(52dvh, 340px)"
                      : undefined,
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
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 4px 8px",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  style={{
                    ...btnAccent,
                    minWidth: 48,
                    minHeight: 44,
                    padding: "0 12px",
                    touchAction: "manipulation",
                  }}
                  aria-label={isPlaying ? t("editor.layout.pause") : t("editor.layout.play")}
                  onClick={() => timelineRef.current?.togglePlay()}
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>
                <span
                  style={{
                    fontSize: 13,
                    fontVariantNumeric: "tabular-nums",
                    color: shell.text,
                    fontWeight: 600,
                  }}
                >
                  {formatMmSsFloor(currentTime)} /{" "}
                  {formatMmSsFloor(duration)}
                </span>
                <button
                  type="button"
                  style={{
                    ...btnSecondary,
                    marginLeft: "auto",
                    minHeight: 40,
                    touchAction: "manipulation",
                  }}
                  onClick={() => setMobileEditorWaveExpanded(true)}
                >
                  波形を表示
                </button>
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
          <div
            ref={rightPaneStackRef}
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
                    ...dynamicToolsAsideStyle,
                    gap: mobileEditorToolsExpanded ? 8 : 0,
                    flex: mobileEditorToolsExpanded ? "1 1 auto" : "0 0 auto",
                  }
                : {}),
            }}
          >
            {mobileStackEditor ? (
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "2px 0 8px",
                  borderBottom: "1px solid #334155",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: shell.textMuted,
                    letterSpacing: "0.02em",
                  }}
                >
                  操作パネル
                </span>
                <button
                  type="button"
                  style={{
                    ...btnSecondary,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    touchAction: "manipulation",
                  }}
                  disabled={rosterOnlyMode}
                  title={rosterOnlyMode ? t("editor.layout.toolsCollapseDisabled") : undefined}
                  aria-expanded={mobileEditorToolsExpanded}
                  onClick={() => setMobileEditorToolsExpanded((v) => !v)}
                >
                  {mobileEditorToolsExpanded ? t("editor.layout.toolsCollapse") : t("editor.layout.toolsExpand")}
                </button>
              </div>
            ) : null}
            {!mobileStackEditor || mobileEditorToolsExpanded ? (
              <>
                {mobileStackEditor ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "4px",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        ...btnAccent,
                        minHeight: 48,
                        borderRadius: 12,
                        padding: "12px 10px",
                        touchAction: "manipulation",
                        fontSize: "13px",
                        fontWeight: 700,
                        boxSizing: "border-box",
                      }}
                      disabled={project.viewMode === "view"}
                      title={t("editor.layout.addCueAria")}
                      onClick={() => setAddCueDialogOpen(true)}
                    >
                      ＋ 次のキュー
                    </button>
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        minHeight: 48,
                        borderRadius: 12,
                        padding: "12px 10px",
                        touchAction: "manipulation",
                        fontSize: "13px",
                        fontWeight: 700,
                        boxSizing: "border-box",
                      }}
                      onClick={() => setStageAreaSettingsOpen(true)}
                    >
                      舞台設定
                    </button>
                  </div>
                ) : null}
                {mobileStackEditor ? (
                  <div
                    style={{
                      flexShrink: 0,
                      width: "100%",
                      minWidth: 0,
                      maxWidth: "100%",
                      overflowX: "auto",
                      overflowY: "visible",
                      WebkitOverflowScrolling: "touch",
                      paddingBottom: 6,
                      borderBottom: "1px solid #1e293b",
                    }}
                  >
                    {/* ChoreoCoreToolbar hidden — replaced by NeonIconPanel */}
                  </div>
                ) : null}
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
                ) : mobileStackEditor ? (
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
                      marginBottom: rosterOnlyMode ? 0 : 6,
                    }}
                  >
                    <div className="editor-right-tools-host">
                      <div className="editor-right-tools-tiles">
                        <EditorStageWorkbench
                          key="wb-mobile-rail"
                          layout="rail"
                          {...stageWorkbenchProps}
                        />
                      </div>
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <div
                style={{
                  flexShrink: 0,
                  width: "100%",
                  padding: "12px 0 4px",
                  boxSizing: "border-box",
                }}
              >
                <button
                  type="button"
                  style={{
                    ...btnAccent,
                    width: "100%",
                    minHeight: 48,
                    touchAction: "manipulation",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                  onClick={() => setMobileEditorToolsExpanded(true)}
                >
                  操作パネルを表示
                </button>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 11,
                    color: shell.textMuted,
                    lineHeight: 1.45,
                    textAlign: "center",
                  }}
                >
                  ツールバー・キュー操作・床テキストなどはここから開きます
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
  );
}
