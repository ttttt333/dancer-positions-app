import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ChoreoCoreLogo } from "../components/ChoreoGridLogo";
import { StageBoard, type FloorTextPlaceSession } from "../components/StageBoard";
import { DancerPathEditor } from "../components/DancerPathEditor";
import { StageDimensionFields } from "../components/StageDimensionFields";
import {
  formatMeterCmLabel,
  mmFromMeterAndCm,
  mmToMeterCm,
  STAGE_MAIN_FLOOR_MM_MAX,
} from "../lib/stageDimensions";
const Stage3DView = lazy(() =>
  import("../components/Stage3DView").then((m) => ({ default: m.Stage3DView }))
);
import { TimelinePanel } from "../components/TimelinePanel";
import { TimelineAudioChrome } from "../components/TimelineAudioChrome";
import {
  pauseAndSeekPlaybackToSec,
} from "../lib/playbackTransport";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { useEditorPlaybackSync } from "../hooks/useEditorPlaybackSync";
import { useEditorKeyboardShortcuts } from "../hooks/useEditorKeyboardShortcuts";
import { useEditorAudioSession } from "../hooks/useEditorAudioSession";
import { useTimelineMediaHandle } from "../hooks/useTimelineMediaHandle";
import { RosterTimelineStrip } from "../components/RosterTimelineStrip";
import {
  createEmptyProject,
  DEFAULT_DANCER_MARKER_DIAMETER_PX,
  dancerMarkerDiameterAfterRosterImport,
  tryMigrateFromLocalStorage,
} from "../lib/projectDefaults";
import { abortTimelineWavePointerGestures } from "../lib/abortTimelineWavePointerGestures";
import { preloadFFmpegWasm } from "../lib/ffmpegWasm";
import { normalizeProject } from "../lib/normalizeProject";
import { modDancerColorIndex, DANCER_COLOR_PALETTE_HEX } from "../lib/dancerColorPalette";
import {
  sortCuesByStart,
  MIN_CUE_DURATION_SEC,
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
  splitSharedCueFormations,
} from "../core/timelineController";
import {
  dancersForLayoutPreset,
  transferDancerIdentitiesByOrder,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import { dancersAtTime } from "../core/stageEngine";
import { floorMarkupAtTime, setPiecesAtTime } from "../lib/interpolateSetPieces";
import { FormationBoxManagerDialog } from "../components/FormationBoxManagerDialog";
import {
  listStagePresets,
  saveStagePreset,
  type StagePresetItem,
} from "../lib/stagePresets";
import { pickSpotForAppendedDancer } from "../lib/dancerAppendPlacement";
import {
  buildCrewFromRows,
  type RosterNameImportMode,
} from "../lib/crewCsvImport";
import {
  ROSTER_FILE_ACCEPT,
  labelForKind,
  parseRosterFile,
  type RosterFileKind,
} from "../lib/rosterFileImport";
import type {
  ChoreographyProjectJson,
  Cue,
  DancerSpot,
  Formation,
  RosterStripSortMode,
  SetPieceKind,
  StageFloorMarkup,
} from "../types/choreography";
import {
  type SetPiecePickerSubmit,
} from "../components/SetPiecePickerModal";
import { ChoreoCoreToolbar } from "../components/ChoreoCoreToolbar";
import { NeonIconPanel } from "../components/NeonIconPanel";
import { AiSuggestDialog } from "../components/AiSuggestDialog";
import {
  EditorStageWorkbench,
  WorkbenchCuePager,
  type EditorStageWorkbenchProps,
} from "../components/EditorStageWorkbench";
import { StageShapePicker } from "../components/StageShapePicker";
import { EditorSideSheet } from "../components/EditorSideSheet";
import { ExportDialog } from "../components/ExportDialog";
import { FlowLibraryDialog } from "../components/FlowLibraryDialog";
import { AddCueWithFormationDialog } from "../components/AddCueWithFormationDialog";
import { FormationPresetPickerSheet } from "../components/FormationPresetPickerSheet";
import { isSupabaseBackend } from "../lib/supabaseClient";
import { isCollabFeatureAvailable } from "../lib/collabAvailability";
import { projectShareLinks } from "../lib/shareProjectLinks";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { btnAccent, btnSecondary, inputField } from "../components/stageButtonStyles";
import { panelCard, shell } from "../theme/choreoShell";
import { useYjsCollaboration } from "../hooks/useYjsCollaboration";
import {
  captureStageSnapshot,
  mergeStageSnapshotIntoProject,
} from "../lib/savedSpotStageSnapshot";
import { getViewRosterEntries } from "../lib/viewRoster";
import { resolveAutoStudentPick } from "../lib/shareViewStudentPick";
import { isCustomStageShapeActive } from "../lib/stageShapePaths";
import {
  ChoreoStudentViewGate,
  type StudentPick,
} from "../components/ChoreoStudentViewGate";
import { ShareLinksSheetContent } from "../components/ShareLinksSheetContent";
import { ViewerModeSheetContent } from "../components/ViewerModeSheetContent";
import { formatMmSsFloor } from "../lib/timeFormat";
import {
  EDITOR_GRID_GAP_PX,
  EDITOR_MOBILE_STACK_MAX_PX,
  EDITOR_PLAYBACK_LAYOUT_SHIFT_UP,
  EDITOR_SHELL_TOP_WAVE_BASE_PX,
  EDITOR_SHELL_TOP_WAVE_ROSTER_ROW_PX,
  EDITOR_WIDE_MIN_PX,
  HISTORY_CAP,
  RIGHT_RAIL_FR_DEFAULT,
  RIGHT_TOOLS_RAIL_MAX_PX,
  RIGHT_TOOLS_RAIL_MIN_PX,
  STAGE_COL_FR_DEFAULT,
  STAGE_COL_MIN_PX,
  STAGE_RESIZER_PX,
  TIMELINE_FULL_COL_MIN_PX,
  TOP_DOCK_HEIGHT_PX,
  TOP_DOCK_HEIGHT_WIDE_PX,
  TOP_DOCK_ROW_MAX_PX,
  TOP_DOCK_ROW_MIN_PX,
  TOP_DOCK_ROW_MIN_WIDE_PX,
} from "./editor/editorConstants";
import {
  clampTopDockRowPx,
  persistEditorLayout,
  readStoredEditorLayout,
} from "./editor/editorLayoutStorage";
import { readMaxStageWidthPx, round2Pct, studentPickToStageFocus } from "./editor/editorStageLayout";
import { useEditorViewport } from "./editor/editorViewport";
import { EditorPageLayout } from "./editor/EditorPageLayout";
import type { EditorLayoutProps } from "./editor/editorLayoutProps";
import {
  clampGridSpacingCm,
  clampGuideIntervalToWidth,
  emptyStageAreaSettingsDraft,
  parseGridSpacingInput,
  parseMeterCmDraftToMm,
  projectToStageAreaDraft,
  type StageAreaSettingsDraft,
} from "./editor/stageAreaSettingsDraft";
import { useEditorProjectLoader } from "../hooks/useEditorProjectLoader";
import { useEditorHistory } from "../hooks/useEditorHistory";
import { useEditorCloudSave } from "../hooks/useEditorCloudSave";
import { useEditorAutoSave } from "../hooks/useEditorAutoSave";


const DEFAULT_ROSTER_CONFIRM_PRESET: LayoutPresetId = "rows_3";

export function EditorPage({
  choreoPublicView = false,
}: {
  choreoPublicView?: boolean;
} = {}) {
  const { projectId, shareToken: shareTokenParam } = useParams<{
    projectId?: string;
    shareToken?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { editorMobileStackBreakpoint, editorMobileLandscape } = useEditorViewport();
  const { me, ready: authReady } = useAuth();
  const { t } = useI18n();
  const collabRequested = searchParams.get("collab") === "1" && !choreoPublicView;
  const collabParam = collabRequested && isCollabFeatureAvailable();
  const collabUnavailableNotice = collabRequested && !isCollabFeatureAvailable();
  const onHistoryResetRef = useRef<() => void>(() => {});
  const onHistoryReset = useCallback(() => {
    onHistoryResetRef.current();
  }, []);
  const loader = useEditorProjectLoader({
    projectId,
    shareTokenParam,
    choreoPublicView,
    collabParam,
    me,
    authReady,
    location,
    navigate,
    onHistoryReset,
  });
  const {
    plainProject,
    setPlainProject,
    projectName,
    setProjectName,
    serverId,
    setServerId,
    serverShareToken,
    setServerShareToken,
    loadError,
    saving,
    setSaving,
    skipNextProjectFetchRef,
    projectSaveRef,
  } = loader;
  const {
    cloudSaveDialogOpen,
    setCloudSaveDialogOpen,
    syncProjectToCloud,
    performCloudSave,
  } = useEditorCloudSave({
    me,
    projectName,
    serverId,
    projectSaveRef,
    setProjectName,
    setServerId,
    setServerShareToken,
    setSaving,
    navigate,
  });

  const currentTime = usePlaybackUiStore((s) => s.currentTimeSec);
  const isPlaying = usePlaybackUiStore((s) => s.isPlaying);
  const setIsPlaying = usePlaybackUiStore((s) => s.setIsPlaying);
  const duration = usePlaybackUiStore((s) => s.durationSec);
  const [stageView, setStageView] = useState<"2d" | "3d">("2d");
  const [stagePreviewDancers, setStagePreviewDancers] = useState<DancerSpot[] | null>(
    null
  );
  /** 個人別軌道エディタを開くキューID */
  const [pathEditorCueId, setPathEditorCueId] = useState<string | null>(null);
  /** ChoreoCore: 編集対象のキュー（ステージ・プリセット・インスペクタの書き込み先） */
  const [selectedCueIds, setSelectedCueIds] = useState<string[]>([]);
  const selectedCueId =
    selectedCueIds.length === 0
      ? null
      : selectedCueIds[selectedCueIds.length - 1]!;
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [flowLibraryOpen, setFlowLibraryOpen] = useState(false);
  /** 立ち位置保存ボタンから開く管理ダイアログ */
  const [formationBoxManagerOpen, setFormationBoxManagerOpen] = useState(false);
  /** キュー追加 ＋ 形選択 ＋ 形の箱保存を 1 画面に統合したダイアログ */
  const [addCueDialogOpen, _setAddCueDialogOpen] = useState(false);
  /** ステージ左上 Change から開く立ち位置雛形ピッカー */
  const [formationPresetPickerOpen, setFormationPresetPickerOpen] = useState(false);
  const setAddCueDialogOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    if (v === true || (typeof v === "function" && v(false) === true)) {
      console.trace("[DEBUG] setAddCueDialogOpen(true) called from:");
    }
    _setAddCueDialogOpen(v);
  };
  /**
   * 右ペイン（タイムライン／右ツール列）を畳んでステージを最大化するトグル。
   * 畳んでもステージ上にグリッド用ツールバーが出るほか、ステージ上部のページャーから
   * キュー切替は引き続き可能。狭いビューポート（!wideEditorLayout）では無効。
   */
  const [rightPaneCollapsed, setRightPaneCollapsed] = useState(false);
  /** スマホ縦積み: 波形・再生ブロックの表示（TimelinePanel はマウントしたまま） */
  const [mobileEditorWaveExpanded, setMobileEditorWaveExpanded] = useState(true);
  /** スマホ縦積み: 右下の操作列（ツールバー・ワークベンチ等）の表示。モバイルではステージを広く使うため初期は折りたたむ */
  const [mobileEditorToolsExpanded, setMobileEditorToolsExpanded] = useState(false);
  useEffect(() => {
    if (!editorMobileStackBreakpoint) {
      // デスクトップに戻ったら両方展開
      setMobileEditorWaveExpanded(true);
      setMobileEditorToolsExpanded(true);
    } else {
      // モバイルに切り替わったら操作パネルを折りたたむ
      setMobileEditorToolsExpanded(false);
    }
  }, [editorMobileStackBreakpoint]);

  // 横向きになったら波形エリアも折りたたんでステージ高さを確保
  useEffect(() => {
    if (editorMobileLandscape) {
      abortTimelineWavePointerGestures();
      setMobileEditorWaveExpanded(false);
    }
  }, [editorMobileLandscape]);

  useEffect(() => {
    if (!mobileEditorWaveExpanded) {
      abortTimelineWavePointerGestures();
    }
  }, [mobileEditorWaveExpanded]);

  useEffect(() => {
    if (rightPaneCollapsed) {
      abortTimelineWavePointerGestures();
    }
  }, [rightPaneCollapsed]);
  const [stageSettingsOpen, setStageSettingsOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  /** ステージ列ヘッダの「設定」：舞台・グリッド・名前・共有・ヒントを集約 */
  const [stageAreaSettingsOpen, setStageAreaSettingsOpen] = useState(false);
  const [stageAreaSettingsDraft, setStageAreaSettingsDraft] =
    useState<StageAreaSettingsDraft>(emptyStageAreaSettingsDraft);
  const [gridWidthCmInput, setGridWidthCmInput] = useState<string>("1");
  const [gridDepthCmInput, setGridDepthCmInput] = useState<string>("1");
  const stageAreaSettingsDraftRef = useRef(stageAreaSettingsDraft);
  stageAreaSettingsDraftRef.current = stageAreaSettingsDraft;
  const [stageAreaPresetList, setStageAreaPresetList] = useState<StagePresetItem[]>([]);
  const [stageAreaPresetSelectNonce, setStageAreaPresetSelectNonce] = useState(0);
  const prevStageAreaOpenRef = useRef(false);
  const [shareLinkCopiedFlash, setShareLinkCopiedFlash] = useState(false);
  const shareCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 生徒向け /view ルート: メンバー選択後の閲覧 */
  const [choreoStudentPick, setChoreoStudentPick] = useState<StudentPick | null>(null);
  const [shareLinksOpen, setShareLinksOpen] = useState(false);
  const [choreoMemberSheetOpen, setChoreoMemberSheetOpen] = useState(false);
  /** 編集画面: 生徒用閲覧と同じ「一人強調」をプレビュー */
  const [editorViewerSheetOpen, setEditorViewerSheetOpen] = useState(false);
  const [editorViewerPreviewPick, setEditorViewerPreviewPick] =
    useState<StudentPick | null>(null);
  const [setPiecePickerOpen, setSetPiecePickerOpen] = useState(false);
  /** 変形舞台ピッカー（舞台形状のカスタマイズ） */
  const [stageShapePickerOpen, setStageShapePickerOpen] = useState(false);
  /** ワイド時のみ。null = 既定の fr 比、数値 = ステージ列の幅（px） */
  const [stageColumnPx, setStageColumnPx] = useState<number | null>(() => {
    return readStoredEditorLayout().stageColumnPx;
  });
  const [wideEditorLayout, setWideEditorLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`).matches
  );
  /** 閲覧: 縦幅が低い（ランドスケープ等）でタイムライン＋下バーがステージを圧迫しやすい */
  const [publicViewTightHeight, setPublicViewTightHeight] = useState(() => {
    if (typeof window === "undefined" || !choreoPublicView) return false;
    return window.matchMedia("(max-height: 520px)").matches;
  });
  /** 閲覧共有: 下バー・左レール・キューページャを隠してステージを最大化 */
  const [viewerChromeCollapsed, setViewerChromeCollapsed] = useState(false);
  /** 閲覧下バーの高さ（横画面レール位置・ステージ余白用 CSS 変数） */
  const [viewerBarHeightPx, setViewerBarHeightPx] = useState(52);
  /** ワイド＋タイムライン表示時: キュー一覧モーダルの開閉（一覧本体はポータルで描画） */
  const [cueListModalOpen, setCueListModalOpen] = useState(false);
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);
  const [cueListPortalEl, setCueListPortalEl] =
    useState<HTMLDivElement | null>(null);
  /** 上部ドック時の上段（波形・再生）行の高さ（px）。null = 既定の `minmax(160px, min(28vh, 300px))` */
  const [topDockRowPx, setTopDockRowPx] = useState<number | null>(() => {
    return readStoredEditorLayout().topDockRowPx;
  });
  /** ステージのみ全画面（波形・右列・ステージ上の補助行を隠す） */
  const [stageZenFullscreen, setStageZenFullscreen] = useState(false);
  /** `showTopWaveDock` の直前値（早期 return の前でもフック順を一定にするため ref はここで保持） */
  const prevShowTopWaveDockRef = useRef<boolean | undefined>(undefined);
  /** ステージ「名簿取り込み」: ファイル選択後の表示名モード確認 */
  const [rosterImportDraft, setRosterImportDraft] = useState<{
    rows: string[][];
    baseName: string;
    kind: RosterFileKind;
    notice?: string;
  } | null>(null);
  const [rosterImportNameMode, setRosterImportNameMode] =
    useState<RosterNameImportMode>("full");
  /** 名簿取り込み確認ダイアログ: ファイル以外に手入力で追加するメンバー（各行が 1 名） */
  const [rosterImportExtraNames, setRosterImportExtraNames] = useState<string[]>(
    []
  );
  const editorPaneRef = useRef<HTMLDivElement>(null);
  /** 画面テキスト用ポータルの基準（グリッド root）。ref だけだと初回描画後に再レンダーされないため state 併用 */
  const [editorSurfaceEl, setEditorSurfaceEl] = useState<HTMLDivElement | null>(
    null
  );
  const stageSectionRef = useRef<HTMLElement>(null);
  /** ワイド＋上部波形時のグリッド 1 行目（再生・波形ブロック）。高さドラッグの計測用 */
  const topDockSectionRef = useRef<HTMLElement | null>(null);
  /** ステージ床テキスト：ヘッダから入力→プレビュー→完了で設置 */
  const [floorTextPlaceSession, setFloorTextPlaceSession] =
    useState<FloorTextPlaceSession | null>(null);
  /** ステージ床の直接書き込み（テキスト／線）。上部バーと StageBoard で共有 */
  const [floorMarkupTool, setFloorMarkupTool] = useState<
    null | "text" | "line" | "erase"
  >(null);
  /** メンバー表示 SideSheet */
  const [memberRosterSheetOpen, setMemberRosterSheetOpen] = useState(false);
  /** wideEditorLayout 時: テキストパネルを右サイドシートに表示するか */
  const [floorTextSideSheetOpen, setFloorTextSideSheetOpen] = useState(false);
  /** 動線矢印オーバーレイ表示フラグ */
  const [showMotionArrows, setShowMotionArrows] = useState(false);
  /** テキストパネルのポータルターゲット DOM 要素 */
  const [textPanelPortalEl, setTextPanelPortalEl] = useState<HTMLDivElement | null>(null);

  const splitDragRef = useRef<{
    pointerId: number;
    startX: number;
    startW: number;
  } | null>(null);
  const topDockDragRef = useRef<{
    pointerId: number;
    startY: number;
    startH: number;
  } | null>(null);
  const rightPaneStackRef = useRef<HTMLDivElement>(null);
  /** 舞台設定の保存・復元に使う直前のフォーメーション id（キュー／アクティブ切替） */
  const lastFormationIdForStageRef = useRef<string | null>(null);

  const collabActive =
    collabParam &&
    !!me &&
    serverId != null &&
    projectId != null &&
    projectId !== "new";

  const yjsCollab = useYjsCollaboration(serverId, collabActive);

  const projectForHistoryRef = useRef<ChoreographyProjectJson | null>(null);
  const projectPagerRef = useRef<ChoreographyProjectJson | null>(null);

  const history = useEditorHistory({
    collabActive,
    yjsCollab,
    plainProject,
    setPlainProject,
    projectForHistoryRef,
  });
  onHistoryResetRef.current = history.clearHistory;

  const {
    cancelGestureHistory,
    beginGestureHistory,
    endGestureHistory,
    markHistorySkipNextPush,
    setProjectSafe,
    undo,
    redo,
    isUndoDisabled: stageUndoDisabledFromHistory,
    isRedoDisabled: stageRedoDisabledFromHistory,
  } = history;

  const project = collabActive ? yjsCollab.project : plainProject;
  const projectRef = useRef(project);
  projectRef.current = project;
  if (project) {
    projectForHistoryRef.current = project;
    projectPagerRef.current = project;
    projectSaveRef.current = project;
  }

  const projectAutoSaveSig = useMemo(
    () => (project ? JSON.stringify(project) : ""),
    [project]
  );

  useEditorAutoSave({
    enabled:
      !!me &&
      !choreoPublicView &&
      !collabActive &&
      project?.viewMode !== "view",
    projectRef,
    projectName,
    serverId,
    syncProjectToCloud,
    setSaving,
    projectChangeSig: projectAutoSaveSig,
  });


  const editorAudioSession = useEditorAudioSession({
    setProject: setProjectSafe,
    loggedIn: !!me,
    serverProjectId: serverId,
    audioAssetId: project?.audioAssetId ?? null,
    audioSupabasePath: project?.audioSupabasePath,
    flowLocalAudioKey: project?.flowLocalAudioKey ?? null,
    publicShareView: choreoPublicView,
  });
  const resyncViewerPlayback = editorAudioSession.resyncPlayback;
  const reloadViewerAudio = editorAudioSession.reloadRemoteAudio;

  /** 閲覧共有: 作品データ取得直後から音源を先読み（パート選択を待たない） */
  useEffect(() => {
    if (!choreoPublicView) return;
    const path = project?.audioSupabasePath;
    if (typeof path !== "string" || path.trim().length === 0) return;
    void resyncViewerPlayback({ force: true });
  }, [choreoPublicView, project?.audioSupabasePath, resyncViewerPlayback]);

  const {
    timelineRef,
    getWavePeaksSnapshot,
    restoreWavePeaks,
    getCurrentAudioBlobForFlowLibrary,
    openAudioImport,
  } = useTimelineMediaHandle({
    openAudioImport: editorAudioSession.openAudioImport,
  });

  /** キュー内容・区間・フォーメーション紐付けの変化検知（共同編集で project 参照だけが毎回変わるのを避ける） */
  const cueIdsSig =
    project?.cues
      .map((c) => `${c.id}:${c.tStartSec}:${c.tEndSec}:${c.formationId}`)
      .join("|") ?? "";

  const activeFormationId = project?.activeFormationId ?? null;

  const viewerLocalStorageKey = useMemo(
    () =>
      choreoPublicView && serverId != null
        ? `choreoViewerMemberV1:${serverId}`
        : null,
    [choreoPublicView, serverId]
  );

  const shareLinksUrls = useMemo(() => {
    if (serverId == null) return { collab: "", view: "" };
    if (typeof window === "undefined") return { collab: "", view: "" };
    return projectShareLinks(serverId, serverShareToken);
  }, [serverId, serverShareToken]);

  useEffect(() => {
    if (choreoPublicView) {
      setRightPaneCollapsed(true);
    }
  }, [choreoPublicView]);

  /** 閲覧共有: 前回パート・1人名簿は確認画面なしで即ステージへ */
  useLayoutEffect(() => {
    if (!choreoPublicView || !project || choreoStudentPick != null) return;
    const pick = resolveAutoStudentPick(project, viewerLocalStorageKey);
    if (!pick) return;
    setChoreoStudentPick(pick);
    if (viewerLocalStorageKey) {
      try {
        localStorage.setItem(viewerLocalStorageKey, JSON.stringify(pick));
      } catch {
        /* ignore */
      }
    }
  }, [choreoPublicView, project, viewerLocalStorageKey, choreoStudentPick]);

  /**
   * 上部波形ドック時は右列を狭くする（未ロード時は false で右列を広めに確保）。
   * ワイドでは名簿モードでも常に上部ドックを使う（`showTopWaveDock` と揃え Timeline をアンマウントしない）。
   */
  const showTopWaveDockForGrid = !!project && !stageZenFullscreen;
  /** 上部波形＋ステージ＋右列の「枠だけ固定」レイアウト（拡大モードではオフ） */
  const editorFixedWaveDockLayout =
    showTopWaveDockForGrid && !stageZenFullscreen;
  /** 右列の最小幅ぶんをステージ上限から控除（固定シェルでも分割ドラッグ可能にしたためレール最小を使う） */
  const minRightColForStageSplitPx = editorFixedWaveDockLayout
    ? RIGHT_TOOLS_RAIL_MIN_PX
    : showTopWaveDockForGrid
      ? RIGHT_TOOLS_RAIL_MAX_PX
      : TIMELINE_FULL_COL_MIN_PX;

  /** 名簿モード終了などで上部ドックが復帰したとき、手動リサイズ幅を捨てて波形エリアの高さを既定に戻す */
  useEffect(() => {
    if (prevShowTopWaveDockRef.current === false && showTopWaveDockForGrid) {
      setTopDockRowPx(null);
    }
    prevShowTopWaveDockRef.current = showTopWaveDockForGrid;
  }, [showTopWaveDockForGrid]);

  /** FFmpeg.wasm は音源取り込みボタン押下時のみロードする */

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`);
    const onChange = () => setWideEditorLayout(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!choreoPublicView) {
      setPublicViewTightHeight(false);
      return;
    }
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-height: 520px)");
    const read = () => setPublicViewTightHeight(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, [choreoPublicView]);

  useEffect(() => {
    if (!wideEditorLayout) {
      setTopDockRowPx(null);
    }
  }, [wideEditorLayout]);

  useEffect(() => {
    if (!wideEditorLayout) {
      setStageColumnPx(null);
      return;
    }
    const clamp = () => {
      setStageColumnPx((cur) => {
        if (cur == null) return cur;
        const grid = editorPaneRef.current;
        if (!grid) return cur;
        const maxW = readMaxStageWidthPx(grid, minRightColForStageSplitPx);
        const minW = STAGE_COL_MIN_PX;
        if (!Number.isFinite(maxW)) return cur;
        if (maxW < minW) return Math.max(minW, Math.round(maxW));
        return Math.min(maxW, Math.max(minW, cur));
      });
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [wideEditorLayout, minRightColForStageSplitPx, editorFixedWaveDockLayout]);

  useEffect(() => {
    if (!wideEditorLayout || typeof window === "undefined") return;
    persistEditorLayout({ stageColumnPx, topDockRowPx });
  }, [wideEditorLayout, stageColumnPx, topDockRowPx]);

  useEffect(() => {
    if (!wideEditorLayout && stageZenFullscreen) {
      setStageZenFullscreen(false);
    }
  }, [wideEditorLayout, stageZenFullscreen]);

  const onSplitPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!wideEditorLayout || e.button !== 0) return;
      const grid = editorPaneRef.current;
      const stageSec = stageSectionRef.current;
      if (!grid || !stageSec) return;
      e.preventDefault();
      const startW = stageSec.getBoundingClientRect().width;
      splitDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startW,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [wideEditorLayout]
  );

  const onSplitPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = splitDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const grid = editorPaneRef.current;
    if (!grid) return;
    let maxW = readMaxStageWidthPx(grid, minRightColForStageSplitPx);
    const minW = STAGE_COL_MIN_PX;
    if (!Number.isFinite(maxW) || maxW < minW) maxW = minW;
    const next = Math.round(
      Math.min(maxW, Math.max(minW, d.startW + (e.clientX - d.startX)))
    );
    setStageColumnPx(next);
  }, [minRightColForStageSplitPx]);

  const endSplitDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = splitDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    splitDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onSplitLostCapture = useCallback(() => {
    splitDragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onTopDockResizeDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const grid = editorPaneRef.current;
      if (!grid) return;
      e.preventDefault();
      const gridRect = grid.getBoundingClientRect();
      const topSection = topDockSectionRef.current;
      const startH = topDockRowPx != null
        ? topDockRowPx
        : topSection
          ? topSection.getBoundingClientRect().height
          : Math.max(160, gridRect.height * 0.28);
      topDockDragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startH,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    []
  );

  const onTopDockResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = topDockDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const grid = editorPaneRef.current;
      if (!grid) return;
      const gridRect = grid.getBoundingClientRect();
      const minH = wideEditorLayout ? TOP_DOCK_ROW_MIN_WIDE_PX : TOP_DOCK_ROW_MIN_PX;
      const maxH = Math.max(
        minH,
        Math.min(TOP_DOCK_ROW_MAX_PX, gridRect.height - 200)
      );
      const next = clampTopDockRowPx(
        Math.min(maxH, Math.max(minH, d.startH + (e.clientY - d.startY)))
      );
      setTopDockRowPx(next);
    },
    [wideEditorLayout]
  );

  const endTopDockResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = topDockDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      topDockDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    []
  );

  const onTopDockResizeDoubleClick = useCallback(() => {
    setTopDockRowPx(null);
  }, []);

  const rightPaneTopSectionStyle = useMemo(
    (): CSSProperties => ({
      flex: 1,
      minHeight: 0,
      minWidth: 0,
    }),
    []
  );

  const editorGridColumns = useMemo(() => {
    if (choreoPublicView) {
      if (!wideEditorLayout) return "1fr";
      return "1fr";
    }
    if (!wideEditorLayout) return "1fr";
    if (rightPaneCollapsed) return "1fr";
    // wideEditorLayout: グリッドは1列のみ、NeonIconPanelは外側flexで配置
    if (editorFixedWaveDockLayout) {
      return `minmax(${STAGE_COL_MIN_PX}px, 1fr)`;
    }
    const rightTrackFullTimeline = `minmax(${TIMELINE_FULL_COL_MIN_PX}px, 1fr)`;
    if (stageColumnPx == null) {
      if (showTopWaveDockForGrid) {
        return `minmax(${STAGE_COL_MIN_PX}px, 1fr)`;
      }
      return `minmax(${STAGE_COL_MIN_PX}px, 2fr) ${STAGE_RESIZER_PX}px ${rightTrackFullTimeline}`;
    }
    const rightTrack = showTopWaveDockForGrid
      ? `minmax(${STAGE_COL_MIN_PX}px, 1fr)`
      : rightTrackFullTimeline;
    return rightTrack;
  }, [
    wideEditorLayout,
    rightPaneCollapsed,
    stageColumnPx,
    showTopWaveDockForGrid,
    editorFixedWaveDockLayout,
    choreoPublicView,
  ]);

  const copyEditorShareLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
      setShareLinkCopiedFlash(true);
      shareCopiedTimerRef.current = setTimeout(() => {
        setShareLinkCopiedFlash(false);
        shareCopiedTimerRef.current = null;
      }, 2200);
    } catch {
      try {
        window.prompt("次の URL をコピーしてください", url);
      } catch {
        /** ignore */
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
    };
  }, []);

  const interpolatedDancers = useMemo(() => {
    if (!project || project.cues.length === 0) return null;
    return dancersAtTime(
      currentTime,
      project.cues,
      project.formations,
      project.activeFormationId
    );
  }, [project, currentTime]);

  const interpolatedSetPieces = useMemo(() => {
    if (!project || project.cues.length === 0) return null;
    return setPiecesAtTime(
      currentTime,
      project.cues,
      project.formations,
      project.activeFormationId
    );
  }, [project, currentTime]);

  const interpolatedFloorMarkup = useMemo(() => {
    if (!project || project.cues.length === 0) return null;
    return floorMarkupAtTime(
      currentTime,
      project.cues,
      project.formations,
      project.activeFormationId
    );
  }, [project, currentTime]);

  const formationById = useMemo(() => {
    if (!project) return new Map<string, Formation>();
    return new Map(project.formations.map((f) => [f.id, f] as const));
  }, [project]);

  const cueById = useMemo(() => {
    if (!project) return new Map<string, Cue>();
    return new Map(project.cues.map((c) => [c.id, c] as const));
  }, [project]);

  const selectedCue = useMemo(
    () => (selectedCueId ? cueById.get(selectedCueId) ?? null : null),
    [selectedCueId, cueById]
  );

  /** 全キューを時刻順に並べたもの（個人軌道エディタ等で prevCue 取得に使用） */
  const sortedCuesForEditor = useMemo(
    () => (project ? sortCuesByStart(project.cues) : []),
    [project]
  );

  /**
   * 舞台スナップショット同期は「どのフォーメーションを見ているか」が変わったときだけ走らせる。
   * `project` 参照を依存に含めない（共同編集で毎同期ごとに新オブジェクトになるのを避ける）。
   */
  const navFormationId = useMemo(() => {
    if (selectedCueId && cueIdsSig.length > 0) {
      const prefix = `${selectedCueId}:`;
      for (const part of cueIdsSig.split("|")) {
        if (!part.startsWith(prefix)) continue;
        const rest = part.slice(prefix.length);
        const bits = rest.split(":");
        if (bits.length >= 3) {
          const fid = bits[bits.length - 1];
          if (fid) return fid;
        }
      }
    }
    return activeFormationId;
  }, [selectedCueId, activeFormationId, cueIdsSig]);

  useEffect(() => {
    lastFormationIdForStageRef.current = null;
  }, [projectId]);

  /**
   * フォーメーション（ページ）を切り替えたとき、直前ページの舞台設定を `stageSnapshot` に保存し、
   * 次のページに保存済みがあればプロジェクトの舞台へ復元する。
   */
  useEffect(() => {
    const p = projectRef.current;
    if (!p || !navFormationId) return;
    const nextId = navFormationId;
    const prevId = lastFormationIdForStageRef.current;
    if (prevId === nextId) return;

    if (prevId !== null) {
      setProjectSafe((cur) => {
        const snap = captureStageSnapshot(cur);
        const formations1 = cur.formations.map((f) =>
          f.id === prevId ? { ...f, stageSnapshot: snap } : f
        );
        const base: ChoreographyProjectJson = { ...cur, formations: formations1 };
        const nf = formations1.find((f) => f.id === nextId);
        return nf?.stageSnapshot
          ? mergeStageSnapshotIntoProject(base, nf.stageSnapshot)
          : base;
      });
    } else {
      const nf = p.formations.find((f) => f.id === nextId);
      if (nf?.stageSnapshot) {
        setProjectSafe((cur) => mergeStageSnapshotIntoProject(cur, nf.stageSnapshot));
      }
    }
    lastFormationIdForStageRef.current = nextId;
  }, [navFormationId, setProjectSafe]);

  const cuesSortedForStageJump = useMemo(
    () => (project ? sortCuesByStart(project.cues) : []),
    [project, cueIdsSig]
  );

  /** ステージ右上ページャ: 名簿があるとき slot 0 = 名簿、1.. = キュー順 */
  const jumpToPagerSlot = useCallback(
    (slotIdx: number) => {
      const p = projectPagerRef.current;
      if (!p || p.viewMode === "view") return;
      const cuesSorted = sortCuesByStart(p.cues);
      const hasRoster = p.crews.some((c) => c.members.length > 0);
      if (!hasRoster) {
        const cue = cuesSorted[slotIdx];
        if (!cue) return;
        setSelectedCueIds([cue.id]);
        setProjectSafe((prev) => ({
          ...prev,
          activeFormationId: cue.formationId,
        }));
        pauseAndSeekPlaybackToSec({
          tRaw: cue.tStartSec,
          durationSec: usePlaybackUiStore.getState().durationSec,
          trimStartSec: p.trimStartSec,
          trimEndSec: p.trimEndSec,
        });
        return;
      }
      if (slotIdx === 0) {
        setProjectSafe((prev) => ({
          ...prev,
          rosterHidesTimeline: true,
          rosterStripCollapsed: false,
        }));
        return;
      }
      const cue = cuesSorted[slotIdx - 1];
      if (!cue) return;
      setSelectedCueIds([cue.id]);
      setProjectSafe((prev) => ({
        ...prev,
        rosterHidesTimeline: false,
        activeFormationId: cue.formationId,
      }));
      pauseAndSeekPlaybackToSec({
        tRaw: cue.tStartSec,
        durationSec: usePlaybackUiStore.getState().durationSec,
        trimStartSec: p.trimStartSec,
        trimEndSec: p.trimEndSec,
      });
    },
    [setProjectSafe]
  );

  /** 名簿「決定」直後に最新の jumpToPagerSlot で先頭キューへ飛ばす */
  const jumpToPagerSlotRef = useRef(jumpToPagerSlot);
  jumpToPagerSlotRef.current = jumpToPagerSlot;
  const onRosterConfirmReturnToTimeline = useCallback(() => {
    queueMicrotask(() => {
      jumpToPagerSlotRef.current(1);
    });
  }, []);

  useEffect(() => {
    if (!project) return;
    if (project.cues.length === 0) {
      setSelectedCueIds((ids) => (ids.length === 0 ? ids : []));
      return;
    }
    setSelectedCueIds((ids) => {
      const valid = ids.filter((id) => cueById.has(id));
      if (valid.length > 0) {
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const id of valid) {
          if (seen.has(id)) continue;
          seen.add(id);
          deduped.push(id);
        }
        if (
          deduped.length === ids.length &&
          deduped.every((id, i) => id === ids[i])
        ) {
          return ids;
        }
        return deduped;
      }
      const first = cuesSortedForStageJump[0]?.id;
      const next = first ? [first] : [];
      if (
        next.length === ids.length &&
        next.every((id, i) => id === ids[i])
      ) {
        return ids;
      }
      return next;
    });
  }, [project, cueIdsSig, cueById, cuesSortedForStageJump]);

  /** 複数キューが同一フォーメーションを共有している旧データを、編集時に自動分離 */
  const sharedFormationSplitSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!project || project.cues.length < 2) return;
    const counts = new Map<string, number>();
    for (const c of project.cues) {
      counts.set(c.formationId, (counts.get(c.formationId) ?? 0) + 1);
    }
    const hasShared = [...counts.values()].some((n) => n > 1);
    if (!hasShared) return;
    const sig = project.cues.map((c) => `${c.id}:${c.formationId}`).join("|");
    if (sharedFormationSplitSigRef.current === sig) return;
    sharedFormationSplitSigRef.current = sig;
    markHistorySkipNextPush();
    setProjectSafe((p) => splitSharedCueFormations(p));
  }, [project, cueIdsSig, setProjectSafe, markHistorySkipNextPush]);

  /** キュー選択と activeFormationId を同期（舞台スナップショット・表示のずれ防止） */
  useEffect(() => {
    if (!project || !selectedCueId) return;
    const cue = cueById.get(selectedCueId);
    if (!cue || project.activeFormationId === cue.formationId) return;
    markHistorySkipNextPush();
    setProjectSafe((p) => {
      if (p.activeFormationId === cue.formationId) return p;
      return { ...p, activeFormationId: cue.formationId };
    });
  }, [project, selectedCueId, cueById, setProjectSafe, markHistorySkipNextPush]);

  const playbackActiveCueFollowRef = useRef<((cueId: string) => void) | null>(
    null
  );
  playbackActiveCueFollowRef.current = (cueId) => {
    setSelectedCueIds((ids) =>
      ids.length === 1 && ids[0] === cueId ? ids : [cueId]
    );
  };

  /** 再生中のみ補間表示 */
  const playbackDancersForStage = !isPlaying ? null : interpolatedDancers;

  const playbackSetPiecesForStage = !isPlaying ? null : interpolatedSetPieces;

  const playbackFloorMarkupForStage = !isPlaying ? null : interpolatedFloorMarkup;

  const browseFormationDancers = useMemo(() => {
    if (!project || isPlaying) return null;
    if (stagePreviewDancers && stagePreviewDancers.length > 0) return null;
    if (selectedCue) {
      const f = formationById.get(selectedCue.formationId);
      return f?.dancers ?? null;
    }
    if (project.cues.length > 0) {
      return dancersAtTime(
        currentTime,
        project.cues,
        project.formations,
        project.activeFormationId
      );
    }
    const f = formationById.get(project.activeFormationId);
    return f?.dancers ?? null;
  }, [project, isPlaying, stagePreviewDancers, selectedCue, currentTime, formationById]);

  const browseSetPieces = useMemo(() => {
    if (!project || isPlaying) return null;
    if (stagePreviewDancers && stagePreviewDancers.length > 0) return null;
    if (selectedCue) {
      const f = formationById.get(selectedCue.formationId);
      return f?.setPieces ?? null;
    }
    if (project.cues.length > 0) {
      return setPiecesAtTime(
        currentTime,
        project.cues,
        project.formations,
        project.activeFormationId
      );
    }
    const f = formationById.get(project.activeFormationId);
    return f?.setPieces ?? null;
  }, [project, isPlaying, stagePreviewDancers, selectedCue, currentTime, formationById]);

  const browseFloorMarkup = useMemo(() => {
    if (!project || isPlaying) return null;
    if (stagePreviewDancers && stagePreviewDancers.length > 0) return null;
    if (selectedCue) {
      const f = formationById.get(selectedCue.formationId);
      return f?.floorMarkup ?? null;
    }
    if (project.cues.length > 0) {
      return floorMarkupAtTime(
        currentTime,
        project.cues,
        project.formations,
        project.activeFormationId
      );
    }
    const f = formationById.get(project.activeFormationId);
    return f?.floorMarkup ?? null;
  }, [project, isPlaying, stagePreviewDancers, selectedCue, currentTime, formationById]);

  const { playbackAudioElement } = useEditorPlaybackSync({
    projectRef,
    setProjectSafe,
    projectId,
    shareToken: shareTokenParam,
    choreoPublicView,
    wideEditorLayout,
    stageZenFullscreen,
    playbackRateSig: project?.playbackRate,
    onPlaybackActiveCueChangeRef: playbackActiveCueFollowRef,
  });

  const onUpdateGlobalFloorMarkup = useCallback(
    (updater: (prev: StageFloorMarkup[]) => StageFloorMarkup[]) => {
      setProjectSafe((p) => ({
        ...p,
        globalFloorMarkup: updater(p.globalFloorMarkup ?? []),
      }));
    },
    [setProjectSafe]
  );

  const applyStageAreaSettingsDraft = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const d = stageAreaSettingsDraftRef.current;
    const gridWidthCm = clampGridSpacingCm(parseGridSpacingInput(gridWidthCmInput));
    const gridDepthCm = clampGridSpacingCm(parseGridSpacingInput(gridDepthCmInput));
    const w = parseMeterCmDraftToMm(d.width);
    const depthMm = parseMeterCmDraftToMm(d.depth);
    const s = parseMeterCmDraftToMm(d.side);
    const b = parseMeterCmDraftToMm(d.back);
    const gRaw = parseMeterCmDraftToMm(d.guide);
    const g = clampGuideIntervalToWidth(w, gRaw);
    const gw = gridWidthCm * 10;
    const gd = gridDepthCm * 10;
    setStageAreaSettingsDraft((prev) => ({
      ...prev,
      gridWidthCm,
      gridDepthCm,
    }));
    setGridWidthCmInput(String(gridWidthCm));
    setGridDepthCmInput(String(gridDepthCm));
    setProjectSafe((p) => ({
      ...p,
      audienceEdge: d.audienceEdge,
      stageWidthMm: w,
      stageDepthMm: depthMm,
      sideStageMm: s,
      backStageMm: b,
      centerFieldGuideIntervalMm: g,
      snapGrid: d.stageGridLinesVerticalEnabled || d.stageGridLinesHorizontalEnabled,
      gridStep: d.gridStep,
      stageGridLinesVerticalEnabled: d.stageGridLinesVerticalEnabled,
      stageGridLinesHorizontalEnabled: d.stageGridLinesHorizontalEnabled,
      stageGridLinesEnabled:
        d.stageGridLinesVerticalEnabled || d.stageGridLinesHorizontalEnabled,
      stageGridSpacingWidthMm: gw,
      stageGridLineSpacingMm: gw,
      stageGridSpacingDepthMm: gd,
      dancerLabelPosition: d.dancerLabelPosition,
    }));
  }, [project, setProjectSafe, gridWidthCmInput, gridDepthCmInput]);

  const stageAreaDraftHasMainFloor = useMemo(() => {
    const w = parseMeterCmDraftToMm(stageAreaSettingsDraft.width);
    const d = parseMeterCmDraftToMm(stageAreaSettingsDraft.depth);
    return w != null && w > 0 && d != null && d > 0;
  }, [stageAreaSettingsDraft.width, stageAreaSettingsDraft.depth]);

  const onStageGridCmInput = useCallback((axis: "width" | "depth", raw: string) => {
    if (axis === "width") setGridWidthCmInput(raw);
    else setGridDepthCmInput(raw);
  }, []);

  const commitStageGridCmInput = useCallback(
    (axis: "width" | "depth") => {
      if (axis === "width") {
        const next = clampGridSpacingCm(parseGridSpacingInput(gridWidthCmInput));
        setStageAreaSettingsDraft((d) => ({ ...d, gridWidthCm: next }));
        setGridWidthCmInput(String(next));
        return;
      }
      const next = clampGridSpacingCm(parseGridSpacingInput(gridDepthCmInput));
      setStageAreaSettingsDraft((d) => ({ ...d, gridDepthCm: next }));
      setGridDepthCmInput(String(next));
    },
    [gridDepthCmInput, gridWidthCmInput]
  );

  const nudgeStageGridCm = useCallback((axis: "width" | "depth", delta: number) => {
    setStageAreaSettingsDraft((d) => {
      const base = axis === "width" ? d.gridWidthCm : d.gridDepthCm;
      const next = clampGridSpacingCm(base + delta);
      if (axis === "width") setGridWidthCmInput(String(next));
      else setGridDepthCmInput(String(next));
      return axis === "width" ? { ...d, gridWidthCm: next } : { ...d, gridDepthCm: next };
    });
  }, []);

  const gridNudgeTimeoutRef = useRef<number | null>(null);
  const gridNudgeIntervalRef = useRef<number | null>(null);
  const gridNudgeDidRepeatRef = useRef(false);

  const stopGridNudgeRepeat = useCallback(() => {
    if (gridNudgeTimeoutRef.current != null) {
      window.clearTimeout(gridNudgeTimeoutRef.current);
      gridNudgeTimeoutRef.current = null;
    }
    if (gridNudgeIntervalRef.current != null) {
      window.clearInterval(gridNudgeIntervalRef.current);
      gridNudgeIntervalRef.current = null;
    }
  }, []);

  const startGridNudgeRepeat = useCallback(
    (axis: "width" | "depth", delta: number) => {
      stopGridNudgeRepeat();
      gridNudgeDidRepeatRef.current = false;
      gridNudgeTimeoutRef.current = window.setTimeout(() => {
        gridNudgeDidRepeatRef.current = true;
        nudgeStageGridCm(axis, delta);
        gridNudgeIntervalRef.current = window.setInterval(() => {
          nudgeStageGridCm(axis, delta);
        }, 70);
      }, 260);
    },
    [nudgeStageGridCm, stopGridNudgeRepeat]
  );

  useEffect(() => stopGridNudgeRepeat, [stopGridNudgeRepeat]);
  useEffect(() => {
    setGridWidthCmInput(String(stageAreaSettingsDraft.gridWidthCm));
    setGridDepthCmInput(String(stageAreaSettingsDraft.gridDepthCm));
  }, [stageAreaSettingsDraft.gridWidthCm, stageAreaSettingsDraft.gridDepthCm]);

  /** 舞台設定を開いたときに現在のプロジェクト値をドラフトへ反映 */
  useEffect(() => {
    if (!project) {
      prevStageAreaOpenRef.current = false;
      return;
    }
    if (stageAreaSettingsOpen && !prevStageAreaOpenRef.current) {
      setStageAreaSettingsDraft(projectToStageAreaDraft(project));
      setStageAreaPresetList(listStagePresets());
      setStageAreaPresetSelectNonce((n) => n + 1);
    }
    prevStageAreaOpenRef.current = stageAreaSettingsOpen;
  }, [stageAreaSettingsOpen, project]);

  /**
   * 舞台設定表示中はドラフト（寸法・グリッド等）を StageBoard に反映し、
   * 決定前でもステージ上でプレビューできるようにする。
   */
  const projectForStageBoard = useMemo((): ChoreographyProjectJson | null => {
    if (!project) return null;
    if (!stageAreaSettingsOpen) return project;
    const d = stageAreaSettingsDraft;
    const w = parseMeterCmDraftToMm(d.width);
    const depthMm = parseMeterCmDraftToMm(d.depth);
    const s = parseMeterCmDraftToMm(d.side);
    const b = parseMeterCmDraftToMm(d.back);
    const gRaw = parseMeterCmDraftToMm(d.guide);
    const g = clampGuideIntervalToWidth(w, gRaw);
    const gridWidthCm = clampGridSpacingCm(parseGridSpacingInput(gridWidthCmInput));
    const gridDepthCm = clampGridSpacingCm(parseGridSpacingInput(gridDepthCmInput));
    const gw = gridWidthCm * 10;
    const gd = gridDepthCm * 10;
    return {
      ...project,
      audienceEdge: d.audienceEdge,
      stageWidthMm: w,
      stageDepthMm: depthMm,
      sideStageMm: s,
      backStageMm: b,
      centerFieldGuideIntervalMm: g,
      snapGrid: d.stageGridLinesVerticalEnabled || d.stageGridLinesHorizontalEnabled,
      gridStep: d.gridStep,
      stageGridLinesVerticalEnabled: d.stageGridLinesVerticalEnabled,
      stageGridLinesHorizontalEnabled: d.stageGridLinesHorizontalEnabled,
      stageGridLinesEnabled:
        d.stageGridLinesVerticalEnabled || d.stageGridLinesHorizontalEnabled,
      stageGridSpacingWidthMm: gw,
      stageGridLineSpacingMm: gw,
      stageGridSpacingDepthMm: gd,
      dancerLabelPosition: d.dancerLabelPosition,
    };
  }, [
    project,
    stageAreaSettingsOpen,
    stageAreaSettingsDraft,
    gridWidthCmInput,
    gridDepthCmInput,
  ]);

  useEffect(() => {
    if (!wideEditorLayout) setFloorMarkupTool(null);
  }, [wideEditorLayout]);

  useEffect(() => {
    if (stageView !== "2d") setFloorMarkupTool(null);
  }, [stageView]);

  const dancersFor3d = useMemo(() => {
    if (!project) return [];
    if (stagePreviewDancers?.length) return stagePreviewDancers;
    if (interpolatedDancers && isPlaying) return interpolatedDancers;
    if (browseFormationDancers?.length) return browseFormationDancers;
    const f = formationById.get(project.activeFormationId);
    return f?.dancers ?? [];
  }, [
    project,
    interpolatedDancers,
    isPlaying,
    stagePreviewDancers,
    browseFormationDancers,
    formationById,
  ]);

  const onFloorTextPlaceSessionChange = useCallback((next: FloorTextPlaceSession) => {
    setFloorTextPlaceSession(next);
  }, []);

  const commitFloorTextPlace = useCallback((): boolean => {
    if (!project || project.viewMode === "view") return false;
    if (project.cues.length > 0 && !selectedCueId) return false;
    if (!floorTextPlaceSession) return false;
    const text = floorTextPlaceSession.body.trim().slice(0, 400);
    if (!text) {
      return false;
    }
    const formationId = selectedCue?.formationId ?? project.activeFormationId;
    const fs = Math.round(
      Math.min(56, Math.max(8, floorTextPlaceSession.fontSizePx))
    );
    const fw =
      Math.round(Math.min(900, Math.max(300, floorTextPlaceSession.fontWeight)) / 50) *
      50;
    const rawCol = floorTextPlaceSession.color?.trim();
    const color =
      rawCol && /^#[0-9a-fA-F]{6}$/i.test(rawCol)
        ? rawCol.toLowerCase()
        : "#fef08a";
    const fontFamily =
      (floorTextPlaceSession.fontFamily ?? "").trim() ||
      "system-ui, -apple-system, 'Segoe UI', sans-serif";
    const sc = floorTextPlaceSession.scale;
    const scale =
      typeof sc === "number" && Number.isFinite(sc) && sc > 0
        ? Math.min(8, Math.max(0.2, sc))
        : 1;
    const editTargetId = floorTextPlaceSession.editTargetId;
    const updatedFields = {
      text,
      color,
      fontFamily,
      scale,
      fontSizePx: fs,
      fontWeight: fw,
      xPct: round2Pct(floorTextPlaceSession.xPct),
      yPct: round2Pct(floorTextPlaceSession.yPct),
    };

    if (editTargetId) {
      // ── 既存テキストの更新 ──
      if (floorTextPlaceSession.scope === "global") {
        setProjectSafe((p) => ({
          ...p,
          globalFloorMarkup: (p.globalFloorMarkup ?? []).map((x) =>
            x.id === editTargetId && x.kind === "text"
              ? { ...x, ...updatedFields }
              : x
          ),
        }));
      } else {
        setProjectSafe((p) => ({
          ...p,
          formations: p.formations.map((f) => ({
            ...f,
            floorMarkup: (f.floorMarkup ?? []).map((x) =>
              x.id === editTargetId && x.kind === "text"
                ? { ...x, ...updatedFields }
                : x
            ),
          })),
        }));
      }
    } else {
      // ── 新規配置 ──
      const newMarkup = {
        kind: "text" as const,
        id: crypto.randomUUID(),
        layer: "stage" as const,
        ...updatedFields,
      };
      if (floorTextPlaceSession.scope === "global") {
        setProjectSafe((p) => ({
          ...p,
          globalFloorMarkup: [...(p.globalFloorMarkup ?? []), newMarkup],
        }));
      } else {
        setProjectSafe((p) => ({
          ...p,
          formations: p.formations.map((f) => {
            if (f.id !== formationId) return f;
            return { ...f, floorMarkup: [...(f.floorMarkup ?? []), newMarkup] };
          }),
        }));
      }
    }
    setFloorTextPlaceSession(null);
    return true;
  }, [
    project,
    floorTextPlaceSession,
    selectedCueId,
    selectedCue,
    setProjectSafe,
  ]);

  useEffect(() => {
    if (stageView === "3d") setFloorTextPlaceSession(null);
  }, [stageView]);

  // (removed: floorMarkupTool依存のサイドシート閉じuseEffect → floorMarkupToolは使わなくなった)

  /**
   * ＋ダンサーボタンで 1 人ずつ追加。
   * 既存の立ち位置・表示名は一切変えず、追加 1 人だけを
   * 既存印から離れた空きに置く（ピラミッド全体の並べ替えはしない）。
   */
  const addDancerFromStageToolbar = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const fid =
      selectedCue?.formationId ??
      project.formations.find((x) => x.id === project.activeFormationId)?.id ??
      project.formations[0]?.id;
    if (!fid) return;
    setProjectSafe((p) => {
      const f = p.formations.find((x) => x.id === fid);
      if (!f) return p;
      const n = f.dancers.length;
      const { xPct, yPct } = pickSpotForAppendedDancer(f.dancers);
      const newDancer = {
        id: crypto.randomUUID(),
        label: String(n + 1),
        xPct,
        yPct,
        colorIndex: modDancerColorIndex(n),
      };
      return {
        ...p,
        formations: p.formations.map((fm) =>
          fm.id === fid
            ? {
                ...fm,
                dancers: [...f.dancers.map((d) => ({ ...d })), newDancer],
                confirmedDancerCount: n + 1,
              }
            : fm
        ),
      };
    });
  }, [project, selectedCue, setProjectSafe]);

  /**
   * ステージ上部の「名簿取り込み」ボタンから名簿ファイルを選んで、
   * 新しい名簿（Crew）として `project.crews` に追加する。
   *
   * 対応形式: CSV / TSV / TXT / XLSX / XLS / XLSM / ODS / HTML / PDF
   * - 1 列目に名前が入っていれば見出しなしでも取り込める。
   * - XLSX や PDF など重いライブラリは選択時に動的読み込みされる。
   * - PDF はレイアウト依存で結果が崩れることがあるため、取り込み後に確認を促す。
   */
  const importCrewCsvFromStageToolbar = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ROSTER_FILE_ACCEPT;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const result = await parseRosterFile(f);
        const defaultName =
          result.baseName || `名簿 ${(project.crews?.length ?? 0) + 1}`;
        setRosterImportNameMode("full");
        setRosterImportExtraNames([]);
        setRosterImportDraft({
          rows: result.rows,
          baseName: defaultName,
          kind: result.kind,
          notice: result.notice,
        });
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : "ファイルの読み込みに失敗しました"
        );
      }
    };
    input.click();
  }, [project, setProjectSafe]);

  const openSetPiecePicker = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const fid =
      selectedCue?.formationId ??
      project.formations.find((x) => x.id === project.activeFormationId)?.id ??
      project.formations[0]?.id;
    if (!fid) return;
    setSetPiecePickerOpen(true);
  }, [project, selectedCue]);

  /**
   * 「立ち位置保存」ボタン押下 → 管理ダイアログを開く。
   */
  const saveStageToFormationBox = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    setFormationBoxManagerOpen(true);
  }, [project]);

  const confirmAddSetPiece = useCallback(
    (opts: SetPiecePickerSubmit) => {
      if (!project || project.viewMode === "view") return;
      const fid =
        selectedCue?.formationId ??
        project.formations.find((x) => x.id === project.activeFormationId)?.id ??
        project.formations[0]?.id;
      if (!fid) return;
      const pieceId = crypto.randomUUID();
      const kind: SetPieceKind = opts.kind;
      const onScreen = Boolean(opts.placeOnEditorSurface);
      const wPct = onScreen
        ? kind === "ellipse"
          ? 12
          : 14
        : kind === "ellipse"
          ? 20
          : 24;
      const hPct = onScreen
        ? kind === "ellipse"
          ? 12
          : 11
        : kind === "ellipse"
          ? 20
          : 18;
      const xPct = onScreen ? 8 : 38;
      const yPct = onScreen ? 10 : 32;
      setProjectSafe((p) => ({
        ...p,
        formations: p.formations.map((fm) =>
          fm.id === fid
            ? {
                ...fm,
                setPieces: [
                  ...(fm.setPieces ?? []),
                  {
                    id: pieceId,
                    kind,
                    fillColor: opts.fillColor,
                    label: `大道具${(fm.setPieces?.length ?? 0) + 1}`,
                    xPct,
                    yPct,
                    wPct,
                    hPct,
                    ...(onScreen ? { layer: "screen" as const } : {}),
                    interpolateInGaps: false,
                  },
                ],
              }
            : fm
        ),
      }));
      setSetPiecePickerOpen(false);
    },
    [project, selectedCue, setProjectSafe]
  );

  const handleAddCueCreated = useCallback(
    (cueId: string, startSec: number) => {
      setSelectedCueIds([cueId]);
      if (typeof startSec === "number" && Number.isFinite(startSec)) {
        const proj = projectRef.current;
        pauseAndSeekPlaybackToSec({
          tRaw: startSec,
          durationSec: usePlaybackUiStore.getState().durationSec,
          trimStartSec: proj?.trimStartSec ?? 0,
          trimEndSec: proj?.trimEndSec ?? null,
        });
      }
    },
    []
  );

  const exportDialogEl = useMemo(
    () =>
      project ? (
        <ExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          project={project}
          projectName={projectName}
          stage2dVisible={stageView === "2d"}
        />
      ) : null,
    [project, exportDialogOpen, projectName, stageView]
  );

  const flowLibraryDialogEl = useMemo(
    () =>
      project ? (
        <FlowLibraryDialog
          open={flowLibraryOpen}
          onClose={() => setFlowLibraryOpen(false)}
          serverId={serverId}
          serverShareToken={serverShareToken}
          syncProjectToCloud={me ? syncProjectToCloud : undefined}
          project={project}
          setProject={setProjectSafe}
          audioDurationSec={duration}
          getWavePeaks={getWavePeaksSnapshot}
          onRestoreWaveform={restoreWavePeaks}
          getAudioBlobForFlowLibrary={getCurrentAudioBlobForFlowLibrary}
        />
      ) : null,
    [
      project,
      flowLibraryOpen,
      setProjectSafe,
      duration,
      serverId,
      serverShareToken,
      me,
      syncProjectToCloud,
      getWavePeaksSnapshot,
      restoreWavePeaks,
      getCurrentAudioBlobForFlowLibrary,
    ]
  );

  /** 立ち位置管理ダイアログに渡す現在のダンサー */
  const formationBoxCurrentDancers = useMemo((): DancerSpot[] => {
    if (!project) return [];
    const fid =
      selectedCue?.formationId ??
      project.formations.find((x) => x.id === project.activeFormationId)?.id ??
      project.formations[0]?.id;
    if (!fid) return [];
    return project.formations.find((x) => x.id === fid)?.dancers ?? [];
  }, [project, selectedCue]);

  const formationBoxManagerDialogEl = (
    <FormationBoxManagerDialog
      open={formationBoxManagerOpen}
      onClose={() => setFormationBoxManagerOpen(false)}
      currentDancers={formationBoxCurrentDancers}
    />
  );

  const formationPresetPickerSheetEl = useMemo(
    () =>
      project ? (
        <FormationPresetPickerSheet
          open={formationPresetPickerOpen}
          onClose={() => setFormationPresetPickerOpen(false)}
          project={project}
          setProject={setProjectSafe}
          selectedCueId={selectedCueId}
          onStagePreviewChange={setStagePreviewDancers}
        />
      ) : null,
    [
      project,
      formationPresetPickerOpen,
      setProjectSafe,
      selectedCueId,
    ]
  );

  const addCueDialogEl = useMemo(
    () =>
      project ? (
        <AddCueWithFormationDialog
          open={addCueDialogOpen}
          onClose={() => setAddCueDialogOpen(false)}
          project={project}
          setProject={setProjectSafe}
          currentTimeSec={currentTime}
          durationSec={duration}
          selectedCueId={selectedCueId}
          onStagePreviewChange={setStagePreviewDancers}
          onImportRoster={importCrewCsvFromStageToolbar}
          onCueCreated={handleAddCueCreated}
        />
      ) : null,
    [
      project,
      addCueDialogOpen,
      setProjectSafe,
      currentTime,
      duration,
      selectedCueId,
      importCrewCsvFromStageToolbar,
      handleAddCueCreated,
    ]
  );

  const rosterImportSheetEl = useMemo(
    () =>
      project && rosterImportDraft ? (
        <EditorSideSheet
          open
          zIndex={60}
          width="min(320px, 90vw)"
          onClose={() => {
            setRosterImportDraft(null);
            setRosterImportExtraNames([]);
          }}
          ariaLabelledBy="roster-import-dialog-title"
        >
          <div style={{ padding: "14px 16px" }}>
            <div
              id="roster-import-dialog-title"
              style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}
            >
              名簿を取り込みます
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "11px", color: "#94a3b8", lineHeight: 1.45, wordBreak: "break-all" }}>
              ステージ表示は最大8文字。同名の場合は苗字の頭1文字を自動付加。「出欠」列があれば参加行のみ取込。フリガナ列があれば下の設定で表示名を選択できます。
            </p>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
              表示名の取り込み方
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              <input
                type="radio"
                name="roster-import-name-mode"
                checked={rosterImportNameMode === "full"}
                onChange={() => setRosterImportNameMode("full")}
              />
              <span><strong>フルネーム</strong><span style={{ color: "#64748b", marginLeft: 4 }}>（姓＋名）</span></span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              <input
                type="radio"
                name="roster-import-name-mode"
                checked={rosterImportNameMode === "family_only"}
                onChange={() => setRosterImportNameMode("family_only")}
              />
              <span><strong>苗字だけ</strong><span style={{ color: "#64748b", marginLeft: 4 }}>（姓のみ）</span></span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "12px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              <input
                type="radio"
                name="roster-import-name-mode"
                checked={rosterImportNameMode === "given_only"}
                onChange={() => setRosterImportNameMode("given_only")}
              />
              <span><strong>名前だけ</strong><span style={{ color: "#64748b", marginLeft: 4 }}>（名のみ）</span></span>
            </label>
            <div
              style={{
                marginBottom: "12px",
                paddingTop: "8px",
                borderTop: "1px solid #334155",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                メンバーを追加（任意）
              </div>
              {rosterImportExtraNames.map((extraName, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "6px",
                  }}
                >
                  <input
                    type="text"
                    value={extraName}
                    placeholder="表示名"
                    maxLength={120}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRosterImportExtraNames((prev) =>
                        prev.map((x, j) => (j === idx ? v : x))
                      );
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #334155",
                      background: "#020617",
                      color: "#e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      flexShrink: 0,
                      fontSize: "11px",
                      padding: "6px 8px",
                    }}
                    onClick={() =>
                      setRosterImportExtraNames((prev) =>
                        prev.filter((_, j) => j !== idx)
                      )
                    }
                  >
                    削除
                  </button>
                </div>
              ))}
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  fontSize: "12px",
                  padding: "6px 10px",
                  borderColor: "#0369a1",
                  color: "#7dd3fc",
                }}
                onClick={() =>
                  setRosterImportExtraNames((prev) => [...prev, ""])
                }
              >
                ＋メンバーを追加
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => {
                  setRosterImportDraft(null);
                  setRosterImportExtraNames([]);
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  borderColor: "#0284c7",
                  background: "#0ea5e9",
                  color: "#0b1220",
                  fontWeight: 600,
                }}
                onClick={() => {
                  if (!project) return;
                  const d = rosterImportDraft;
                  const extraRows = rosterImportExtraNames
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                    .map((label) => [label] as string[]);
                  const mergedRows = [...d.rows, ...extraRows];
                  let att = { excludedRows: 0, hadAttendanceColumn: false };
                  const crew = buildCrewFromRows(d.baseName, mergedRows, {
                    nameMode: rosterImportNameMode,
                    onAttendanceFiltered: (info) => {
                      att = info;
                    },
                  });
                  if (crew.members.length === 0) {
                    let msg =
                      `${labelForKind(d.kind)} から名前らしき列を見つけられませんでした。\n` +
                      "1 列目に名前を入れるか、見出し行に「名前」「姓」「名」「label」「name」などを含めてください。";
                    if (att.hadAttendanceColumn) {
                      msg +=
                        "\n\n出欠列は検出されましたが、参加（○・参加 など）と判定できる行がありませんでした。";
                    }
                    window.alert(msg);
                    return;
                  }
                  setProjectSafe((p) => {
                    const sorted = sortCuesByStart(p.cues);
                    const firstCue = sorted[0];
                    const nextCues =
                      firstCue &&
                      firstCue.formationId !== p.activeFormationId
                        ? p.cues.map((c) =>
                            c.id === firstCue.id
                              ? { ...c, formationId: p.activeFormationId }
                              : c
                          )
                        : p.cues;
                    return {
                      ...p,
                      crews: [...p.crews, crew],
                      cues: nextCues,
                      rosterStripCollapsed: false,
                      /**
                       * 名簿取り込み直後はタイムライン全面表示のままにし、
                       * 波形用 TimelinePanel をアンマウントしない（ワイドでは常に上部ドック）。
                       * 名簿一覧は「メンバーを表示」またはページャで切り替え可能。
                       */
                      rosterHidesTimeline: false,
                      dancerMarkerDiameterPx:
                        dancerMarkerDiameterAfterRosterImport(
                          p.dancerMarkerDiameterPx
                        ),
                    };
                  });
                  /** 先頭キュー（ページ 1）を選択し、いまのステージの形と同期 */
                  window.setTimeout(() => {
                    jumpToPagerSlotRef.current(1);
                  }, 0);
                  setRosterImportDraft(null);
                  setRosterImportExtraNames([]);
                  const attLine =
                    att.hadAttendanceColumn && att.excludedRows > 0
                      ? `\n（出欠で不参加・空欄など ${att.excludedRows} 行をスキップ）`
                      : "";
                  if (d.notice) {
                    window.alert(
                      `${labelForKind(d.kind)} から ${crew.members.length} 名を取り込みました。${attLine}\n\n` +
                        d.notice
                    );
                  } else {
                    window.alert(
                      `${labelForKind(d.kind)} から ${crew.members.length} 名を取り込みました。${attLine}`
                    );
                  }
                }}
              >
                取り込む
              </button>
            </div>
          </div>
        </EditorSideSheet>
      ) : null,
    [
      project,
      rosterImportDraft,
      rosterImportNameMode,
      rosterImportExtraNames,
      setProjectSafe,
      setRosterImportDraft,
      setRosterImportNameMode,
      setRosterImportExtraNames,
      btnSecondary,
    ]
  );

  const studentViewerFocusForStage = useMemo(() => {
    if (choreoPublicView) {
      if (!choreoStudentPick) return null;
      return studentPickToStageFocus(choreoStudentPick);
    }
    if (editorViewerPreviewPick) {
      return studentPickToStageFocus(editorViewerPreviewPick);
    }
    return null;
  }, [choreoPublicView, choreoStudentPick, editorViewerPreviewPick]);

  /** 早期 return より前に置く（その後の useMemo は毎レンダーで同じ回数呼ぶ必要がある） */
  const stageZenLayout = wideEditorLayout && stageZenFullscreen;
  const mobileStackEditor =
    editorMobileStackBreakpoint &&
    !choreoPublicView &&
    !wideEditorLayout &&
    !stageZenLayout;

  /** 舞台設定シートを閉じる。モバイルは ✕/背景タップでも保存、取消のみ破棄。 */
  const closeStageAreaSettings = useCallback(
    (mode?: "apply" | "discard" | "cancel") => {
      if (!project) {
        setStageAreaSettingsOpen(false);
        return;
      }
      const resolved = mode ?? (mobileStackEditor ? "apply" : "discard");
      if (resolved === "apply") {
        if (project.viewMode !== "view") {
          applyStageAreaSettingsDraft();
        }
      } else {
        const fresh = projectToStageAreaDraft(project);
        setStageAreaSettingsDraft(fresh);
        setGridWidthCmInput(String(fresh.gridWidthCm));
        setGridDepthCmInput(String(fresh.gridDepthCm));
      }
      setStageAreaSettingsOpen(false);
    },
    [project, mobileStackEditor, applyStageAreaSettingsDraft]
  );

  useEditorKeyboardShortcuts({
    stageZenFullscreen,
    setStageZenFullscreen,
    cloudSaveDialogOpen,
    setCloudSaveDialogOpen,
    stageAreaSettingsOpen,
    onCloseStageAreaSettings: () => closeStageAreaSettings(),
    stageSettingsOpen,
    setStageSettingsOpen,
    exportDialogOpen,
    setExportDialogOpen,
    flowLibraryOpen,
    setFlowLibraryOpen,
    cueListModalOpen,
    setCueListModalOpen,
    shortcutsHelpOpen,
    setShortcutsHelpOpen,
    rosterImportDraft,
    setRosterImportDraft,
    setRosterImportExtraNames,
    undo,
    redo,
    getTrimStartSec: () => projectRef.current?.trimStartSec ?? 0,
  });

  /**
   * モバイルエディタのコンテナスタイル。
   * 縦: flex column
   * 横: CSS Grid 3ゾーン
   *   行1: wave（上段全幅）
   *   行2: stage（左）/ tools（右・縦スクロール）
   */
  const dynamicContainerStyle = useMemo<CSSProperties>(() => {
    if (!mobileStackEditor) return {};
    if (editorMobileLandscape) {
      return {
        display: "grid",
        gridTemplateColumns: "1fr min(56px, 14vw)",
        gridTemplateRows: "auto 1fr",
        gridTemplateAreas: '"wave wave" "stage tools"',
        flex: 1,
        minHeight: 0,
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
        backgroundColor: "#020617",
      };
    }
    // 縦画面: flex column
    return {
      display: "flex",
      flexDirection: "column",
      flex: 1,
      minHeight: 0,
      width: "100%",
      maxWidth: "100%",
      overflow: "hidden",
      backgroundColor: "#020617",
      overscrollBehaviorY: "contain",
    };
  }, [mobileStackEditor, editorMobileLandscape]);

  const dynamicStageShellStyle = useMemo<CSSProperties>(() => {
    if (!mobileStackEditor) return {};
    if (editorMobileLandscape) {
      // 横画面 2カラム: ステージが左カラム全高を占める
      return {
        gridArea: "stage",
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
        background: "#000",
        position: "relative",
        borderRight: "1px solid #1e293b",
        borderBottom: "none",
      };
    }
    // 縦画面: flex-1 でステージが残りスペースを最大限確保
    const moreRoom = !mobileEditorWaveExpanded || !mobileEditorToolsExpanded;
    return {
      flex: "1 1 0",
      minHeight: moreRoom ? "min(40dvh, 240px)" : "min(32dvh, 200px)",
      maxHeight: moreRoom
        ? "min(72dvh, calc(100dvh - 130px))"
        : "min(60dvh, calc(100dvh - 200px))",
      position: "relative",
      borderBottom: "1px solid #1e293b",
      borderRight: "none",
      overflow: "hidden",
      background: "#000",
    };
  }, [mobileStackEditor, mobileEditorWaveExpanded, mobileEditorToolsExpanded, editorMobileLandscape]);

  const dynamicToolsAsideStyle = useMemo<CSSProperties>(() => {
    if (!mobileStackEditor) return {};
    if (editorMobileLandscape) {
      // 横画面: CSS Grid の tools エリア（右端）に縦一列で配置、縦スクロール可
      return {
        gridArea: "tools",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
        padding:
          "4px max(4px, env(safe-area-inset-right, 0px)) max(6px, env(safe-area-inset-bottom, 0px)) 4px",
        backgroundColor: "#0f172a",
        borderLeft: "1px solid #1e293b",
        gap: 4,
      };
    }
    // 縦画面: 常時コンパクト横スクロール行として最下部に固定
    return {
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      minHeight: 0,
      minWidth: 0,
      overflowX: "auto",
      overflowY: "hidden",
      WebkitOverflowScrolling: "touch",
      overscrollBehaviorX: "contain",
      padding:
        "4px max(8px, env(safe-area-inset-right, 0px)) max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px))",
      backgroundColor: "#0f172a",
      borderTop: "1px solid #1e293b",
      gap: 6,
    };
  }, [mobileStackEditor, editorMobileLandscape]);

  const mobileTimelineDockLeading = useMemo(() => {
    if (!mobileStackEditor) return undefined;
    return (
      <>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: shell.textMuted,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          波形・再生
        </span>
        <button
          type="button"
          style={{
            ...btnSecondary,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            touchAction: "manipulation",
            flexShrink: 0,
          }}
          aria-expanded={mobileEditorWaveExpanded}
          onPointerDown={() => {
            if (mobileEditorWaveExpanded) abortTimelineWavePointerGestures();
          }}
          onClick={() => setMobileEditorWaveExpanded((v) => !v)}
        >
          {mobileEditorWaveExpanded ? "たたむ" : "ひろげる"}
        </button>
      </>
    );
  }, [mobileStackEditor, mobileEditorWaveExpanded]);

  if (loadError) {
    return (
      <div style={{ padding: 24, color: "#f87171" }}>
        {loadError}{" "}
        <Link to="/" style={{ color: "#93c5fd" }}>
          {t("common.backProjects")}
        </Link>
      </div>
    );
  }

  if (collabActive && !yjsCollab.synced) {
    return (
      <div style={{ padding: 24, color: "#94a3b8" }}>
        {t("common.loading")}
      </div>
    );
  }

  if (!project) {
    return <div style={{ padding: 24, color: "#94a3b8" }}>{t("common.loading")}</div>;
  }

  if (choreoPublicView && choreoStudentPick == null) {
    return (
      <ChoreoStudentViewGate
        pieceTitle={project.pieceTitle}
        entries={getViewRosterEntries(project)}
        gateMode="pick"
        onPick={(p) => {
          setChoreoStudentPick(p);
          if (viewerLocalStorageKey) {
            try {
              localStorage.setItem(viewerLocalStorageKey, JSON.stringify(p));
            } catch {
              /* ignore */
            }
          }
        }}
      />
    );
  }

  const stageBoardProject = projectForStageBoard ?? project;

  const hasRosterMembers = project.crews.some((c) => c.members.length > 0);
  /** 名簿ストリップのみ表示しタイムライン列を隠す（取り込み直後や「メンバーを表示」から） */
  const rosterOnlyMode =
    project.rosterHidesTimeline === true && hasRosterMembers;
  /** 常に上部に波形・再生を固定（幅に関係なく常時 top dock を使う） */
  const showTopWaveDock = !!project && !stageZenFullscreen;
  /** 固定シェル時：名簿行の有無で上部ドックの確保高さを変え、波形が切れないようにする */
  const editorShellTopWavePx =
    EDITOR_SHELL_TOP_WAVE_BASE_PX +
    (hasRosterMembers && project.rosterHidesTimeline !== true
      ? EDITOR_SHELL_TOP_WAVE_ROSTER_ROW_PX
      : 0);

  /** 生徒閲覧 /view：狭い画面ではステージ優先の 2 行グリッド */
  const publicNarrowLayout =
    choreoPublicView && !wideEditorLayout && !stageZenLayout;

  // wideEditorLayout時は常に固定 160px 下バー
  const wideBottomDockPx = topDockRowPx != null
    ? Math.max(TOP_DOCK_HEIGHT_WIDE_PX, clampTopDockRowPx(topDockRowPx))
    : TOP_DOCK_HEIGHT_WIDE_PX;
  const editorPaneGridTemplateRows = stageZenLayout
    ? "1fr"
    : wideEditorLayout
      ? "minmax(0, 1fr)"  // 波形バーはflexラッパー下段に独立配置
      : publicNarrowLayout
        ? "1fr"  // 生徒閲覧: ステージのみ全面表示。タイムラインは display:none で非表示
        : "auto auto auto auto";

  const editorPaneGridTemplateColumns = stageZenLayout
    ? "1fr"
    : editorGridColumns;

  const choreoToolbarSharedProps = {
    stageShapeActive:
      isCustomStageShapeActive(project.stageShape) ||
      (project.hanamichiEnabled ?? false),
    disabled: project.viewMode === "view",
    onOpenStageShapePicker: () => setStageShapePickerOpen(true),
    onOpenSetPiecePicker: openSetPiecePicker,
    onOpenShortcutsHelp: () => setShortcutsHelpOpen(true),
    onOpenExport: () => setExportDialogOpen(true),
  };

  const timelinePanelEl = (
    <TimelinePanel
      ref={timelineRef}
      project={project}
      setProject={setProjectSafe}
      serverProjectId={serverId}
      loggedIn={!!me}
      onStagePreviewChange={setStagePreviewDancers}
      onFormationChosenFromCueList={() => setIsPlaying(false)}
      onUndo={undo}
      onRedo={redo}
      undoDisabled={
        collabActive
          ? project.viewMode === "view" || yjsCollab.undoStackSize === 0
          : stageUndoDisabledFromHistory
      }
      redoDisabled={
        collabActive
          ? project.viewMode === "view" || yjsCollab.redoStackSize === 0
          : stageRedoDisabledFromHistory
      }
      selectedCueIds={selectedCueIds}
      onSelectedCueIdsChange={setSelectedCueIds}
      formationIdForNewCue={selectedCue?.formationId ?? project.activeFormationId}
      wideWorkbench={wideEditorLayout}
      compactTopDock={
        showTopWaveDock || publicNarrowLayout || mobileStackEditor
      }
      editorMobileStack={mobileStackEditor}
      compactDockLeading={mobileTimelineDockLeading}
      cueListPortalTarget={showTopWaveDock ? cueListPortalEl : null}
      onSave={() => setFlowLibraryOpen(true)}
      onOpenAudioImport={openAudioImport}
      audioFileInputRef={editorAudioSession.audioFileInputRef}
      extractProgress={editorAudioSession.extractProgress}
      onPickAudio={editorAudioSession.onPickAudio}
      onOpenPathEditor={(cueId) => setPathEditorCueId(cueId)}
      publicShareView={choreoPublicView}
      topDockHeightPx={
        showTopWaveDock && !mobileStackEditor ? wideBottomDockPx : null
      }
    />
  );

  const stageUndoDisabled = stageUndoDisabledFromHistory;
  const stageRedoDisabled = stageRedoDisabledFromHistory;
  const workbenchInRightRail = wideEditorLayout && !rightPaneCollapsed;

  const stageWorkbenchProps: Omit<EditorStageWorkbenchProps, "layout"> = {
    project,
    setProjectSafe,
    selectedCueId,
    selectedCue: selectedCue ?? null,
    stageAreaSettingsOpen,
    setStageAreaSettingsOpen,
    stageUndoDisabled,
    stageRedoDisabled,
    undo,
    redo,
    setAddCueDialogOpen,
    saveStageToFormationBox,
    setFlowLibraryOpen,
    addDancerFromStageToolbar,
    importCrewCsvFromStageToolbar,
    stageView,
    setStageView,
    floorTextPlaceSession,
    setFloorTextPlaceSession,
    commitFloorTextPlace,
    hasRosterMembers,
    /** 右列でもステージ床テキストを配置できるように常に出す（上部ドック時も非表示にしない） */
    hideFloorTextToolbar: false,
    hideUndoRedoInRail: showTopWaveDock,
    choreoToolbarProps: choreoToolbarSharedProps,
    onOpenCueListModal: showTopWaveDock
      ? () => setCueListModalOpen(true)
      : undefined,
    onOpenAudioImport: openAudioImport,
    onPreloadFfmpegForAudio: () => {
      void preloadFFmpegWasm();
    },
    onEnterStageZen: () => {
      setFloorTextPlaceSession(null);
      setStageZenFullscreen(true);
    },
    stageZenEligible: showTopWaveDock && !rightPaneCollapsed,
    onOpenShareLinks: choreoPublicView ? undefined : () => setShareLinksOpen(true),
    /** false: 未保存でも押せる。シート側でクラウド保存の案内を出す（serverId なしで無効化すると「動かない」ように見える） */
    shareLinksButtonDisabled: false,
    onOpenViewerMode: choreoPublicView
      ? () => setChoreoMemberSheetOpen(true)
      : () => setEditorViewerSheetOpen(true),
    ...(me && !choreoPublicView
      ? {
          onOpenCloudSave: () => setCloudSaveDialogOpen(true),
          cloudSaveDisabled: saving,
          cloudSaveRailLine1: t("editor.cloudSaveRailLine1"),
          cloudSaveRailLine2: serverId ? t("editor.saveOverwrite") : t("editor.save"),
          cloudSaveRailTitle: serverId
            ? t("editor.saveTitleOverwrite")
            : t("editor.saveTitleNew"),
        }
      : {}),
  };

  const editorLayoutProps: EditorLayoutProps = {
    activeFormationId,
    addCueDialogEl,
    addDancerFromStageToolbar,
    aiSuggestOpen,
    applyStageAreaSettingsDraft,
    closeStageAreaSettings,
    beginGestureHistory,
    browseFloorMarkup,
    browseFormationDancers,
    browseSetPieces,
    cancelGestureHistory,
    choreoMemberSheetOpen,
    choreoPublicView,
    choreoStudentPick,
    choreoToolbarSharedProps,
    cloudSaveDialogOpen,
    collabActive,
    commitFloorTextPlace,
    commitStageGridCmInput,
    confirmAddSetPiece,
    cueById,
    cueListModalOpen,
    cuesSortedForStageJump,
    currentTime,
    dancersFor3d,
    duration,
    dynamicContainerStyle,
    dynamicStageShellStyle,
    dynamicToolsAsideStyle,
    editorMobileLandscape,
    editorPaneGridTemplateColumns,
    editorPaneGridTemplateRows,
    editorPaneRef,
    editorSurfaceEl,
    editorViewerSheetOpen,
    endGestureHistory,
    endSplitDrag,
    endTopDockResize,
    exportDialogEl,
    floorMarkupTool,
    floorTextPlaceSession,
    floorTextSideSheetOpen,
    flowLibraryDialogEl,
    formationBoxManagerDialogEl,
    formationPresetPickerOpen,
    formationPresetPickerSheetEl,
    setFormationPresetPickerOpen,
    formationById,
    getWavePeaksSnapshot,
    gridDepthCmInput,
    gridNudgeDidRepeatRef,
    gridWidthCmInput,
    hasRosterMembers,
    importCrewCsvFromStageToolbar,
    isPlaying,
    jumpToPagerSlot,
    markHistorySkipNextPush,
    me,
    memberRosterSheetOpen,
    mobileEditorToolsExpanded,
    mobileEditorWaveExpanded,
    mobileStackEditor,
    nudgeStageGridCm,
    onFloorTextPlaceSessionChange,
    onRosterConfirmReturnToTimeline,
    onSplitLostCapture,
    onSplitPointerDown,
    onSplitPointerMove,
    onStageGridCmInput,
    onTopDockResizeDoubleClick,
    onTopDockResizeDown,
    onTopDockResizeMove,
    onUpdateGlobalFloorMarkup,
    openAudioImport,
    pathEditorCueId,
    performCloudSave,
    playbackAudioElement,
    playbackDancersForStage,
    playbackFloorMarkupForStage,
    playbackSetPiecesForStage,
    project,
    projectName,
    publicNarrowLayout,
    publicViewTightHeight,
    viewerChromeCollapsed,
    setViewerChromeCollapsed,
    viewerBarHeightPx,
    onViewerBarHeightChange: setViewerBarHeightPx,
    resyncViewerPlayback,
    reloadViewerAudio,
    redo,
    rightPaneCollapsed,
    rightPaneStackRef,
    rightPaneTopSectionStyle,
    rosterImportSheetEl,
    rosterOnlyMode,
    saveStageToFormationBox,
    saving,
    selectedCue,
    selectedCueId,
    serverId,
    setAddCueDialogOpen,
    setAiSuggestOpen,
    setChoreoMemberSheetOpen,
    setChoreoStudentPick,
    setCloudSaveDialogOpen,
    setCueListModalOpen,
    setCueListPortalEl,
    setEditorSurfaceEl,
    setEditorViewerPreviewPick,
    setEditorViewerSheetOpen,
    setFloorMarkupTool,
    setFloorTextPlaceSession,
    setFloorTextSideSheetOpen,
    setFlowLibraryOpen,
    setMemberRosterSheetOpen,
    setMobileEditorToolsExpanded,
    setMobileEditorWaveExpanded,
    setPathEditorCueId,
    setPiecePickerOpen,
    setProjectSafe,
    setRightPaneCollapsed,
    setSelectedCueIds,
    setSetPiecePickerOpen,
    setShareLinksOpen,
    setShortcutsHelpOpen,
    setShowMotionArrows,
    setStageAreaPresetList,
    setStageAreaPresetSelectNonce,
    setStageAreaSettingsDraft,
    setStageAreaSettingsOpen,
    setStagePreviewDancers,
    setStageSettingsOpen,
    setStageShapePickerOpen,
    setStageView,
    setStageZenFullscreen,
    setTextPanelPortalEl,
    shareLinksOpen,
    shareLinksUrls,
    shortcutsHelpOpen,
    showMotionArrows,
    showTopWaveDock,
    sortedCuesForEditor,
    stageAreaDraftHasMainFloor,
    stageAreaPresetList,
    stageAreaPresetSelectNonce,
    stageAreaSettingsDraft,
    stageAreaSettingsDraftRef,
    stageAreaSettingsOpen,
    stageBoardProject,
    stagePreviewDancers,
    stageRedoDisabled,
    stageSectionRef,
    stageSettingsOpen,
    stageShapePickerOpen,
    stageUndoDisabled,
    stageWorkbenchProps,
    stageView,
    stageZenLayout,
    startGridNudgeRepeat,
    stopGridNudgeRepeat,
    studentViewerFocusForStage,
    t,
    textPanelPortalEl,
    timelinePanelEl,
    timelineRef,
    topDockSectionRef,
    undo,
    viewerLocalStorageKey,
    wideBottomDockPx,
    wideEditorLayout,
    workbenchInRightRail,
  };

  return (
    <>
      <TimelineAudioChrome
        audioFileInputRef={editorAudioSession.audioFileInputRef}
        extractProgress={editorAudioSession.extractProgress}
        onPickAudio={editorAudioSession.onPickAudio}
        onPreloadFfmpegPointer={() => {
          void preloadFFmpegWasm();
        }}
      />
      {collabUnavailableNotice ? (
        <div
          role="status"
          style={{
            padding: "10px 16px",
            background: "rgba(120, 80, 0, 0.25)",
            borderBottom: "1px solid rgba(251, 191, 36, 0.45)",
            color: "#fde68a",
            fontSize: "13px",
            lineHeight: 1.5,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <span>{t("editor.collabUnavailable")}</span>
          <button
            type="button"
            style={{ ...btnSecondary, fontSize: "12px", padding: "6px 12px" }}
            onClick={() =>
              navigate({ pathname: location.pathname, search: "" }, { replace: true })
            }
          >
            {t("editor.collabOpenNormal")}
          </button>
        </div>
      ) : null}
      <EditorPageLayout {...editorLayoutProps} />
    </>
  );
}
