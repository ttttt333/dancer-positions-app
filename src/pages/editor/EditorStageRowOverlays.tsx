import { lazy, Suspense } from "react";
import { useSafeElementRef } from "./useSafeElementRef";
import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoGridLogo";
import { StageBoard } from "../../components/StageBoard";
import { DancerPathEditor } from "../../components/DancerPathEditor";
import { RosterTimelineStrip } from "../../components/RosterTimelineStrip";
import { NeonIconPanel } from "../../components/NeonIconPanel";
import { AiSuggestDialog } from "../../components/AiSuggestDialog";
import { EditorStageWorkbench, WorkbenchCuePager } from "../../components/EditorStageWorkbench";
import { StageShapePicker } from "../../components/StageShapePicker";
import { SetPiecePickerModal } from "../../components/SetPiecePickerModal";
import { EditorSideSheet } from "../../components/EditorSideSheet";
import { FloorTextSideSheetContent } from "../../components/FloorTextSideSheetContent";
import { ShareLinksSheetContent } from "../../components/ShareLinksSheetContent";
import { ViewerModeSheetContent } from "../../components/ViewerModeSheetContent";
import {
  ChoreoViewerBottomBar,
  ChoreoViewerChromeRestoreFab,
} from "../../components/ChoreoViewerBottomBar";
import { VideoExportSheet } from "../../components/VideoExportSheet";
import { useVideoExportUiStore } from "../../store/videoExportUiStore";
import { btnAccent, btnSecondary } from "../../components/stageButtonStyles";
import { panelCard, shell } from "../../theme/choreoShell";
import { modDancerColorIndex, DANCER_COLOR_PALETTE_HEX } from "../../lib/dancerColorPalette";
import { sortCuesByStart, MIN_CUE_DURATION_SEC, DEFAULT_CUE_SPAN_WITH_AUDIO_SEC } from "../../core/timelineController";
import { dancersForLayoutPreset, transferDancerIdentitiesByOrder } from "../../lib/formationLayouts";
import { formatMmSsFloor } from "../../lib/timeFormat";
import { getViewRosterEntries } from "../../lib/viewRoster";
import { listStagePresets, saveStagePreset } from "../../lib/stagePresets";
import { parseMeterCmDraftToMm } from "./stageAreaSettingsDraft";
import {
  StageAreaDimensionRows,
  StageAreaGridSpacingControls,
  StageAreaGridVisibilityToggles,
  StageAreaPresetBlock,
  StageAreaSettingsSheet,
  STAGE_AREA_SHEET_SECTION,
} from "./stageAreaSettingsUi";
import {
  DEFAULT_ROSTER_CONFIRM_PRESET,
  EDITOR_GRID_GAP_PX,
  STAGE_RESIZER_PX,
  TOP_DOCK_HEIGHT_PX,
  TOP_DOCK_ROW_MIN_PX,
} from "./editorConstants";
import type { EditorLayoutProps } from "./editorLayoutProps";

const Stage3DView = lazy(() =>
  import("../../components/Stage3DView").then((m) => ({ default: m.Stage3DView }))
);


export function EditorStageRowOverlays(props: EditorLayoutProps) {
  const videoExportOpen = useVideoExportUiStore((s) => s.open);
  const closeVideoExport = useVideoExportUiStore((s) => s.closeSheet);
  const activeFormationId = props.activeFormationId as never;
  const addCueDialogEl = props.addCueDialogEl as never;
  const addDancerFromStageToolbar = props.addDancerFromStageToolbar as never;
  const aiSuggestOpen = props.aiSuggestOpen as never;
  const applyStageAreaSettingsDraft = props.applyStageAreaSettingsDraft as never;
  const closeStageAreaSettings = props.closeStageAreaSettings as (
    mode?: "apply" | "discard" | "cancel"
  ) => void;
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
  const formationPresetPickerSheetEl = props.formationPresetPickerSheetEl as never;
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
  const setViewerChromeCollapsed = props.setViewerChromeCollapsed as never;
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

  const attachCueListPortalEl = useSafeElementRef(setCueListPortalEl);
  const attachTextPanelPortalEl = useSafeElementRef(setTextPanelPortalEl);

  return (
    <>
      {showTopWaveDock ? (
        <>
          {cueListModalOpen ? (
            <EditorSideSheet
              open
              zIndex={2200}
              width="min(300px, calc(100vw - 16px))"
              onClose={() => setCueListModalOpen(false)}
              ariaLabelledBy="cue-list-modal-title"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  minHeight: 0,
                  background: shell.surface,
                }}
              >
                {/* ── ヘッダー ── */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "11px 14px",
                    borderBottom: `1px solid ${shell.borderStrong}`,
                    flexShrink: 0,
                    background: shell.bgChrome,
                  }}
                >
                  <h2
                    id="cue-list-modal-title"
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 700,
                      color: shell.text,
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      letterSpacing: "0.03em",
                    }}
                  >
                    <span style={{ color: shell.accent, display: "flex", opacity: 0.9 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                      </svg>
                    </span>
                    キュー一覧
                  </h2>
                  <button
                    type="button"
                    aria-label={t("editor.layout.close")}
                    onClick={() => setCueListModalOpen(false)}
                    style={{
                      background: "transparent",
                      border: `1px solid ${shell.border}`,
                      borderRadius: 6,
                      color: shell.textMuted,
                      fontSize: 16,
                      lineHeight: 1,
                      padding: "3px 9px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    ×
                  </button>
                </div>
                {/* ── シンプルキュー一覧 ── */}
                <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {project ? (
                    cuesSortedForStageJump.length === 0 ? (
                      <p style={{ fontSize: 12, color: shell.textMuted, textAlign: "center", padding: "24px 0" }}>
                        キューがありません。
                      </p>
                    ) : (
                      cuesSortedForStageJump.map((cue, idx) => {
                        const isSelected = selectedCueId === cue.id;
                        const canEditCues = project.viewMode !== "view";
                        const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
                        return (
                          <div
                            key={cue.id}
                            style={{
                              display: "flex",
                              alignItems: "stretch",
                              gap: 6,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCueIds([cue.id]);
                                setCueListModalOpen(false);
                              }}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                textAlign: "left",
                                borderRadius: 8,
                                border: `1px solid ${isSelected ? shell.accent : shell.border}`,
                                background: isSelected ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
                                padding: "8px 10px",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                cursor: "pointer",
                                transition: "background 0.12s, border-color 0.12s",
                              }}
                            >
                              <span style={{
                                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                background: isSelected ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)",
                                color: isSelected ? "#a5b4fc" : shell.textMuted,
                                fontSize: 10, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                {idx + 1}
                              </span>
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: shell.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {cue.name || t("editor.layout.cueName", { n: idx + 1 })}
                                </span>
                                <span style={{ display: "block", fontSize: 11, color: shell.textMuted, marginTop: 2 }}>
                                  {fmtSec(cue.tStartSec)} – {fmtSec(cue.tEndSec)}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              aria-label={`${cue.name || t("editor.layout.cueName", { n: idx + 1 })}を削除`}
                              title="削除"
                              disabled={!canEditCues}
                              onClick={() => {
                                if (!canEditCues) return;
                                setProjectSafe((prev) => ({
                                  ...prev,
                                  cues: sortCuesByStart(prev.cues.filter((c) => c.id !== cue.id)),
                                }));
                                setSelectedCueIds((prev) => prev.filter((id) => id !== cue.id));
                              }}
                              style={{
                                flexShrink: 0,
                                width: 44,
                                borderRadius: 8,
                                border: "1px solid rgba(196,30,58,0.35)",
                                background: "rgba(196,30,58,0.14)",
                                color: "#fca5a5",
                                fontSize: 18,
                                fontWeight: 700,
                                lineHeight: 1,
                                cursor: canEditCues ? "pointer" : "not-allowed",
                                opacity: canEditCues ? 1 : 0.35,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 0,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })
                    )
                  ) : null}
                </div>
                {/* ポータルターゲット（非表示で維持） */}
                <div
                  ref={attachCueListPortalEl}
                  aria-hidden
                  style={{ position: "absolute", left: -32000, top: 0, width: 400, height: 520, overflow: "hidden", opacity: 0, pointerEvents: "none", zIndex: -1, display: "flex", flexDirection: "column" }}
                />
              </div>
            </EditorSideSheet>
          ) : (
            <div
              ref={attachCueListPortalEl}
              aria-hidden
              style={{
                position: "fixed",
                left: -32000,
                top: 0,
                width: 400,
                height: 520,
                overflow: "hidden",
                opacity: 0,
                pointerEvents: "none",
                zIndex: -1,
                display: "flex",
                flexDirection: "column",
              }}
            />
          )}
        </>
      ) : null}

      {/* ── メンバー表示 SideSheet ── */}
      <EditorSideSheet
        open={memberRosterSheetOpen}
        zIndex={2200}
        width="min(380px, calc(100vw - 16px))"
        onClose={() => setMemberRosterSheetOpen(false)}
        ariaLabelledBy="member-roster-sheet-title"
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: shell.surface }}>
          {/* ヘッダー */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 8, padding: "11px 14px",
            borderBottom: `1px solid ${shell.borderStrong}`,
            flexShrink: 0, background: shell.bgChrome,
          }}>
            <h2 id="member-roster-sheet-title" style={{
              margin: 0, fontSize: "13px", fontWeight: 700, color: shell.text,
              display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.03em",
            }}>
              <span style={{ color: shell.accent, display: "flex", opacity: 0.9 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                  <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
              </span>
              メンバー
            </h2>
            <button
              type="button"
              aria-label={t("editor.layout.close")}
              onClick={() => setMemberRosterSheetOpen(false)}
              style={{ background: "transparent", border: `1px solid ${shell.border}`, borderRadius: 6, color: shell.textMuted, fontSize: 16, lineHeight: 1, padding: "3px 9px", cursor: "pointer" }}
            >×</button>
          </div>
          {/* 本文 */}
          <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {(() => {
              const fid = project?.activeFormationId;
              const formation = fid ? formationById.get(fid) : null;
              if (!formation || formation.dancers.length === 0) {
                return (
                  <p style={{ fontSize: 12, color: shell.textMuted, textAlign: "center", padding: "32px 0" }}>
                    このフォーメーションにメンバーがいません。<br />
                    ＋ボタンでメンバーを追加してください。
                  </p>
                );
              }
              return formation.dancers.map((dancer, idx) => {
                const colorHex = DANCER_COLOR_PALETTE_HEX[dancer.colorIndex % DANCER_COLOR_PALETTE_HEX.length];
                const badgeLabel = dancer.markerBadge ?? String(idx + 1);
                return (
                  <div key={dancer.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "7px 10px", borderRadius: 10,
                    border: `1px solid ${shell.border}`,
                    background: "rgba(255,255,255,0.025)",
                  }}>
                    {/* カラーサークル */}
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: colorHex, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700,
                      color: "#fff", textShadow: "0 0 2px rgba(0,0,0,0.6)",
                    }}>
                      {badgeLabel}
                    </div>
                    {/* 名前入力 */}
                    <input
                      type="text"
                      value={dancer.label ?? ""}
                      placeholder={t("editor.layout.dancerPlaceholder", { n: idx + 1 })}
                      disabled={project?.viewMode === "view"}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProjectSafe((p) => ({
                          ...p,
                          formations: p.formations.map((f) =>
                            f.id !== fid ? f : {
                              ...f,
                              dancers: f.dancers.map((d) => d.id === dancer.id ? { ...d, label: val } : d),
                            }
                          ),
                        }));
                      }}
                      style={{
                        flex: 1, background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${shell.border}`, borderRadius: 6,
                        color: shell.text, fontSize: 12, padding: "5px 8px", outline: "none",
                      }}
                    />
                    {/* カラー変更 */}
                    {project?.viewMode !== "view" && (
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {DANCER_COLOR_PALETTE_HEX.slice(0, 9).map((hex, ci) => (
                          <button
                            key={hex}
                            type="button"
                            title={hex}
                            onClick={() => {
                              setProjectSafe((p) => ({
                                ...p,
                                formations: p.formations.map((f) =>
                                  f.id !== fid ? f : {
                                    ...f,
                                    dancers: f.dancers.map((d) =>
                                      d.id === dancer.id ? { ...d, colorIndex: ci } : d
                                    ),
                                  }
                                ),
                              }));
                            }}
                            style={{
                              width: 14, height: 14, borderRadius: "50%", background: hex,
                              border: dancer.colorIndex === ci ? `2px solid #fff` : `1px solid transparent`,
                              cursor: "pointer", padding: 0, flexShrink: 0,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          {/* フッター：全フォーメーションに名前を反映 */}
          {project?.viewMode !== "view" && (() => {
            const fid = project?.activeFormationId;
            const formation = fid ? formationById.get(fid) : null;
            /** crew メンバーのうち未配置のものがあるか */
            const unplacedCount = (() => {
              if (!formation || !project) return 0;
              const placedIds = new Set(
                formation.dancers.map((d) => d.crewMemberId).filter(Boolean) as string[]
              );
              let n = 0;
              for (const crew of project.crews) {
                for (const m of crew.members) {
                  if (!placedIds.has(m.id)) n++;
                }
              }
              return n;
            })();
            return (
              <div style={{ padding: "10px 12px", borderTop: `1px solid ${shell.borderStrong}`, flexShrink: 0, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={addDancerFromStageToolbar}
                  style={{ ...btnSecondary, fontSize: 12, padding: "7px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 5, flex: "0 0 auto", justifyContent: "center" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  追加
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!project || !fid) { setMemberRosterSheetOpen(false); return; }
                    setProjectSafe((p) => {
                      if (p.viewMode === "view") return p;
                      const f = p.formations.find((x) => x.id === fid);
                      if (!f) return { ...p, rosterHidesTimeline: false };

                      // crew メンバーを import 順に並べる
                      const placedIds = new Set(
                        f.dancers.map((d) => d.crewMemberId).filter(Boolean) as string[]
                      );
                      let order = 0;
                      const toAdd: Array<{ crewId: string; member: { id: string; label: string; colorIndex: number; heightCm?: number; gradeLabel?: string; skillRankLabel?: string }; importOrder: number }> = [];
                      for (const crew of p.crews) {
                        for (const m of crew.members) {
                          if (!placedIds.has(m.id)) {
                            toAdd.push({ crewId: crew.id, member: m, importOrder: order });
                          }
                          order++;
                        }
                      }

                      if (toAdd.length === 0) {
                        // すでに全員配置済み → シートを閉じるだけ
                        return { ...p, rosterHidesTimeline: false };
                      }

                      const existing = [...f.dancers];
                      const total = existing.length + toAdd.length;
                      const opts = {
                        dancerSpacingMm: p.dancerSpacingMm,
                        stageWidthMm: p.stageWidthMm,
                      };
                      const placeholders: DancerSpot[] = [
                        ...existing,
                        ...toAdd.map((row) => {
                          const m = row.member;
                          return {
                            id: crypto.randomUUID(),
                            label: m.label.trim().slice(0, 120) || "?",
                            markerBadge: "",
                            xPct: 50,
                            yPct: 40,
                            colorIndex: modDancerColorIndex(m.colorIndex),
                            crewMemberId: m.id,
                            ...(typeof m.heightCm === "number" ? { heightCm: m.heightCm } : {}),
                            ...(m.gradeLabel?.trim() ? { gradeLabel: m.gradeLabel.trim().slice(0, 32) } : {}),
                            ...(m.skillRankLabel?.trim() ? { skillRankLabel: m.skillRankLabel.trim().slice(0, 24) } : {}),
                          } satisfies DancerSpot;
                        }),
                      ];
                      const positioned = dancersForLayoutPreset(total, DEFAULT_ROSTER_CONFIRM_PRESET, opts);
                      const merged = transferDancerIdentitiesByOrder(positioned, placeholders);

                      // キューがなければ先頭キューを自動生成
                      const sortedCues = sortCuesByStart(p.cues);
                      const ensuredCues =
                        sortedCues.length > 0
                          ? p.cues
                          : [
                              {
                                id: crypto.randomUUID(),
                                tStartSec: 0,
                                tEndSec: Math.max(
                                  MIN_CUE_DURATION_SEC,
                                  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC
                                ),
                                formationId: fid,
                              },
                            ];

                      return {
                        ...p,
                        cues: ensuredCues,
                        rosterHidesTimeline: false,
                        dancerLabelPosition: "below",
                        dancerMarkerDiameterPx: dancerMarkerDiameterAfterRosterImport(
                          p.dancerMarkerDiameterPx
                        ),
                        formations: p.formations.map((fm) =>
                          fm.id === fid
                            ? { ...fm, dancers: merged, confirmedDancerCount: merged.length }
                            : fm
                        ),
                      };
                    });
                    setMemberRosterSheetOpen(false);
                  }}
                  style={{ ...btnAccent, fontSize: 12, padding: "7px 14px", borderRadius: 8, display: "flex", alignItems: "center", gap: 5, flex: 1, justifyContent: "center" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {unplacedCount > 0
                    ? t("editor.layout.confirmStageWithCount", { n: unplacedCount })
                    : t("editor.layout.confirmStage")}
                </button>
              </div>
            );
          })()}
        </div>
      </EditorSideSheet>

      {stageAreaSettingsOpen ? (
        <StageAreaSettingsSheet
          stageAreaSettingsOpen={stageAreaSettingsOpen}
          onClose={() => closeStageAreaSettings()}
        >
          <div style={{ padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 0 }}>
            {/* ── Header ── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 8, marginBottom: 8, paddingBottom: 8,
              borderBottom: "1px solid rgba(99,102,241,0.2)",
            }}>
              <h3 id="stage-area-settings-title" style={{
                margin: 0, fontSize: 14, fontWeight: 700, color: "#e2e8f0",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ color: "rgba(129,140,248,0.9)", display: "flex" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                </span>
                舞台設定
              </h3>
              <button type="button" aria-label={t("editor.layout.close")}
                onClick={() => closeStageAreaSettings()}
                style={{ ...btnSecondary, fontSize: 16, lineHeight: 1, padding: "2px 10px" }}
              >×</button>
            </div>

            {/* ── CARD A: ステージ寸法 ── */}
            <div style={{ ...STAGE_AREA_SHEET_SECTION, marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(129,140,248,0.8)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 20L20 2M7 20l1.5-1.5M12 20l1.5-1.5M17 20l1.5-1.5M2 7l1.5-1.5M2 12l1.5-1.5M2 17l1.5-1.5"/></svg>
                ステージ寸法
              </div>

              {/* 客席位置トグル */}
              <div style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 10, color: "rgba(100,116,139,0.8)", marginBottom: 5 }}>{t("editor.layout.audienceEdge")}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["bottom", "top"] as const).map((edge) => {
                    const active = stageAreaSettingsDraft.audienceEdge === edge;
                    return (
                      <button key={edge} type="button"
                        disabled={project.viewMode === "view"}
                        onClick={() => setStageAreaSettingsDraft((d) => ({ ...d, audienceEdge: edge }))}
                        style={{
                          flex: 1, padding: "7px 10px", borderRadius: 8,
                          border: active ? "1px solid rgba(252,211,77,0.7)" : "1px solid rgba(51,65,85,0.8)",
                          background: active ? "rgba(252,211,77,0.1)" : "rgba(15,23,42,0.5)",
                          color: active ? "#fcd34d" : "rgba(148,163,184,0.7)",
                          fontSize: 11, fontWeight: active ? 700 : 400,
                          cursor: project.viewMode === "view" ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          transition: "all 0.15s",
                          boxShadow: active ? "0 0 10px rgba(252,211,77,0.2)" : "none",
                        }}
                      >
                        {edge === "bottom"
                          ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>{t("editor.layout.audienceBottom")}</>
                          : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>{t("editor.layout.audienceTop")}</>
                        }
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 寸法入力 */}
              <StageAreaDimensionRows
                disabled={project.viewMode === "view"}
                draft={stageAreaSettingsDraft}
                onChangeDraft={setStageAreaSettingsDraft}
              />


            </div>

            {/* ── CARD B: グリッド・表示設定 ── */}
            <div style={{ ...STAGE_AREA_SHEET_SECTION, marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(129,140,248,0.8)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                グリッド・表示
              </div>

              {/* グリッド間隔 */}
              {stageAreaDraftHasMainFloor && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>
                    グリッド線の間隔
                  </div>
                  <StageAreaGridSpacingControls
                    disabled={project.viewMode === "view"}
                    gridWidthCmInput={gridWidthCmInput}
                    gridDepthCmInput={gridDepthCmInput}
                    onStageGridCmInput={onStageGridCmInput}
                    commitStageGridCmInput={commitStageGridCmInput}
                    startGridNudgeRepeat={startGridNudgeRepeat}
                    stopGridNudgeRepeat={stopGridNudgeRepeat}
                    nudgeStageGridCm={nudgeStageGridCm}
                    gridNudgeDidRepeatRef={gridNudgeDidRepeatRef}
                  />
                </div>
              )}

              {/* 縦線・横線トグル */}
              <div style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{t("editor.layout.gridLines")}</div>
                <StageAreaGridVisibilityToggles
                  disabled={project.viewMode === "view"}
                  hasMainFloor={stageAreaDraftHasMainFloor}
                  verticalEnabled={stageAreaSettingsDraft.stageGridLinesVerticalEnabled}
                  horizontalEnabled={stageAreaSettingsDraft.stageGridLinesHorizontalEnabled}
                  onChangeDraft={setStageAreaSettingsDraft}
                />
              </div>

              {/* 名前の位置 — アイコン付きセグメント */}
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{t("editor.layout.dancerLabelPosition")}</div>
                <div style={{ display: "flex", gap: 6 }} title={t("editor.layout.labelPickerHint")}>
                  {([
                    { val: "inside", label: "○の中", icon: (
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2"/>
                        <text x="16" y="21" textAnchor="middle" fontSize="13" fill="currentColor" fontWeight="700">A</text>
                      </svg>
                    )},
                    { val: "below", label: "○の外", icon: (
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                        <text x="16" y="29" textAnchor="middle" fontSize="12" fill="currentColor" fontWeight="700">A</text>
                      </svg>
                    )},
                  ] as const).map(({ val, label, icon }) => {
                    const active = stageAreaSettingsDraft.dancerLabelPosition === val;
                    return (
                      <button key={val} type="button"
                        disabled={project.viewMode === "view"}
                        onClick={() => setStageAreaSettingsDraft((d) => ({ ...d, dancerLabelPosition: val }))}
                        style={{
                          flex: 1, padding: "6px 8px", borderRadius: 8,
                          border: active ? "1px solid rgba(99,102,241,0.8)" : "1px solid rgba(51,65,85,0.7)",
                          background: active ? "rgba(99,102,241,0.2)" : "rgba(15,23,42,0.5)",
                          color: active ? "#a5b4fc" : "rgba(148,163,184,0.6)",
                          fontSize: 11, fontWeight: active ? 700 : 400,
                          cursor: project.viewMode === "view" ? "not-allowed" : "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                          transition: "all 0.15s",
                          boxShadow: active ? "0 0 10px rgba(99,102,241,0.25)" : "none",
                        }}
                      >
                        {icon}
                        <span style={{ fontSize: 10 }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── CARD C: プリセット・共有 ── */}
            <div style={{ ...STAGE_AREA_SHEET_SECTION, marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(129,140,248,0.8)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                プリセット・共有
              </div>

              <StageAreaPresetBlock
                disabled={project.viewMode === "view"}
                stageAreaPresetSelectNonce={stageAreaPresetSelectNonce}
                stageAreaPresetList={stageAreaPresetList}
                onChangeDraft={setStageAreaSettingsDraft}
                onBumpPresetNonce={() => setStageAreaPresetSelectNonce((n) => n + 1)}
                onSavePreset={() => {
                  if (project.viewMode === "view") return;
                  const d = stageAreaSettingsDraftRef.current;
                  const dims = {
                    stageWidthMm: parseMeterCmDraftToMm(d.width),
                    stageDepthMm: parseMeterCmDraftToMm(d.depth),
                    sideStageMm: parseMeterCmDraftToMm(d.side),
                    backStageMm: parseMeterCmDraftToMm(d.back),
                    centerFieldGuideIntervalMm: parseMeterCmDraftToMm(d.guide),
                  };
                  const defaultName = t("editor.layout.savePresetDefaultName", { n: stageAreaPresetList.length + 1 });
                  const name = window.prompt(t("editor.layout.savePresetPrompt"), defaultName);
                  if (name === null) return;
                  const result = saveStagePreset(name.trim() || defaultName, dims);
                  if (!result.ok) { window.alert(result.message); return; }
                  setStageAreaPresetList(listStagePresets());
                }}
              />


            </div>

            {/* ── 決定・取消 ── */}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button"
                disabled={project.viewMode === "view"}
                onClick={() => closeStageAreaSettings("apply")}
                style={{
                  flex: 2, padding: "10px 14px", fontSize: 13, fontWeight: 700,
                  borderRadius: 10,
                  border: "1px solid rgba(129,140,248,0.5)",
                  background: project.viewMode === "view"
                    ? "rgba(30,41,59,0.5)"
                    : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)",
                  color: project.viewMode === "view" ? "rgba(71,85,105,0.7)" : "#fff",
                  cursor: project.viewMode === "view" ? "not-allowed" : "pointer",
                  boxShadow: project.viewMode === "view" ? "none" : "0 0 20px rgba(99,102,241,0.45), 0 2px 8px rgba(0,0,0,0.4)",
                  letterSpacing: "0.04em",
                  transition: "box-shadow 0.2s",
                }}
              >
                {t("editor.layout.confirmOk")}
              </button>
              <button type="button"
                onClick={() => closeStageAreaSettings("cancel")}
                style={{ ...btnSecondary, flex: 1, padding: "10px 10px", fontSize: 12, fontWeight: 600, borderRadius: 10 }}
              >
                取消
              </button>
            </div>
          </div>
        </StageAreaSettingsSheet>
      ) : null}

      {stageSettingsOpen ? (
        <EditorSideSheet
          open
          zIndex={60}
          width="min(520px, 46vw)"
          onClose={() => setStageSettingsOpen(false)}
          ariaLabelledBy="stage-settings-dialog-title"
        >
          <div style={{ padding: "16px 18px 18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <h3
                id="stage-settings-dialog-title"
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                ステージ設定
              </h3>
              <button
                type="button"
                aria-label={t("editor.layout.close")}
                onClick={() => setStageSettingsOpen(false)}
                style={{
                  ...btnSecondary,
                  fontSize: "18px",
                  lineHeight: 1,
                  padding: "4px 12px",
                }}
              >
                ×
              </button>
            </div>
            <StageDimensionFields
              project={project}
              setProject={setProjectSafe}
              disabled={project.viewMode === "view"}
              compact={false}
              showHeading={false}
              embedded
              showAudienceEdge
              onCommit={() => setStageSettingsOpen(false)}
            />
          </div>
        </EditorSideSheet>
      ) : null}

      {shortcutsHelpOpen ? (
        <EditorSideSheet
          open
          zIndex={60}
          width="min(480px, 42vw)"
          onClose={() => setShortcutsHelpOpen(false)}
          ariaLabelledBy="shortcuts-dialog-title"
        >
          <div style={{ padding: "16px 18px 18px", maxHeight: "min(88vh, 560px)", overflow: "auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <h3
                id="shortcuts-dialog-title"
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                ショートカット
              </h3>
              <button
                type="button"
                aria-label={t("editor.layout.close")}
                onClick={() => setShortcutsHelpOpen(false)}
                style={{
                  ...btnSecondary,
                  fontSize: "18px",
                  lineHeight: 1,
                  padding: "4px 12px",
                }}
              >
                ×
              </button>
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "18px",
                color: "#cbd5e1",
                fontSize: "13px",
                lineHeight: 1.65,
              }}
            >
              <li>
                <strong style={{ color: "#e2e8f0" }}>Space</strong>{" "}
                再生／一時停止（タイムラインにフォーカス不要・入力欄以外）
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>⌘Z / Ctrl+Z</strong> 元に戻す ·{" "}
                <strong style={{ color: "#e2e8f0" }}>⌘⇧Z / Ctrl+⇧Z</strong> やり直し
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>Escape</strong>{" "}
                開いているダイアログを閉じる
              </li>
              <li>
                波形: 波形上でマウスホイール（またはトラックパッドの縦スクロール）で表示範囲を拡大・縮小
              </li>
              <li>
                ステージ微調整:{" "}
                <strong style={{ color: "#e2e8f0" }}>Shift+ドラッグ</strong>{" "}
                で細かいグリッドにスナップ（スナップON時。幅・奥行ありなら実寸グリッド）
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>⌘D / Ctrl+D</strong>{" "}
                ステージで選択中のメンバーを複製（名簿紐付けは外れます）
              </li>
              <li>
                ドラッグ移動中、<strong style={{ color: "#e2e8f0" }}>移動前の位置</strong>
                を薄い印で重ね表示します（指を離すと消えます）
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>Alt+矢印</strong>{" "}
                で選択ダンサーを微移動（<strong style={{ color: "#e2e8f0" }}>Shift+Alt</strong>{" "}
                でさらに細かく）
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>再生中にステージ</strong>{" "}
                のダンサー以外をクリック → 再生停止（先頭付近へ）
              </li>
              <li>
                大道具: ツールバー「大道具」から追加。モーダルで{" "}
                <strong style={{ color: "#e2e8f0" }}>編集画面全体に配置</strong>を選ぶとタイムライン周りにも置けます。
                選択中は青い丸ハンドルで回転（Shift で15°刻み）。右クリックで床／画面の切替や削除。
              </li>
              <li>
                タイムライン: 波形で <strong style={{ color: "#e2e8f0" }}>⌘／Ctrl+クリック</strong>{" "}
                でキュー複数選択、<strong style={{ color: "#e2e8f0" }}>Delete</strong>{" "}
                で一括削除（Undo 可）
              </li>
              <li>
                タイムライン: 波形上のキューを{" "}
                <strong style={{ color: "#e2e8f0" }}>右クリック</strong>
                →「複製する」「立ち位置リストに追加」は{" "}
                <strong style={{ color: "#e2e8f0" }}>はい</strong>／
                <strong style={{ color: "#e2e8f0" }}>いいえ</strong>で確定。「削除」はその場でキューを削除（Undo 可）
              </li>
              <li>
                タイムライン: 動画ファイルから <strong style={{ color: "#e2e8f0" }}>音声抽出</strong>（再生時間ぶんかかります）
                ・波形の <strong style={{ color: "#e2e8f0" }}>振幅 ±</strong> / 枠の下辺ドラッグで波形の高さ
              </li>
              <li>
                ステージ: <strong style={{ color: "#e2e8f0" }}>Alt+クリック</strong>（ダンサー印）で重なった印を手前から順に切替
              </li>
            </ul>
          </div>
        </EditorSideSheet>
      ) : null}

      <SetPiecePickerModal
        open={setPiecePickerOpen}
        onClose={() => setSetPiecePickerOpen(false)}
        onConfirm={confirmAddSetPiece}
        disabled={project.viewMode === "view"}
      />

      <StageShapePicker
        open={stageShapePickerOpen}
        currentShape={project.stageShape}
        legacyHanamichi={{
          enabled: project.hanamichiEnabled ?? false,
          depthPct: project.hanamichiDepthPct ?? 14,
        }}
        disabled={project.viewMode === "view"}
        onClose={() => setStageShapePickerOpen(false)}
        onConfirm={(shape) => {
          setProjectSafe((p) => ({
            ...p,
            /** 新しい形を選んだときは旧仕様の花道フラグはオフに統一 */
            hanamichiEnabled: false,
            stageShape: shape,
          }));
          setStageShapePickerOpen(false);
        }}
      />

      {cloudSaveDialogOpen && me && project ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 85,
            background: "rgba(2, 6, 23, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "max(16px, env(safe-area-inset-top))",
            boxSizing: "border-box",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCloudSaveDialogOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-save-dialog-title"
            style={{
              ...panelCard,
              maxWidth: 440,
              width: "100%",
              padding: "20px 22px 22px",
              boxSizing: "border-box",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id="cloud-save-dialog-title"
              style={{
                margin: "0 0 12px",
                fontSize: "17px",
                fontWeight: 700,
                color: "#f1f5f9",
              }}
            >
              {t("editor.cloudSaveTitle")}
            </h2>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: "13px",
                lineHeight: 1.6,
                color: "#94a3b8",
              }}
            >
              {serverId != null
                ? t("editor.cloudSaveBodyOverwrite")
                : t("editor.cloudSaveBodyNew")}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                style={{ ...btnSecondary, padding: "8px 16px", fontSize: "13px" }}
                disabled={saving}
                onClick={() => setCloudSaveDialogOpen(false)}
              >
                {t("editor.cloudSaveNo")}
              </button>
              <button
                type="button"
                style={{ ...btnAccent, padding: "8px 16px", fontSize: "13px" }}
                disabled={saving}
                onClick={() => void performCloudSave()}
              >
                {saving ? t("editor.saving") : t("editor.cloudSaveYes")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exportDialogEl}
      {!choreoPublicView && project ? (
        <VideoExportSheet
          open={videoExportOpen}
          onClose={closeVideoExport}
          project={project}
          durationSec={duration}
          fileName={
            (typeof projectName === "string" && projectName.trim()) ||
            "formation"
          }
        />
      ) : null}
      {flowLibraryDialogEl}
      {addCueDialogEl}
      {formationBoxManagerDialogEl}
      {formationPresetPickerSheetEl}

      {rosterImportSheetEl}

      {aiSuggestOpen && project ? (
        <AiSuggestDialog
          project={project}
          setProject={setProjectSafe}
          peaks={getWavePeaksSnapshot()}
          durationSec={duration}
          onClose={() => setAiSuggestOpen(false)}
        />
      ) : null}

      {!choreoPublicView ? (
        <EditorSideSheet
          open={shareLinksOpen}
          onClose={() => setShareLinksOpen(false)}
          zIndex={75}
          width="min(440px, 92vw)"
          ariaLabelledBy="share-links-panel-title"
        >
          <div style={{ padding: "16px 18px 22px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 4,
              }}
            >
              <h3
                id="share-links-panel-title"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#e2e8f0",
                }}
              >
                共有 URL
              </h3>
              <button
                type="button"
                aria-label={t("editor.layout.close")}
                onClick={() => setShareLinksOpen(false)}
                style={{
                  ...btnSecondary,
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "4px 12px",
                }}
              >
                ×
              </button>
            </div>
            <ShareLinksSheetContent
              open={shareLinksOpen}
              collabUrl={shareLinksUrls.collab}
              viewUrl={shareLinksUrls.view}
              hasServerId={serverId != null}
              pieceTitle={
                project?.pieceTitle?.trim() ||
                projectName.trim() ||
                "無題の作品"
              }
              onClose={() => setShareLinksOpen(false)}
            />
          </div>
        </EditorSideSheet>
      ) : null}

      {choreoPublicView && project ? (
        <EditorSideSheet
          open={choreoMemberSheetOpen}
          onClose={() => setChoreoMemberSheetOpen(false)}
          zIndex={88}
          width="min(400px, 92vw)"
        >
          <div
            style={{
              padding: "8px 16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              閲覧モード
            </h3>
            <button
              type="button"
              aria-label={t("editor.layout.close")}
              onClick={() => setChoreoMemberSheetOpen(false)}
              style={{
                ...btnSecondary,
                fontSize: 18,
                lineHeight: 1,
                padding: "4px 12px",
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: "0 16px 20px" }}>
            <ViewerModeSheetContent
              variant="public"
              pieceTitle={project.pieceTitle}
              entries={getViewRosterEntries(project)}
              canCapture2d={stageView === "2d"}
              onPick={(p) => {
                setChoreoStudentPick(p);
                if (viewerLocalStorageKey) {
                  try {
                    localStorage.setItem(
                      viewerLocalStorageKey,
                      JSON.stringify(p)
                    );
                  } catch {
                    /* ignore */
                  }
                }
                setChoreoMemberSheetOpen(false);
              }}
            />
          </div>
        </EditorSideSheet>
      ) : null}

      {!choreoPublicView && project ? (
        <EditorSideSheet
          open={editorViewerSheetOpen}
          onClose={() => setEditorViewerSheetOpen(false)}
          zIndex={88}
          width="min(400px, 92vw)"
        >
          <div
            style={{
              padding: "8px 16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              閲覧プレビュー
            </h3>
            <button
              type="button"
              aria-label={t("editor.layout.close")}
              onClick={() => setEditorViewerSheetOpen(false)}
              style={{
                ...btnSecondary,
                fontSize: 18,
                lineHeight: 1,
                padding: "4px 12px",
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: "0 16px 20px" }}>
            <ViewerModeSheetContent
              variant="editor"
              pieceTitle={project.pieceTitle}
              entries={getViewRosterEntries(project)}
              canCapture2d={stageView === "2d"}
              onPick={(p) => {
                setEditorViewerPreviewPick(p);
                setEditorViewerSheetOpen(false);
              }}
              onClearEditorPreview={() => setEditorViewerPreviewPick(null)}
            />
          </div>
        </EditorSideSheet>
      ) : null}

      {/* ─── 床テキスト編集サイドシート（wideEditorLayout + showTopWaveDock 時） ─── */}
      {showTopWaveDock && !choreoPublicView ? (
        <EditorSideSheet
          open={floorTextSideSheetOpen}
          onClose={() => {
            setFloorTextSideSheetOpen(false);
          }}
          zIndex={75}
          width="min(360px, 94vw)"
          ariaLabelledBy="floor-text-sheet-title"
        >
          <div ref={attachTextPanelPortalEl} style={{ display: "none" }} />
          <FloorTextSideSheetContent
            open={floorTextSideSheetOpen}
            floorTextPlaceSession={floorTextPlaceSession}
            setFloorTextPlaceSession={setFloorTextPlaceSession}
            commitFloorTextPlace={commitFloorTextPlace}
            onClose={() => setFloorTextSideSheetOpen(false)}
            onCancel={() => {
              setFloorTextPlaceSession(null);
              setFloorTextSideSheetOpen(false);
            }}
            onCommitted={() => setFloorTextSideSheetOpen(false)}
            t={t}
          />
        </EditorSideSheet>
      ) : null}

      {choreoPublicView && choreoStudentPick ? (
        <>
          {viewerChromeCollapsed ? (
            <ChoreoViewerChromeRestoreFab
              onRestore={() => setViewerChromeCollapsed(false)}
            />
          ) : null}
          <ChoreoViewerBottomBar
            timelineRef={timelineRef}
            project={project}
            choreoStudentPick={choreoStudentPick}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            tightHeight={publicViewTightHeight}
            chromeCollapsed={viewerChromeCollapsed}
            onChromeCollapsedChange={setViewerChromeCollapsed}
            onBeforeTransport={() => resyncViewerPlayback({ force: true })}
            onOpenMemberSheet={() => setChoreoMemberSheetOpen(true)}
            fileName={projectName}
          />
        </>
      ) : null}
    </>
  );
}
