import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StageBoard } from "../components/StageBoard";
import { StageDimensionFields } from "../components/StageDimensionFields";
const Stage3DView = lazy(() =>
  import("../components/Stage3DView").then((m) => ({ default: m.Stage3DView }))
);
import { TimelinePanel, type TimelinePanelHandle } from "../components/TimelinePanel";
import { InspectorPanel } from "../components/InspectorPanel";
import { RosterTimelineStrip } from "../components/RosterTimelineStrip";
import { createEmptyProject, tryMigrateFromLocalStorage } from "../lib/projectDefaults";
import { preloadFFmpeg } from "../lib/extractVideoAudio";
import { normalizeProject } from "../lib/normalizeProject";
import { sortCuesByStart } from "../lib/cueInterval";
import { dancersAtTime } from "../lib/interpolatePlayback";
import { setPiecesAtTime } from "../lib/interpolateSetPieces";
import {
  listFormationBoxItemsByCount,
  saveFormationToBox,
} from "../lib/formationBox";
import { pickSpotForAppendedDancer } from "../lib/dancerAppendPlacement";
import { DANCER_SPACING_PRESET_OPTIONS } from "../lib/dancerSpacing";
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
  Crew,
  DancerSpot,
  SetPieceKind,
} from "../types/choreography";
import type { ImageSpotImportCommit } from "../lib/imageSpotImport";
import { ImageSpotImportDialog } from "../components/ImageSpotImportDialog";
import {
  SetPiecePickerModal,
  type SetPiecePickerSubmit,
} from "../components/SetPiecePickerModal";
import { ChoreoGridToolbar } from "../components/ChoreoGridToolbar";
import { StageShapePicker } from "../components/StageShapePicker";
import { ExportDialog } from "../components/ExportDialog";
import { FlowLibraryDialog } from "../components/FlowLibraryDialog";
import { AddCueWithFormationDialog } from "../components/AddCueWithFormationDialog";
import {
  GATHER_TOWARD_OPTIONS,
  gatherDancersToEdge,
  type GatherToward,
} from "../lib/gatherDancers";
import { projectApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { btnSecondary } from "../components/StageBoard";
import { useYjsCollaboration } from "../hooks/useYjsCollaboration";

const HISTORY_CAP = 80;

const EDITOR_WIDE_MIN_PX = 1280;
/** メイン 4 列グリッドの列間（ステージ〜タイムラインのすき間に効く） */
const EDITOR_GRID_GAP_PX = 6;
/** ステージ列とタイムライン列の間のドラッグ幅 */
const STAGE_RESIZER_PX = 4;
const STAGE_COL_MIN_PX = 280;
const TIMELINE_COL_MIN_PX = 260;
const TOOLBAR_COL_PX = 52;
/** 右ペイン：タイムライン（またはキュー一覧）とプロパティの分割 */
const RIGHT_STACK_FRAC_MIN = 0.22;
const RIGHT_STACK_FRAC_MAX = 0.78;

function readMaxStageWidthPx(gridEl: HTMLElement): number {
  const rect = gridEl.getBoundingClientRect();
  const cs = getComputedStyle(gridEl);
  const padX =
    (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const gap =
    parseFloat(cs.columnGap) ||
    parseFloat(cs.rowGap) ||
    parseFloat(cs.gap) ||
    EDITOR_GRID_GAP_PX;
  const gapsBetween4Cols = 3 * gap;
  return (
    rect.width -
    padX -
    gapsBetween4Cols -
    TOOLBAR_COL_PX -
    STAGE_RESIZER_PX -
    TIMELINE_COL_MIN_PX
  );
}

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { me, ready: authReady } = useAuth();
  const collabParam = searchParams.get("collab") === "1";
  const [plainProject, setPlainProject] = useState<ChoreographyProjectJson | null>(null);
  const [projectName, setProjectName] = useState("無題の作品");
  const [serverId, setServerId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stageView, setStageView] = useState<"2d" | "3d">("2d");
  const [stagePreviewDancers, setStagePreviewDancers] = useState<DancerSpot[] | null>(
    null
  );
  /** ChoreoGrid: 編集対象のキュー（ステージ・プリセット・インスペクタの書き込み先） */
  const [selectedCueIds, setSelectedCueIds] = useState<string[]>([]);
  const selectedCueId =
    selectedCueIds.length === 0
      ? null
      : selectedCueIds[selectedCueIds.length - 1]!;
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [flowLibraryOpen, setFlowLibraryOpen] = useState(false);
  /** キュー追加 ＋ 形選択 ＋ 形の箱保存を 1 画面に統合したダイアログ */
  const [addCueDialogOpen, setAddCueDialogOpen] = useState(false);
  const [cuePagerListOpen, setCuePagerListOpen] = useState(false);
  /**
   * 右ペイン（キュー一覧／プロパティ）を畳んでステージを最大化するトグル。
   * 畳んでも左の操作バー＋ステージは残り、ステージ上部のページャーから
   * キュー切替は引き続き可能。狭いビューポート（!wideEditorLayout）では無効。
   */
  const [rightPaneCollapsed, setRightPaneCollapsed] = useState(false);
  const timelineRef = useRef<TimelinePanelHandle>(null);
  const [stageSettingsOpen, setStageSettingsOpen] = useState(false);
  const [gatherMenuOpen, setGatherMenuOpen] = useState(false);
  /** 保存メニュー（流れ / 立ち位置） */
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [imageSpotImportOpen, setImageSpotImportOpen] = useState(false);
  /**
   * 右列スタック上段の高さ比率（タイムライン or キュー一覧）。null = 既定の flex 55% / 45%。
   */
  const [rightStackTopFrac, setRightStackTopFrac] = useState<number | null>(null);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [setPiecePickerOpen, setSetPiecePickerOpen] = useState(false);
  /** 変形舞台ピッカー（舞台形状のカスタマイズ） */
  const [stageShapePickerOpen, setStageShapePickerOpen] = useState(false);
  /** ワイド時のみ。null = 既定の fr 比、数値 = ステージ列の幅（px） */
  const [stageColumnPx, setStageColumnPx] = useState<number | null>(null);
  const [wideEditorLayout, setWideEditorLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`).matches
  );
  /** §3 ワイド時: タイムライン・波形を画面上部の全幅行に移す */
  const [waveTimelineDockTop, setWaveTimelineDockTop] = useState(false);
  /** `waveTimelineDockTop` 時にキュー一覧をポータルで描画する右列の DOM 要素 */
  const [cueListPortalEl, setCueListPortalEl] =
    useState<HTMLDivElement | null>(null);
  /** 上部ドック時の上段（波形・再生）行の高さ（px）。null = 既定の `minmax(160px, min(28vh, 300px))` */
  const [topDockRowPx, setTopDockRowPx] = useState<number | null>(null);
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
  const stageSectionRef = useRef<HTMLElement>(null);
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
  const rightStackDragRef = useRef<{
    pointerId: number;
    startY: number;
    startFrac: number;
    stackH: number;
  } | null>(null);

  const historyRef = useRef<{ undo: string[]; redo: string[] }>({
    undo: [],
    redo: [],
  });

  const collabActive =
    collabParam &&
    !!me &&
    serverId != null &&
    projectId != null &&
    projectId !== "new";

  const yjsCollab = useYjsCollaboration(serverId, collabActive);
  const project = collabActive ? yjsCollab.project : plainProject;

  /**
   * エディタを開いた時点でバックグラウンドで FFmpeg.wasm を温めておく。
   * ユーザがあとで動画を選んだ時、初回でもコア/wasm は既にキャッシュ済みで即抽出に入れる。
   */
  useEffect(() => {
    const idle: (cb: () => void) => number =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    const cancel: (id: number) => void =
      (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback ?? ((id: number) => window.clearTimeout(id));
    const id = idle(() => {
      void preloadFFmpeg();
    });
    return () => cancel(id);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (projectId === "new" || !projectId) {
      const migrated = tryMigrateFromLocalStorage();
      setPlainProject(migrated ?? createEmptyProject());
      setServerId(null);
      setLoadError(null);
      historyRef.current = { undo: [], redo: [] };
      return;
    }
    const id = Number(projectId);
    if (!Number.isFinite(id)) {
      setLoadError("無効な ID");
      return;
    }
    if (collabParam && !me) {
      setLoadError("共同編集にはログインが必要です");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const row = await projectApi.get(id);
        if (cancelled) return;
        setServerId(row.id);
        setProjectName(row.name);
        if (collabParam && me) {
          setPlainProject(null);
        } else {
          setPlainProject(normalizeProject(row.json));
        }
        setLoadError(null);
        historyRef.current = { undo: [], redo: [] };
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "読み込み失敗");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, collabParam, me, authReady]);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`);
    const onChange = () => setWideEditorLayout(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!wideEditorLayout) {
      setWaveTimelineDockTop(false);
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
        const maxW = readMaxStageWidthPx(grid);
        const minW = STAGE_COL_MIN_PX;
        if (!Number.isFinite(maxW)) return cur;
        if (maxW < minW) return Math.max(minW, Math.round(maxW));
        return Math.min(maxW, Math.max(minW, cur));
      });
    };
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [wideEditorLayout]);

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
    let maxW = readMaxStageWidthPx(grid);
    const minW = STAGE_COL_MIN_PX;
    if (!Number.isFinite(maxW) || maxW < minW) maxW = minW;
    const next = Math.round(
      Math.min(maxW, Math.max(minW, d.startW + (e.clientX - d.startX)))
    );
    setStageColumnPx(next);
  }, []);

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
      const topSection = grid.firstElementChild as HTMLElement | null;
      const startH = topSection
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
      /**
       * ユーザーが「波形を上の方までできるだけ縮めたい」ケース向けに、
       * 最小高さはツールバー 1 行＋波形数 px が見える程度まで許可する。
       */
      const minH = 48;
      const maxH = Math.max(minH, gridRect.height - 160);
      const next = Math.round(
        Math.min(maxH, Math.max(minH, d.startH + (e.clientY - d.startY)))
      );
      setTopDockRowPx(next);
    },
    []
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

  const onRightStackResizeDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const stack = rightPaneStackRef.current;
      if (!stack) return;
      e.preventDefault();
      const stackH = stack.getBoundingClientRect().height;
      if (stackH < 80) return;
      const baseFrac = rightStackTopFrac ?? 0.55;
      rightStackDragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startFrac: baseFrac,
        stackH,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [rightStackTopFrac]
  );

  const onRightStackResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = rightStackDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dy = e.clientY - d.startY;
      const next = Math.min(
        RIGHT_STACK_FRAC_MAX,
        Math.max(RIGHT_STACK_FRAC_MIN, d.startFrac - dy / d.stackH)
      );
      setRightStackTopFrac(next);
    },
    []
  );

  const endRightStackResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = rightStackDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    rightStackDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onRightStackResizeLostCapture = useCallback(() => {
    rightStackDragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onRightStackResizeDoubleClick = useCallback(() => {
    setRightStackTopFrac(null);
  }, []);

  const rightPaneTopSectionStyle = useMemo((): CSSProperties => {
    if (rightStackTopFrac == null) {
      return { flex: "1 1 55%", minHeight: 0, minWidth: 0 };
    }
    return {
      flex: `${rightStackTopFrac} 1 0px`,
      minHeight: 0,
      minWidth: 0,
    };
  }, [rightStackTopFrac]);

  const rightPaneBottomSectionStyle = useMemo((): CSSProperties => {
    if (rightStackTopFrac == null) {
      return { flex: "1 1 45%", minHeight: 0, minWidth: 0 };
    }
    return {
      flex: `${1 - rightStackTopFrac} 1 0px`,
      minHeight: 0,
      minWidth: 0,
    };
  }, [rightStackTopFrac]);

  const editorGridColumns = wideEditorLayout
    ? rightPaneCollapsed
      ? `${TOOLBAR_COL_PX}px 1fr`
      : stageColumnPx == null
        ? `${TOOLBAR_COL_PX}px minmax(${STAGE_COL_MIN_PX}px, 2fr) ${STAGE_RESIZER_PX}px minmax(${TIMELINE_COL_MIN_PX}px, 1fr)`
        : `${TOOLBAR_COL_PX}px ${Math.round(stageColumnPx)}px ${STAGE_RESIZER_PX}px minmax(${TIMELINE_COL_MIN_PX}px, 1fr)`
    : "1fr";

  const setProjectSafePlain: Dispatch<SetStateAction<ChoreographyProjectJson>> =
    useCallback((action) => {
      setPlainProject((prev) => {
        if (!prev) return prev;
        const next =
          typeof action === "function"
            ? (action as (p: ChoreographyProjectJson) => ChoreographyProjectJson)(prev)
            : action;
        if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
        const { undo, redo } = historyRef.current;
        if (undo.length >= HISTORY_CAP) undo.shift();
        undo.push(JSON.stringify(prev));
        redo.length = 0;
        return next;
      });
    }, []);

  const setProjectSafe: Dispatch<SetStateAction<ChoreographyProjectJson>> =
    useMemo(
      () => (collabActive ? yjsCollab.setProjectSafe : setProjectSafePlain),
      [collabActive, yjsCollab.setProjectSafe, setProjectSafePlain]
    );

  const undoPlain = useCallback(() => {
    setPlainProject((cur) => {
      if (!cur) return cur;
      const { undo, redo } = historyRef.current;
      if (undo.length === 0) return cur;
      const prevStr = undo.pop()!;
      redo.push(JSON.stringify(cur));
      return normalizeProject(JSON.parse(prevStr));
    });
  }, []);

  const redoPlain = useCallback(() => {
    setPlainProject((cur) => {
      if (!cur) return cur;
      const { undo, redo } = historyRef.current;
      if (redo.length === 0) return cur;
      const nextStr = redo.pop()!;
      undo.push(JSON.stringify(cur));
      return normalizeProject(JSON.parse(nextStr));
    });
  }, []);

  const undo = useCallback(() => {
    if (collabActive) yjsCollab.undo();
    else undoPlain();
  }, [collabActive, yjsCollab, undoPlain]);

  const redo = useCallback(() => {
    if (collabActive) yjsCollab.redo();
    else redoPlain();
  }, [collabActive, yjsCollab, redoPlain]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      if (e.key === "Escape" && saveMenuOpen) {
        setSaveMenuOpen(false);
        return;
      }
      if (e.key === "Escape" && imageSpotImportOpen) {
        setImageSpotImportOpen(false);
        return;
      }
      if (e.key === "Escape" && gatherMenuOpen) {
        setGatherMenuOpen(false);
        return;
      }
      if (e.key === "Escape" && stageSettingsOpen) {
        setStageSettingsOpen(false);
        return;
      }
      if (e.key === "Escape" && exportDialogOpen) {
        setExportDialogOpen(false);
        return;
      }
      if (e.key === "Escape" && flowLibraryOpen) {
        setFlowLibraryOpen(false);
        return;
      }
      if (e.key === "Escape" && cuePagerListOpen) {
        setCuePagerListOpen(false);
        return;
      }
      if (e.key === "Escape" && shortcutsHelpOpen) {
        setShortcutsHelpOpen(false);
        return;
      }
      if (e.key === "Escape" && rosterImportDraft) {
        setRosterImportDraft(null);
        setRosterImportExtraNames([]);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        timelineRef.current?.togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    redo,
    undo,
    saveMenuOpen,
    imageSpotImportOpen,
    gatherMenuOpen,
    stageSettingsOpen,
    shortcutsHelpOpen,
    exportDialogOpen,
    flowLibraryOpen,
    cuePagerListOpen,
    rosterImportDraft,
  ]);

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

  const selectedCue = useMemo(
    () => project?.cues.find((c) => c.id === selectedCueId) ?? null,
    [project, selectedCueId]
  );

  const cueIdsSig =
    project?.cues
      .map((c) => `${c.id}:${c.tStartSec}:${c.tEndSec}:${c.formationId}`)
      .join("|") ?? "";

  const cuesSortedForStageJump = useMemo(
    () => (project ? sortCuesByStart(project.cues) : []),
    [project, cueIdsSig]
  );

  const jumpToCueByIdx = useCallback(
    (idx: number) => {
      if (!project || project.viewMode === "view") return;
      const cue = cuesSortedForStageJump[idx];
      if (!cue) return;
      timelineRef.current?.pauseAndSeekToSec(cue.tStartSec);
      setSelectedCueIds([cue.id]);
      setProjectSafe((p) => ({ ...p, activeFormationId: cue.formationId }));
    },
    [project, cuesSortedForStageJump, setProjectSafe]
  );

  useEffect(() => {
    if (!project) return;
    if (project.cues.length === 0) {
      setSelectedCueIds([]);
      return;
    }
    setSelectedCueIds((ids) => {
      const valid = ids.filter((id) => project.cues.some((c) => c.id === id));
      if (valid.length > 0) return valid;
      const first = sortCuesByStart(project.cues)[0]?.id;
      return first ? [first] : [];
    });
  }, [project, cueIdsSig]);

  /** 再生中のみ補間表示 */
  const playbackDancersForStage = !isPlaying ? null : interpolatedDancers;

  const playbackSetPiecesForStage = !isPlaying ? null : interpolatedSetPieces;

  const browseFormationDancers = useMemo(() => {
    if (!project || isPlaying) return null;
    if (stagePreviewDancers && stagePreviewDancers.length > 0) return null;
    if (selectedCue) {
      const f = project.formations.find((x) => x.id === selectedCue.formationId);
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
    const f = project.formations.find((x) => x.id === project.activeFormationId);
    return f?.dancers ?? null;
  }, [project, isPlaying, stagePreviewDancers, selectedCue, currentTime]);

  const browseSetPieces = useMemo(() => {
    if (!project || isPlaying) return null;
    if (stagePreviewDancers && stagePreviewDancers.length > 0) return null;
    if (selectedCue) {
      const f = project.formations.find((x) => x.id === selectedCue.formationId);
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
    const f = project.formations.find((x) => x.id === project.activeFormationId);
    return f?.setPieces ?? null;
  }, [project, isPlaying, stagePreviewDancers, selectedCue, currentTime]);

  const dancersFor3d = useMemo(() => {
    if (!project) return [];
    if (stagePreviewDancers?.length) return stagePreviewDancers;
    if (interpolatedDancers && isPlaying) return interpolatedDancers;
    if (browseFormationDancers?.length) return browseFormationDancers;
    const f = project.formations.find((x) => x.id === project.activeFormationId);
    return f?.dancers ?? [];
  }, [
    project,
    interpolatedDancers,
    isPlaying,
    stagePreviewDancers,
    browseFormationDancers,
  ]);

  const onInspectorFormationSelect = useCallback(
    (formationId: string) => {
      setProjectSafe((p) => {
        if (!selectedCueId) {
          return { ...p, activeFormationId: formationId };
        }
        return {
          ...p,
          activeFormationId: formationId,
          cues: sortCuesByStart(
            p.cues.map((c) =>
              c.id === selectedCueId ? { ...c, formationId } : c
            )
          ),
        };
      });
    },
    [selectedCueId, setProjectSafe]
  );

  const applyGatherToward = useCallback(
    (toward: GatherToward) => {
      if (!project || project.viewMode === "view") return;
      if (project.cues.length > 0 && !selectedCueId) return;
      const fid = selectedCue?.formationId ?? project.activeFormationId;
      setProjectSafe((p) => {
        const f = p.formations.find((x) => x.id === fid);
        if (!f?.dancers.length) return p;
        return {
          ...p,
          formations: p.formations.map((x) =>
            x.id === fid
              ? { ...x, dancers: gatherDancersToEdge(x.dancers, toward) }
              : x
          ),
        };
      });
      setGatherMenuOpen(false);
    },
    [project, selectedCueId, selectedCue, setProjectSafe]
  );

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
        colorIndex: n % 9,
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
  const commitImageSpotImport = useCallback(
    (payload: ImageSpotImportCommit) => {
      if (!project || project.viewMode === "view") return;
      if (project.cues.length > 0 && !selectedCueId) return;
      const fid = selectedCue?.formationId ?? project.activeFormationId;
      setProjectSafe((p) => {
        const fm = p.formations.find((x) => x.id === fid);
        if (!fm) return p;
        const crew: Crew = {
          id: crypto.randomUUID(),
          name: payload.crewName.trim().slice(0, 80) || "画像取込",
          members: payload.rows.map((r) => r.member),
        };
        const newDancers: DancerSpot[] = payload.rows.map((r) => ({
          id: crypto.randomUUID(),
          label: r.member.label.slice(0, 14),
          xPct: r.xPct,
          yPct: r.yPct,
          colorIndex: r.member.colorIndex % 9,
          crewMemberId: r.member.id,
        }));
        return {
          ...p,
          crews: [...p.crews, crew],
          formations: p.formations.map((f) =>
            f.id === fid ? { ...f, dancers: [...f.dancers, ...newDancers] } : f
          ),
        };
      });
    },
    [project, selectedCueId, selectedCue, setProjectSafe]
  );

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
   * 現在ステージで見ている立ち位置をそのまま「形の箱」に保存する。
   * 再生中や何もないステージでは無視される。
   */
  const saveStageToFormationBox = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const fid =
      selectedCue?.formationId ??
      project.formations.find((x) => x.id === project.activeFormationId)?.id ??
      project.formations[0]?.id;
    if (!fid) return;
    const f = project.formations.find((x) => x.id === fid);
    if (!f || f.dancers.length === 0) {
      window.alert("保存する立ち位置がありません。");
      return;
    }
    const already = listFormationBoxItemsByCount(f.dancers.length).length;
    const suggested = `${f.dancers.length}人の形 ${already + 1}`;
    const name = window.prompt("形の箱に保存する名前（あとで変更可）", suggested);
    if (name === null) return;
    const result = saveFormationToBox(name.trim() || suggested, f.dancers);
    if (!result.ok) {
      window.alert(result.message);
    }
  }, [project, selectedCue]);

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
      const wPct = kind === "ellipse" ? 20 : 24;
      const hPct = kind === "ellipse" ? 20 : 18;
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
                    xPct: 38,
                    yPct: 32,
                    wPct,
                    hPct,
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

  const onStopPlaybackFromStage = useCallback(() => {
    timelineRef.current?.stopPlayback();
  }, []);

  const saveToCloud = useCallback(async () => {
    if (!me || !project) return;
    setSaving(true);
    try {
      const title =
        project.pieceTitle?.trim() || projectName.trim() || "無題の作品";
      if (serverId != null) {
        await projectApi.update(serverId, title, project);
      } else {
        const row = await projectApi.create(title, project);
        setServerId(row.id);
        navigate(`/editor/${row.id}`, { replace: true });
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [me, project, projectName, serverId, navigate]);

  if (loadError) {
    return (
      <div style={{ padding: 24, color: "#f87171" }}>
        {loadError}{" "}
        <Link to="/" style={{ color: "#93c5fd" }}>
          戻る
        </Link>
      </div>
    );
  }

  if (collabActive && !yjsCollab.synced) {
    return (
      <div style={{ padding: 24, color: "#94a3b8" }}>
        共同編集を同期しています…（Yjs）
      </div>
    );
  }

  if (!project) {
    return <div style={{ padding: 24, color: "#94a3b8" }}>読み込み中…</div>;
  }

  const waveDockTopRow = wideEditorLayout && waveTimelineDockTop;
  const hasRosterMembers = project.crews.some((c) => c.members.length > 0);
  /** 名簿ストリップのみ表示しタイムライン列を隠す（取り込み直後や「メンバーを表示」から） */
  const rosterOnlyMode =
    project.rosterHidesTimeline === true && hasRosterMembers;
  /** 上部に波形ドックを出すレイアウト（名簿専用モードではオフ） */
  const showTopWaveDock = waveDockTopRow && !rosterOnlyMode;

  const timelinePanelEl = (
    <TimelinePanel
      ref={timelineRef}
      project={project}
      setProject={setProjectSafe}
      currentTime={currentTime}
      setCurrentTime={setCurrentTime}
      isPlaying={isPlaying}
      setIsPlaying={setIsPlaying}
      duration={duration}
      setDuration={setDuration}
      serverProjectId={serverId}
      loggedIn={!!me}
      onStagePreviewChange={setStagePreviewDancers}
      onFormationChosenFromCueList={() => setIsPlaying(false)}
      onUndo={undo}
      onRedo={redo}
      undoDisabled={
        project.viewMode === "view" ||
        (collabActive
          ? yjsCollab.undoStackSize === 0
          : historyRef.current.undo.length === 0)
      }
      redoDisabled={
        project.viewMode === "view" ||
        (collabActive
          ? yjsCollab.redoStackSize === 0
          : historyRef.current.redo.length === 0)
      }
      selectedCueIds={selectedCueIds}
      onSelectedCueIdsChange={setSelectedCueIds}
      formationIdForNewCue={selectedCue?.formationId ?? project.activeFormationId}
      wideWorkbench={wideEditorLayout}
      waveTimelineDockTop={waveTimelineDockTop}
      onWaveTimelineDockTopChange={setWaveTimelineDockTop}
      compactTopDock={showTopWaveDock}
      cueListPortalTarget={showTopWaveDock ? cueListPortalEl : null}
    />
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "nowrap",
          gap: "10px",
          alignItems: "center",
          padding: "6px 12px",
          borderBottom: "1px solid #1e293b",
          background: "#020617",
          minHeight: 0,
        }}
      >
        <Link
          to="/"
          title="作品一覧に戻る"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 6,
              background:
                "linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)",
              color: "#020617",
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: "-0.02em",
              boxShadow: "0 2px 6px rgba(99,102,241,0.35)",
            }}
          >
            CG
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#e2e8f0",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            ChoreoGrid
          </span>
        </Link>
        <input
          type="text"
          placeholder="作品名"
          aria-label="作品名"
          value={project.pieceTitle}
          disabled={project.viewMode === "view"}
          onChange={(e) =>
            setProjectSafe((p) => ({ ...p, pieceTitle: e.target.value }))
          }
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#e2e8f0",
            fontSize: "14px",
            fontWeight: 600,
          }}
        />
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#94a3b8",
            flexShrink: 0,
          }}
        >
          人数
          <input
            type="number"
            min={1}
            max={200}
            step={1}
            placeholder="—"
            title="作品の想定人数（メモ用。各フォーメーションの人数とは別です）"
            disabled={project.viewMode === "view"}
            value={project.pieceDancerCount ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                setProjectSafe((p) => ({ ...p, pieceDancerCount: null }));
                return;
              }
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              setProjectSafe((p) => ({
                ...p,
                pieceDancerCount: Math.max(1, Math.min(200, Math.floor(n))),
              }));
            }}
            style={{
              width: "56px",
              padding: "4px 6px",
              borderRadius: "6px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: "13px",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </label>
        {me ? (
          <button
            type="button"
            style={{
              ...btnSecondary,
              padding: "6px 10px",
              fontSize: "12px",
              flexShrink: 0,
            }}
            disabled={saving}
            title={
              serverId
                ? "クラウドに上書き保存"
                : "クラウドに新規保存（保存名は作品名を使用）"
            }
            onClick={() => void saveToCloud()}
          >
            {saving ? "保存中…" : serverId ? "上書き保存" : "保存"}
          </button>
        ) : null}
      </header>

      <div
        ref={editorPaneRef}
        className="editor-three-pane"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: editorGridColumns,
          gridTemplateRows: wideEditorLayout
            ? showTopWaveDock
              ? `${
                  topDockRowPx != null
                    ? `${topDockRowPx}px`
                    : "minmax(48px, min(18vh, 180px))"
                } 4px minmax(0, 1fr)`
              : "1fr"
            : "auto auto auto",
          gap: `${EDITOR_GRID_GAP_PX}px`,
          padding: "12px",
          minHeight: 0,
        }}
      >
        {showTopWaveDock ? (
          <section
            style={{
              gridColumn: "1 / -1",
              gridRow: 1,
              /**
               * 上下の区切りは下段のセパレータ（1px 線）に任せて、
               * 自分自身の枠・背景は描かない。スペースを最大限に確保するため。
               */
              background: "transparent",
              border: "none",
              padding: "4px 4px 0",
              minHeight: 0,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {hasRosterMembers ? (
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  justifyContent: "flex-end",
                  padding: "0 4px 6px",
                }}
              >
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  title="右列で名簿一覧を表示し、タイムラインは隠します"
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
            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {timelinePanelEl}
            </div>
          </section>
        ) : null}
        {showTopWaveDock ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="波形・再生エリアの高さを変更（ダブルクリックで既定に戻す）"
            title="上下ドラッグで高さを調整（ダブルクリックで既定に戻す）"
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
        <div
          style={
            wideEditorLayout
              ? {
                  gridColumn: 1,
                  gridRow: showTopWaveDock ? 3 : 1,
                  minWidth: 0,
                  minHeight: 0,
                  alignSelf: "stretch",
                  display: "flex",
                }
              : undefined
          }
        >
          <ChoreoGridToolbar
            snapGrid={project.snapGrid}
            stageShapeActive={
              (project.stageShape != null &&
                project.stageShape.presetId !== "rectangle") ||
              (project.hanamichiEnabled ?? false)
            }
            disabled={project.viewMode === "view"}
            onToggleSnapGrid={() =>
              setProjectSafe((p) => ({ ...p, snapGrid: !p.snapGrid }))
            }
            onOpenStageShapePicker={() => setStageShapePickerOpen(true)}
            onOpenSetPiecePicker={openSetPiecePicker}
            onOpenShortcutsHelp={() => setShortcutsHelpOpen(true)}
            onOpenExport={() => setExportDialogOpen(true)}
          />
        </div>
        <section
          ref={stageSectionRef}
          style={{
            background: "#020617",
            border: "1px solid #1e293b",
            borderRadius: "12px",
            padding: "12px",
            minHeight: 0,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            ...(wideEditorLayout
              ? {
                  gridColumn: 2,
                  gridRow: showTopWaveDock ? 3 : 1,
                }
              : {}),
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginBottom: "8px",
            }}
          >
            {/* 1 行目: タイトル／選択情報 + 主要アクション */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexWrap: "wrap",
                minWidth: 0,
              }}
            >
              <h2 style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                ステージ
              </h2>
              {cuesSortedForStageJump.length > 0 ? (() => {
                const total = cuesSortedForStageJump.length;
                const curIdx = selectedCueId
                  ? cuesSortedForStageJump.findIndex(
                      (c) => c.id === selectedCueId
                    )
                  : -1;
                const cur = curIdx >= 0 ? cuesSortedForStageJump[curIdx] : null;
                const canPrev =
                  project.viewMode !== "view" && curIdx > 0;
                const canNext =
                  project.viewMode !== "view" &&
                  curIdx >= 0 &&
                  curIdx < total - 1;
                const navBtnStyle = (enabled: boolean): CSSProperties => ({
                  width: "26px",
                  height: "26px",
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: enabled ? "#cbd5e1" : "#475569",
                  fontSize: "14px",
                  lineHeight: 1,
                  cursor: enabled ? "pointer" : "not-allowed",
                  flexShrink: 0,
                });
                return (
                  <div
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      flexShrink: 0,
                    }}
                    title="ステージのキュー（ページ）切替。タイムラインも区間の頭に移動します。"
                  >
                    <button
                      type="button"
                      onClick={() => jumpToCueByIdx(curIdx - 1)}
                      disabled={!canPrev}
                      title="前のキューへ"
                      aria-label="前のキューへ"
                      style={navBtnStyle(canPrev)}
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => setCuePagerListOpen((v) => !v)}
                      disabled={project.viewMode === "view"}
                      aria-haspopup="listbox"
                      aria-expanded={cuePagerListOpen}
                      title={
                        cur
                          ? cur.name?.trim()
                            ? `「${cur.name.trim()}」を編集中。クリックで全キュー一覧。`
                            : "無名のキューを編集中。クリックで全キュー一覧。"
                          : "クリックで全キュー一覧から選択"
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 9px",
                        borderRadius: "8px",
                        border: cur
                          ? "1px solid #818cf8"
                          : "1px solid #334155",
                        background: cur ? "rgba(99,102,241,0.18)" : "#0f172a",
                        color: cur ? "#e0e7ff" : "#94a3b8",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor:
                          project.viewMode === "view"
                            ? "not-allowed"
                            : "pointer",
                        flexShrink: 0,
                        minHeight: "26px",
                        maxWidth: "240px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          color: cur ? "#c7d2fe" : "#64748b",
                          letterSpacing: "0.04em",
                        }}
                      >
                        キュー
                      </span>
                      <span style={{ whiteSpace: "nowrap" }}>
                        {curIdx >= 0 ? curIdx + 1 : "—"} / {total}
                      </span>
                      {cur && cur.name?.trim() ? (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#e2e8f0",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "120px",
                          }}
                        >
                          {cur.name.trim()}
                        </span>
                      ) : null}
                      <span
                        aria-hidden
                        style={{
                          fontSize: "9px",
                          color: cur ? "#c7d2fe" : "#64748b",
                          marginLeft: "1px",
                        }}
                      >
                        ▾
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToCueByIdx(curIdx + 1)}
                      disabled={!canNext}
                      title="次のキューへ"
                      aria-label="次のキューへ"
                      style={navBtnStyle(canNext)}
                    >
                      ▶
                    </button>
                    {cuePagerListOpen ? (
                      <>
                        <div
                          onClick={() => setCuePagerListOpen(false)}
                          style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 30,
                          }}
                          aria-hidden
                        />
                        <ul
                          role="listbox"
                          aria-label="キュー一覧"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            left: "30px",
                            zIndex: 31,
                            listStyle: "none",
                            margin: 0,
                            padding: "4px",
                            maxHeight: "320px",
                            minWidth: "240px",
                            overflowY: "auto",
                            background: "#0b1220",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                          }}
                        >
                          {cuesSortedForStageJump.map((c, i) => {
                            const isCur = i === curIdx;
                            const fname =
                              project.formations.find(
                                (f) => f.id === c.formationId
                              )?.name ?? "";
                            return (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={isCur}
                                  onClick={() => {
                                    jumpToCueByIdx(i);
                                    setCuePagerListOpen(false);
                                  }}
                                  style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "5px 8px",
                                    border: "none",
                                    borderRadius: "6px",
                                    background: isCur
                                      ? "rgba(99,102,241,0.22)"
                                      : "transparent",
                                    color: isCur ? "#e0e7ff" : "#cbd5e1",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    fontWeight: isCur ? 700 : 500,
                                  }}
                                >
                                  <span
                                    style={{
                                      minWidth: "22px",
                                      fontVariantNumeric: "tabular-nums",
                                      color: isCur ? "#a5b4fc" : "#64748b",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {i + 1}
                                  </span>
                                  <span
                                    style={{
                                      flex: 1,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {c.name?.trim() ?? ""}
                                    {fname ? (
                                      <span
                                        style={{
                                          marginLeft: "6px",
                                          color: "#64748b",
                                          fontWeight: 400,
                                          fontSize: "10px",
                                        }}
                                      >
                                        · {fname}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      color: "#64748b",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {Math.round(c.tStartSec)}s
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : null}
                  </div>
                );
              })() : null}
              <button
                type="button"
                disabled={project.viewMode === "view"}
                title="舞台の大きさ・客席の位置・袖・バック・場ミリを編集"
                aria-haspopup="dialog"
                aria-expanded={stageSettingsOpen}
                onClick={() => setStageSettingsOpen(true)}
                style={{
                  fontSize: "11px",
                  lineHeight: 1.2,
                  padding: "3px 8px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#94a3b8",
                  cursor: project.viewMode === "view" ? "not-allowed" : "pointer",
                  flexShrink: 0,
                }}
              >
                ステージ設定
              </button>
              {(() => {
                const canGather =
                  project.viewMode !== "view" &&
                  (project.cues.length === 0 || Boolean(selectedCueId)) &&
                  (project.formations.find(
                    (x) => x.id === (selectedCue?.formationId ?? project.activeFormationId)
                  )?.dancers.length ?? 0) > 0;
                return (
                  <div
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      disabled={!canGather}
                      title="全員を前・奥・上手・下手へ寄せて整列（行を分けて重なりにくくします）。元に戻すは「戻る」"
                      aria-haspopup="menu"
                      aria-expanded={gatherMenuOpen}
                      onClick={() => setGatherMenuOpen((v) => !v)}
                      style={{
                        fontSize: "11px",
                        lineHeight: 1.2,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #334155",
                        background: "#0f172a",
                        color: "#94a3b8",
                        cursor: canGather ? "pointer" : "not-allowed",
                      }}
                    >
                      寄せる
                    </button>
                    {gatherMenuOpen ? (
                      <>
                        <div
                          onClick={() => setGatherMenuOpen(false)}
                          style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 30,
                          }}
                          aria-hidden
                        />
                        <div
                          role="menu"
                          aria-label="寄せる方向"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            left: 0,
                            zIndex: 31,
                            minWidth: "220px",
                            padding: "6px",
                            background: "#0b1220",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                          }}
                        >
                          {GATHER_TOWARD_OPTIONS.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              role="menuitem"
                              onClick={() => applyGatherToward(o.id)}
                              title={o.hint}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 10px",
                                marginBottom: "2px",
                                borderRadius: "6px",
                                border: "1px solid #1e293b",
                                background: "#0f172a",
                                color: "#e2e8f0",
                                fontSize: "12px",
                                cursor: "pointer",
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{o.label}</span>
                              <span
                                style={{
                                  display: "block",
                                  marginTop: "2px",
                                  fontSize: "10px",
                                  color: "#64748b",
                                  fontWeight: 400,
                                }}
                              >
                                {o.hint}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })()}
              {wideEditorLayout ? (
                <button
                  type="button"
                  onClick={() => setRightPaneCollapsed((v) => !v)}
                  aria-pressed={rightPaneCollapsed}
                  aria-label={
                    rightPaneCollapsed
                      ? "キュー一覧／プロパティを表示"
                      : "キュー一覧／プロパティを隠してステージを最大化"
                  }
                  title={
                    rightPaneCollapsed
                      ? "キュー一覧／プロパティを表示"
                      : "キュー一覧／プロパティを隠してステージを最大化"
                  }
                  style={{
                    fontSize: "11px",
                    lineHeight: 1,
                    padding: "4px 7px",
                    borderRadius: "6px",
                    border: rightPaneCollapsed
                      ? "1px solid #14532d"
                      : "1px solid #334155",
                    background: rightPaneCollapsed
                      ? "rgba(34,197,94,0.18)"
                      : "#0f172a",
                    color: rightPaneCollapsed ? "#bbf7d0" : "#94a3b8",
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <svg
                    viewBox="0 0 16 12"
                    width="16"
                    height="12"
                    aria-hidden
                    style={{ display: "block" }}
                  >
                    <circle cx="2.5" cy="2.5" r="1" fill="currentColor" />
                    <line
                      x1="5"
                      y1="2.5"
                      x2="13.5"
                      y2="2.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <circle cx="2.5" cy="6" r="1" fill="currentColor" />
                    <line
                      x1="5"
                      y1="6"
                      x2="13.5"
                      y2="6"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <circle cx="2.5" cy="9.5" r="1" fill="currentColor" />
                    <line
                      x1="5"
                      y1="9.5"
                      x2="13.5"
                      y2="9.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span aria-hidden style={{ fontSize: "13px", lineHeight: 1, fontWeight: 700 }}>
                    {rightPaneCollapsed ? "‹" : "›"}
                  </span>
                </button>
              ) : null}
              {project.cues.length === 0 ? (
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  キューなし（フォーメーションを直接編集）
                </span>
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
              title="右のタイムラインでキューを選ぶと、その区間の立ち位置を編集します。再生中は区間の隙間のみ補間表示されます。"
            >
              <div
                style={{
                  width: "1px",
                  height: "22px",
                  background: "#334155",
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <button
                type="button"
                style={btnSecondary}
                disabled={project.viewMode === "view" || historyRef.current.undo.length === 0}
                title="編集を元に戻す（⌘Z / Ctrl+Z）"
                aria-label="元に戻す"
                onClick={() => undo()}
              >
                戻る
              </button>
              <button
                type="button"
                style={btnSecondary}
                disabled={project.viewMode === "view" || historyRef.current.redo.length === 0}
                title="やり直す（⌘⇧Z / Ctrl+Shift+Z）"
                aria-label="やり直す"
                onClick={() => redo()}
              >
                進む
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  borderColor: "#0284c7",
                  background: "#0ea5e9",
                  color: "#0b1220",
                  padding: "6px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontWeight: 700,
                }}
                disabled={project.viewMode === "view"}
                title="＋キュー：人数と立ち位置の決め方（変更／複製／雛形／保存リスト）を選んで追加"
                aria-label="新しいキューを追加"
                onClick={() => setAddCueDialogOpen(true)}
              >
                <svg
                  viewBox="0 0 22 14"
                  width="22"
                  height="14"
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
                  <circle cx="13.5" cy="12" r="1" fill="currentColor" opacity="0.7" />
                  <circle cx="16.5" cy="12" r="1" fill="currentColor" opacity="0.7" />
                </svg>
                <span style={{ fontSize: "12px", fontWeight: 700 }}>キュー</span>
              </button>
              {(() => {
                const editFid =
                  selectedCue?.formationId ?? project.activeFormationId;
                const editFormation = project.formations.find(
                  (x) => x.id === editFid
                );
                const canSaveSpots =
                  project.viewMode !== "view" &&
                  (editFormation?.dancers.length ?? 0) > 0;
                const saveSpotsHint =
                  project.viewMode === "view"
                    ? "閲覧モードでは使えません"
                    : (editFormation?.dancers.length ?? 0) === 0
                      ? "いまのフォーメーションにダンサーがいません"
                      : "いまステージの形をそのまま「形の箱」に保存";
                return (
                  <div
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        borderColor: "#1e3a8a",
                        color: "#bfdbfe",
                        padding: "6px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                      title="流れ（キュー並び）か、いまの立ち位置（形の箱）を保存"
                      aria-haspopup="menu"
                      aria-expanded={saveMenuOpen}
                      onClick={() => setSaveMenuOpen((v) => !v)}
                    >
                      <svg
                        viewBox="0 0 18 14"
                        width="18"
                        height="14"
                        aria-hidden
                        style={{ display: "block" }}
                      >
                        <circle cx="2.5" cy="7" r="1.4" fill="currentColor" />
                        <path
                          d="M4 7 L7 7"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                        <circle cx="9" cy="7" r="1.4" fill="currentColor" />
                        <path
                          d="M10.5 7 L13.5 7"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                        <circle cx="15.5" cy="7" r="1.4" fill="currentColor" />
                      </svg>
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>
                        保存
                      </span>
                      <span
                        aria-hidden
                        style={{
                          fontSize: "10px",
                          color: "#93c5fd",
                          marginLeft: "1px",
                        }}
                      >
                        ▾
                      </span>
                    </button>
                    {saveMenuOpen ? (
                      <>
                        <div
                          onClick={() => setSaveMenuOpen(false)}
                          style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 30,
                          }}
                          aria-hidden
                        />
                        <div
                          role="menu"
                          aria-label="保存の種類"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            right: 0,
                            zIndex: 31,
                            minWidth: "260px",
                            padding: "6px",
                            background: "#0b1220",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                          }}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setSaveMenuOpen(false);
                              setFlowLibraryOpen(true);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 10px",
                              marginBottom: "4px",
                              borderRadius: "6px",
                              border: "1px solid #1e3a8a",
                              background: "#0f172a",
                              color: "#e2e8f0",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              今までの流れを保存
                            </span>
                            <span
                              style={{
                                display: "block",
                                marginTop: "3px",
                                fontSize: "10px",
                                color: "#64748b",
                                fontWeight: 400,
                              }}
                            >
                              作ったキューの並び（立ち位置の流れ）を名前をつけて端末に保存・呼び出し
                            </span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={!canSaveSpots}
                            onClick={() => {
                              setSaveMenuOpen(false);
                              saveStageToFormationBox();
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 10px",
                              borderRadius: "6px",
                              border: "1px solid #14532d",
                              background: "#0f172a",
                              color: "#e2e8f0",
                              fontSize: "12px",
                              cursor: canSaveSpots ? "pointer" : "not-allowed",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              作った立ち位置を保存
                            </span>
                            <span
                              style={{
                                display: "block",
                                marginTop: "3px",
                                fontSize: "10px",
                                color: "#64748b",
                                fontWeight: 400,
                              }}
                            >
                              {saveSpotsHint}
                            </span>
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })()}
              <button
                type="button"
                style={btnSecondary}
                disabled={project.viewMode === "view"}
                title="選択中のフォーメーションにダンサーを1人追加（中央付近）"
                onClick={() => addDancerFromStageToolbar()}
              >
                ＋ダンサー
              </button>
              <button
                type="button"
                style={btnSecondary}
                disabled={project.viewMode === "view"}
                title="CSV / TSV を選んで新しい名簿として取り込みます（1 列目または「名前」などの見出しを検出）"
                onClick={() => importCrewCsvFromStageToolbar()}
              >
                名簿取り込み
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  borderColor: "#713f12",
                  color: "#fde68a",
                }}
                disabled={
                  project.viewMode === "view" ||
                  (project.cues.length > 0 && !selectedCueId)
                }
                title="画像の文字と位置を読み取り、名簿に追加して選択中フォーメーションへ立ち位置として追加します"
                onClick={() => setImageSpotImportOpen(true)}
              >
                画像から追加
              </button>
              <div
                style={{
                  width: "1px",
                  height: "22px",
                  background: "#334155",
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  style={{
                    ...btnSecondary,
                    ...(stageView === "2d"
                      ? { borderColor: "#6366f1", color: "#c7d2fe" }
                      : {}),
                  }}
                  onClick={() => setStageView("2d")}
                >
                  2D
                </button>
                <button
                  type="button"
                  style={{
                    ...btnSecondary,
                    ...(stageView === "3d"
                      ? { borderColor: "#6366f1", color: "#c7d2fe" }
                      : {}),
                  }}
                  onClick={() => setStageView("3d")}
                >
                  3D
                </button>
                {hasRosterMembers ? (
                  <button
                    type="button"
                    disabled={project.viewMode === "view"}
                    title="右列で名簿一覧を表示し、タイムライン列は隠します"
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
                        project.viewMode === "view"
                          ? "not-allowed"
                          : "pointer",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    メンバーを表示
                  </button>
                ) : null}
              </div>
            </div>
            </div>
            {/* 2 行目: 設定（印の直径 / グリッド / 実寸） */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10px",
                flexWrap: "wrap",
                rowGap: "6px",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "#94a3b8",
                  cursor: project.viewMode === "view" ? "default" : "pointer",
                  userSelect: "none",
                }}
              >
                <span style={{ whiteSpace: "nowrap" }}>印の直径</span>
                <input
                  type="range"
                  min={20}
                  max={120}
                  step={1}
                  value={Math.max(
                    20,
                    Math.min(120, Math.round(project.dancerMarkerDiameterPx ?? 44))
                  )}
                  disabled={project.viewMode === "view"}
                  onChange={(e) =>
                    setProjectSafe((p) => ({
                      ...p,
                      dancerMarkerDiameterPx: Number(e.target.value),
                    }))
                  }
                  aria-label="ダンサー印の直径（ピクセル）"
                  style={{ width: "88px", verticalAlign: "middle" }}
                />
                <span style={{ color: "#cbd5e1", minWidth: "38px", fontVariantNumeric: "tabular-nums" }}>
                  {Math.max(
                    20,
                    Math.min(120, Math.round(project.dancerMarkerDiameterPx ?? 44))
                  )}
                  px
                </span>
              </label>
              <label
                title="立ち位置の名前を○の中に出すか、○の下に出すかを切り替え"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                  color: "#94a3b8",
                  cursor: project.viewMode === "view" ? "default" : "pointer",
                  userSelect: "none",
                }}
              >
                <span style={{ whiteSpace: "nowrap" }}>名前</span>
                <select
                  value={project.dancerLabelPosition ?? "inside"}
                  disabled={project.viewMode === "view"}
                  onChange={(e) =>
                    setProjectSafe((p) => ({
                      ...p,
                      dancerLabelPosition:
                        e.target.value === "below" ? "below" : "inside",
                    }))
                  }
                  aria-label="立ち位置の名前の表示位置"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: "12px",
                  }}
                >
                  <option value="inside">○の中</option>
                  <option value="below">○の下</option>
                </select>
              </label>
              <div
                style={{
                  width: "1px",
                  height: "22px",
                  background: "#334155",
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  color: "#94a3b8",
                  cursor: project.viewMode === "view" ? "default" : "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={project.snapGrid}
                  disabled={project.viewMode === "view"}
                  onChange={(e) =>
                    setProjectSafe((p) => ({ ...p, snapGrid: e.target.checked }))
                  }
                />
                グリッド
              </label>
              <select
                value={project.gridStep}
                onChange={(e) =>
                  setProjectSafe((p) => ({
                    ...p,
                    gridStep: Number(e.target.value),
                  }))
                }
                disabled={!project.snapGrid || project.viewMode === "view"}
                aria-label="グリッド間隔（%）"
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: "12px",
                }}
              >
                <option value={0.5}>0.5%</option>
                <option value={1}>1%</option>
                <option value={2}>2%</option>
                <option value={5}>5%</option>
                <option value={10}>10%</option>
              </select>
              <label
                title={
                  project.stageWidthMm != null && project.stageWidthMm > 0
                    ? "実寸（メートル）で間隔を指定（ステージ幅に連動）"
                    : "ステージ幅を設定すると実寸で指定できます"
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "#94a3b8",
                  userSelect: "none",
                }}
              >
                <span style={{ whiteSpace: "nowrap" }}>実寸</span>
                <select
                  value={project.gridSpacingMm ?? 0}
                  disabled={
                    project.viewMode === "view" ||
                    !(project.stageWidthMm != null && project.stageWidthMm > 0)
                  }
                  onChange={(e) => {
                    const mm = Number(e.target.value);
                    setProjectSafe((p) => {
                      if (!mm || mm <= 0) {
                        return { ...p, gridSpacingMm: undefined };
                      }
                      return { ...p, gridSpacingMm: mm, snapGrid: true };
                    });
                  }}
                  aria-label="スナップ間隔（メートル）"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: "12px",
                  }}
                >
                  <option value={0}>—</option>
                  <option value={300}>30 cm</option>
                  <option value={500}>50 cm</option>
                  <option value={1000}>1 m</option>
                  <option value={1500}>1.5 m</option>
                  <option value={2000}>2 m</option>
                  <option value={3000}>3 m</option>
                </select>
              </label>
              <label
                title={
                  project.stageWidthMm != null && project.stageWidthMm > 0
                    ? "ダンサー隣同士の間隔（流派の場ミリ規格）。\n偶数人はセンターを「割って」±半 step、奇数人はセンター乗せで自動配置されます。\n「＋ダンサー」「フォーメーション案」「ドラッグ吸着」「規格ドット表示」が連動。"
                    : "ステージ幅を設定すると流派の場ミリ規格を選べます"
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "#94a3b8",
                  userSelect: "none",
                }}
              >
                <span style={{ whiteSpace: "nowrap" }}>規格</span>
                <select
                  value={(() => {
                    const v = project.dancerSpacingMm;
                    if (v == null || v <= 0) return 0;
                    return DANCER_SPACING_PRESET_OPTIONS.some((o) => o.mm === v)
                      ? v
                      : -1;
                  })()}
                  disabled={
                    project.viewMode === "view" ||
                    !(project.stageWidthMm != null && project.stageWidthMm > 0)
                  }
                  onChange={(e) => {
                    const mm = Number(e.target.value);
                    setProjectSafe((p) => {
                      if (!mm || mm <= 0) {
                        return { ...p, dancerSpacingMm: undefined };
                      }
                      return { ...p, dancerSpacingMm: mm };
                    });
                  }}
                  aria-label="ダンサー隣同士の間隔（場ミリ規格）"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: "12px",
                  }}
                >
                  <option value={0}>—</option>
                  {DANCER_SPACING_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.mm} value={opt.mm}>
                      {opt.label}
                    </option>
                  ))}
                  <option value={-1} disabled hidden>
                    カスタム
                  </option>
                </select>
                <input
                  type="number"
                  min={20}
                  max={500}
                  step={5}
                  value={
                    project.dancerSpacingMm != null && project.dancerSpacingMm > 0
                      ? Math.round(project.dancerSpacingMm / 10)
                      : ""
                  }
                  onChange={(e) => {
                    const cm = Number(e.target.value);
                    setProjectSafe((p) => {
                      if (!Number.isFinite(cm) || cm <= 0) {
                        return { ...p, dancerSpacingMm: undefined };
                      }
                      const mm = Math.max(200, Math.min(5000, Math.round(cm * 10)));
                      return { ...p, dancerSpacingMm: mm };
                    });
                  }}
                  disabled={
                    project.viewMode === "view" ||
                    !(project.stageWidthMm != null && project.stageWidthMm > 0)
                  }
                  placeholder="cm"
                  aria-label="場ミリ規格をカスタム入力（cm）"
                  title="cm 単位でカスタム指定。例: 150 → 1.5 m 間隔"
                  style={{
                    width: "52px",
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    textAlign: "right",
                  }}
                />
                <span
                  style={{ fontSize: "10px", color: "#64748b", whiteSpace: "nowrap" }}
                  aria-hidden
                >
                  cm
                </span>
              </label>
              <label
                title={
                  project.stageWidthMm != null && project.stageWidthMm > 0
                    ? "○の直径を実寸（メートル）で指定（ステージ幅に連動）"
                    : "ステージ幅を設定すると実寸で指定できます"
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "#94a3b8",
                  userSelect: "none",
                }}
              >
                <span style={{ whiteSpace: "nowrap" }}>○実寸</span>
                <select
                  value={project.dancerMarkerDiameterMm ?? 0}
                  disabled={
                    project.viewMode === "view" ||
                    !(project.stageWidthMm != null && project.stageWidthMm > 0)
                  }
                  onChange={(e) => {
                    const mm = Number(e.target.value);
                    setProjectSafe((p) => {
                      if (!mm || mm <= 0) {
                        return { ...p, dancerMarkerDiameterMm: undefined };
                      }
                      return { ...p, dancerMarkerDiameterMm: mm };
                    });
                  }}
                  aria-label="○の直径（メートル）"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: "12px",
                  }}
                >
                  <option value={0}>—</option>
                  <option value={300}>30 cm</option>
                  <option value={500}>50 cm</option>
                  <option value={750}>75 cm</option>
                  <option value={1000}>1 m</option>
                  <option value={1500}>1.5 m</option>
                </select>
              </label>
            </div>
          </div>
          {stageView === "2d" ? (
            <StageBoard
              project={project}
              setProject={setProjectSafe}
              playbackDancers={playbackDancersForStage}
              browseFormationDancers={browseFormationDancers}
              previewDancers={stagePreviewDancers}
              playbackSetPieces={playbackSetPiecesForStage}
              browseSetPieces={browseSetPieces}
              isPlaying={isPlaying}
              onStopPlaybackRequest={onStopPlaybackFromStage}
              editFormationId={
                selectedCue?.formationId ?? project.activeFormationId
              }
              stageInteractionsEnabled={
                project.viewMode !== "view" &&
                (project.cues.length === 0 || Boolean(selectedCueId))
              }
            />
          ) : (
            <Suspense
              fallback={
                <div style={{ padding: 24, color: "#64748b", fontSize: "13px" }}>
                  3D ビューを読み込み中…
                </div>
              }
            >
              <Stage3DView
                dancers={dancersFor3d}
                markerDiameterPx={project.dancerMarkerDiameterPx ?? 44}
              />
            </Suspense>
          )}
        </section>

        {wideEditorLayout && !rightPaneCollapsed ? (
          <div
            className="editor-pane-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="ステージとタイムラインの幅を調整"
            title="ドラッグでステージとタイムラインの幅を変更"
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
              gridColumn: 3,
              gridRow: showTopWaveDock ? 3 : 1,
            }}
          />
        ) : null}

        {rightPaneCollapsed && wideEditorLayout ? null : wideEditorLayout && showTopWaveDock ? (
          <div
            ref={rightPaneStackRef}
            style={{
              gridColumn: 4,
              gridRow: 3,
              display: "flex",
              flexDirection: "column",
              gap: 0,
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {rosterOnlyMode ? (
              <RosterTimelineStrip project={project} setProject={setProjectSafe} />
            ) : null}
            <section
              style={{
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                ...rightPaneTopSectionStyle,
              }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: "13px", color: "#94a3b8" }}>
                キュー一覧
              </h2>
              <div
                ref={setCueListPortalEl}
                style={{
                  flex: "1 1 auto",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              />
            </section>
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="キュー一覧とプロパティの高さを調整"
              title="ドラッグで高さを変更（ダブルクリックで既定の割合に戻す）"
              onPointerDown={onRightStackResizeDown}
              onPointerMove={onRightStackResizeMove}
              onPointerUp={endRightStackResize}
              onPointerCancel={endRightStackResize}
              onLostPointerCapture={onRightStackResizeLostCapture}
              onDoubleClick={onRightStackResizeDoubleClick}
              style={{
                flexShrink: 0,
                height: 4,
                cursor: "row-resize",
                touchAction: "none",
                userSelect: "none",
                position: "relative",
                zIndex: 2,
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
            <section
              style={{
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                ...rightPaneBottomSectionStyle,
              }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: "13px", color: "#94a3b8" }}>
                プロパティ
              </h2>
              <InspectorPanel
                project={project}
                setProject={setProjectSafe}
                stageLayoutEditMode={false}
                formationEditTargetId={
                  selectedCue?.formationId ?? project.activeFormationId
                }
                onInspectorFormationSelect={onInspectorFormationSelect}
                selectedCue={selectedCue}
                onLibraryHoverPreview={setStagePreviewDancers}
              />
            </section>
          </div>
        ) : (
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
                ? { gridColumn: 4, gridRow: 1 }
                : {}),
            }}
          >
            {rosterOnlyMode ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  ...rightPaneTopSectionStyle,
                }}
              >
                <RosterTimelineStrip
                  project={project}
                  setProject={setProjectSafe}
                />
              </div>
            ) : null}
            {!rosterOnlyMode ? (
            <section
              style={{
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                ...rightPaneTopSectionStyle,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  marginBottom: "8px",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minWidth: 0,
                    flexWrap: "wrap",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "#94a3b8",
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
                    title="＋キュー：人数と立ち位置の決め方（変更／複製／雛形／保存リスト）を選んで追加"
                    aria-label="新しいキューを追加"
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
                      <circle cx="13.5" cy="12" r="1" fill="currentColor" opacity="0.7" />
                      <circle cx="16.5" cy="12" r="1" fill="currentColor" opacity="0.7" />
                    </svg>
                    <span style={{ fontSize: "11px", fontWeight: 700 }}>キュー</span>
                  </button>
                  {wideEditorLayout ? (
                    <button
                      type="button"
                      style={{
                        ...btnSecondary,
                        padding: "5px 9px",
                        fontSize: "11px",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                      disabled={project.viewMode === "view"}
                      title={
                        waveTimelineDockTop
                          ? "波形と再生コントロールを右列の既定位置に戻す"
                          : "波形と再生コントロールを画面上部の全幅行に移す（キュー一覧は右列に残ります）"
                      }
                      onClick={() =>
                        setWaveTimelineDockTop(!waveTimelineDockTop)
                      }
                    >
                      {waveTimelineDockTop
                        ? "波形を元に戻す"
                        : "波形を上部へ"}
                    </button>
                  ) : null}
                </div>
                {hasRosterMembers ? (
                  <button
                    type="button"
                    disabled={project.viewMode === "view"}
                    title="名簿一覧を表示し、タイムライン列は隠します"
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
                    }}
                  >
                    メンバーを表示
                  </button>
                ) : null}
              </div>
              <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
                {timelinePanelEl}
              </div>
            </section>
            ) : null}
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label={
                rosterOnlyMode
                  ? "名簿とプロパティの高さを調整"
                  : "タイムラインとプロパティの高さを調整"
              }
              title="ドラッグで高さを変更（ダブルクリックで既定の割合に戻す）"
              onPointerDown={onRightStackResizeDown}
              onPointerMove={onRightStackResizeMove}
              onPointerUp={endRightStackResize}
              onPointerCancel={endRightStackResize}
              onLostPointerCapture={onRightStackResizeLostCapture}
              onDoubleClick={onRightStackResizeDoubleClick}
              style={{
                flexShrink: 0,
                height: 4,
                cursor: "row-resize",
                touchAction: "none",
                userSelect: "none",
                position: "relative",
                zIndex: 2,
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
            <section
              style={{
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                ...rightPaneBottomSectionStyle,
              }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: "13px", color: "#94a3b8" }}>
                プロパティ
              </h2>
              <InspectorPanel
                project={project}
                setProject={setProjectSafe}
                stageLayoutEditMode={false}
                formationEditTargetId={
                  selectedCue?.formationId ?? project.activeFormationId
                }
                onInspectorFormationSelect={onInspectorFormationSelect}
                selectedCue={selectedCue}
                onLibraryHoverPreview={setStagePreviewDancers}
              />
            </section>
          </div>
        )}
      </div>

      {stageSettingsOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(15, 23, 42, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setStageSettingsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-settings-dialog-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "520px",
              maxHeight: "min(90vh, 680px)",
              overflow: "auto",
              background: "#0f172a",
              borderRadius: "12px",
              border: "1px solid #334155",
              padding: "16px 18px 18px",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
            }}
          >
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
                aria-label="閉じる"
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
        </div>
      ) : null}

      {shortcutsHelpOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(15, 23, 42, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShortcutsHelpOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-dialog-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "480px",
              maxHeight: "min(88vh, 560px)",
              overflow: "auto",
              background: "#0f172a",
              borderRadius: "12px",
              border: "1px solid #334155",
              padding: "16px 18px 18px",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
            }}
          >
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
                aria-label="閉じる"
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
                で細かいグリッドにスナップ（グリッドON時）
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
                大道具: ツールバー「大道具」から図形・色を選んで追加。削除は{" "}
                <strong style={{ color: "#e2e8f0" }}>Delete / Backspace</strong>（選択中）または{" "}
                <strong style={{ color: "#e2e8f0" }}>右クリック → 削除</strong>
              </li>
              <li>
                タイムライン: 波形で <strong style={{ color: "#e2e8f0" }}>⌘／Ctrl+クリック</strong>{" "}
                でキュー複数選択、<strong style={{ color: "#e2e8f0" }}>Delete</strong>{" "}
                で一括削除（Undo 可）
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
        </div>
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

      {project ? (
        <ImageSpotImportDialog
          open={imageSpotImportOpen}
          onClose={() => setImageSpotImportOpen(false)}
          disabled={
            project.viewMode === "view" ||
            (project.cues.length > 0 && !selectedCueId)
          }
          onCommit={commitImageSpotImport}
        />
      ) : null}

      {project ? (
        <ExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          project={project}
          projectName={projectName}
          stage2dVisible={stageView === "2d"}
        />
      ) : null}

      {project ? (
        <FlowLibraryDialog
          open={flowLibraryOpen}
          onClose={() => setFlowLibraryOpen(false)}
          project={project}
          setProject={setProjectSafe}
          audioDurationSec={duration}
        />
      ) : null}

      {project ? (
        <AddCueWithFormationDialog
          open={addCueDialogOpen}
          onClose={() => setAddCueDialogOpen(false)}
          project={project}
          setProject={setProjectSafe}
          currentTimeSec={currentTime}
          durationSec={duration}
          onStagePreviewChange={setStagePreviewDancers}
          onImportRoster={importCrewCsvFromStageToolbar}
          onCueCreated={(cueId) => {
            setSelectedCueIds([cueId]);
            setIsPlaying(false);
          }}
        />
      ) : null}

      {project && rosterImportDraft ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          role="presentation"
          onClick={() => {
            setRosterImportDraft(null);
            setRosterImportExtraNames([]);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="名簿取り込みの表示名"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(440px, 100%)",
              borderRadius: "12px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#e2e8f0",
              padding: "18px 20px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>
              名簿を取り込みます
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
              {labelForKind(rosterImportDraft.kind)}「{rosterImportDraft.baseName}」
              <br />
              ステージ上の表示は最大 8 文字です。同じ名前が複数あるときは、該当する全員に苗字の先頭 1 文字を前に付けて区別します。
              <br />
              見出しに「出欠」「参加」「出席」などがあるとき、または氏名の左右の列が ○・参加・出席 などで埋まっているときは、その列で参加行だけを名簿に含めます。
              見出しに「フリガナ」「読み」「セイ」「メイ」などがあり、読みに姓と名が分かるときは「名の読み」を表示のベースにし、苗字の読みの先頭 1 文字を付けた短い名前（例: さかい+たけし→さたけし）にします。
            </p>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "8px" }}>
              表示名の取り込み方
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                marginBottom: "8px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              <input
                type="radio"
                name="roster-import-name-mode"
                checked={rosterImportNameMode === "full"}
                onChange={() => setRosterImportNameMode("full")}
              />
              <span>
                <strong>フルネーム</strong>
                <span style={{ display: "block", fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  姓＋名・氏名列などをそのまま短く表示（従来に近い）
                </span>
              </span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                marginBottom: "16px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              <input
                type="radio"
                name="roster-import-name-mode"
                checked={rosterImportNameMode === "given_only"}
                onChange={() => setRosterImportNameMode("given_only")}
              />
              <span>
                <strong>名だけ</strong>
                <span style={{ display: "block", fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  見出しに「姓」「名」列があると確実です。1 列だけのときは、先頭の漢字を除く簡易推定やスペース区切りの末尾を使います。
                </span>
              </span>
            </label>
            <div
              style={{
                marginBottom: "14px",
                paddingTop: "10px",
                borderTop: "1px solid #334155",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: "8px",
                }}
              >
                ファイルにない人を追加（任意）
              </div>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "11px",
                  color: "#64748b",
                  lineHeight: 1.45,
                }}
              >
                取り込み後も名簿で編集できます。ここでは表示名だけを足せます。
              </p>
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
                  setProjectSafe((p) => ({
                    ...p,
                    crews: [...p.crews, crew],
                    rosterStripCollapsed: false,
                    rosterHidesTimeline: true,
                  }));
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
        </div>
      ) : null}

      <style>{`
        @media (max-width: 1279px) {
          .editor-three-pane {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto auto !important;
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
    </div>
  );
}
