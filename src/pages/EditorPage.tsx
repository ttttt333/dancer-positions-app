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
import { StageBoard, type FloorTextPlaceSession } from "../components/StageBoard";
import { StageDimensionFields } from "../components/StageDimensionFields";
const Stage3DView = lazy(() =>
  import("../components/Stage3DView").then((m) => ({ default: m.Stage3DView }))
);
import { TimelinePanel, type TimelinePanelHandle } from "../components/TimelinePanel";
import { RosterTimelineStrip } from "../components/RosterTimelineStrip";
import { createEmptyProject, tryMigrateFromLocalStorage } from "../lib/projectDefaults";
import { preloadFFmpeg } from "../lib/extractVideoAudio";
import { normalizeProject } from "../lib/normalizeProject";
import { modDancerColorIndex } from "../lib/dancerColorPalette";
import { sortCuesByStart } from "../lib/cueInterval";
import { dancersAtTime } from "../lib/interpolatePlayback";
import { floorMarkupAtTime, setPiecesAtTime } from "../lib/interpolateSetPieces";
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
import {
  SetPiecePickerModal,
  type SetPiecePickerSubmit,
} from "../components/SetPiecePickerModal";
import { ChoreoGridToolbar } from "../components/ChoreoGridToolbar";
import {
  EditorStageWorkbench,
  type EditorStageWorkbenchProps,
} from "../components/EditorStageWorkbench";
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
import { useI18n } from "../i18n/I18nContext";
import { btnAccent, btnSecondary, inputField } from "../components/stageButtonStyles";
import { panelCard, shell } from "../theme/choreoShell";
import { useYjsCollaboration } from "../hooks/useYjsCollaboration";
import {
  captureStageSnapshot,
  mergeStageSnapshotIntoProject,
} from "../lib/savedSpotStageSnapshot";

const HISTORY_CAP = 80;

const EDITOR_WIDE_MIN_PX = 1280;
/** メイン 4 列グリッドの列間（ステージ〜タイムラインのすき間に効く） */
const EDITOR_GRID_GAP_PX = 6;
/** ステージ列とタイムライン列の間のドラッグ幅 */
const STAGE_RESIZER_PX = 4;
const STAGE_COL_MIN_PX = 280;
const TIMELINE_COL_MIN_PX = 260;
/** 右ペイン：タイムライン（またはキュー一覧）の縦スタック */

/** ステージ「設定」パネル：客席方向（`StageDimensionFields` と同じ 4 択） */
const STAGE_AREA_AUDIENCE_OPTIONS: {
  value: ChoreographyProjectJson["audienceEdge"];
  label: string;
}[] = [
  { value: "top", label: "上" },
  { value: "right", label: "右" },
  { value: "bottom", label: "下" },
  { value: "left", label: "左" },
];

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
  const gapsBetween3Cols = 2 * gap;
  return (
    rect.width -
    padX -
    gapsBetween3Cols -
    STAGE_RESIZER_PX -
    TIMELINE_COL_MIN_PX
  );
}

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { me, ready: authReady } = useAuth();
  const { t } = useI18n();
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
   * 右ペイン（タイムライン／右ツール列）を畳んでステージを最大化するトグル。
   * 畳んでもステージ上にグリッド用ツールバーが出るほか、ステージ上部のページャーから
   * キュー切替は引き続き可能。狭いビューポート（!wideEditorLayout）では無効。
   */
  const [rightPaneCollapsed, setRightPaneCollapsed] = useState(false);
  const timelineRef = useRef<TimelinePanelHandle>(null);
  const [stageSettingsOpen, setStageSettingsOpen] = useState(false);
  const [gatherMenuOpen, setGatherMenuOpen] = useState(false);
  /** 保存メニュー（流れ / 立ち位置） */
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  /** ステージ列ヘッダの「設定」：舞台・グリッド・名前・共有・ヒントを集約 */
  const [stageAreaSettingsOpen, setStageAreaSettingsOpen] = useState(false);
  const [shareLinkCopiedFlash, setShareLinkCopiedFlash] = useState(false);
  const shareCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  /** ワイド＋タイムライン表示時: キュー一覧モーダルの開閉（一覧本体はポータルで描画） */
  const [cueListModalOpen, setCueListModalOpen] = useState(false);
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
  /** 2D/3D ステージ床の表示領域（全画面 API の対象） */
  const stageBoardHostRef = useRef<HTMLDivElement>(null);
  const [stageBoardFullscreen, setStageBoardFullscreen] = useState(false);
  /** ステージ床テキスト：ヘッダから入力→プレビュー→完了で設置 */
  const [floorTextPlaceSession, setFloorTextPlaceSession] =
    useState<FloorTextPlaceSession | null>(null);
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
    /** 新規は API・ログイン不要のため認証待ちを挟まず即表示（立ち上げ短縮） */
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
      setPlainProject(null);
      setLoadError("無効な ID");
      return;
    }

    /** 共同編集だけ「未ログイン」と区別するために認証確定を待つ */
    if (collabParam) {
      if (!authReady) {
        setPlainProject(null);
        setLoadError(null);
        return;
      }
      if (!me) {
        setPlainProject(null);
        setLoadError("共同編集にはログインが必要です");
        return;
      }
    }

    let cancelled = false;
    (async () => {
      setPlainProject(null);
      setLoadError(null);
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
      setTopDockRowPx(null);
    }
  }, [wideEditorLayout]);

  useEffect(() => {
    const syncFs = () => {
      const el = stageBoardHostRef.current;
      if (!el) {
        setStageBoardFullscreen(false);
        return;
      }
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      const fs =
        document.fullscreenElement === el || doc.webkitFullscreenElement === el;
      setStageBoardFullscreen(Boolean(fs));
    };
    document.addEventListener("fullscreenchange", syncFs);
    document.addEventListener(
      "webkitfullscreenchange",
      syncFs as EventListener
    );
    return () => {
      document.removeEventListener("fullscreenchange", syncFs);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncFs as EventListener
      );
    };
  }, []);

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

  const rightPaneTopSectionStyle = useMemo(
    (): CSSProperties => ({
      flex: 1,
      minHeight: 0,
      minWidth: 0,
    }),
    []
  );

  const editorGridColumns = wideEditorLayout
    ? rightPaneCollapsed
      ? "1fr"
      : stageColumnPx == null
        ? `minmax(${STAGE_COL_MIN_PX}px, 2fr) ${STAGE_RESIZER_PX}px minmax(${TIMELINE_COL_MIN_PX}px, 1fr)`
        : `${Math.round(stageColumnPx)}px ${STAGE_RESIZER_PX}px minmax(${TIMELINE_COL_MIN_PX}px, 1fr)`
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

  const toggleStageBoardFullscreen = useCallback(() => {
    const el = stageBoardHostRef.current;
    if (!el) return;
    const doc = document as Document & {
      fullscreenElement?: Element | null;
      webkitFullscreenElement?: Element | null;
      exitFullscreen?: () => Promise<void>;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const isFs =
      doc.fullscreenElement === el || doc.webkitFullscreenElement === el;
    if (isFs) {
      if (typeof doc.exitFullscreen === "function") void doc.exitFullscreen();
      else if (typeof doc.webkitExitFullscreen === "function")
        void doc.webkitExitFullscreen();
      return;
    }
    const anyEl = el as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => void;
    };
    if (typeof anyEl.requestFullscreen === "function") void anyEl.requestFullscreen();
    else if (typeof anyEl.webkitRequestFullscreen === "function")
      anyEl.webkitRequestFullscreen();
  }, []);

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
      if (e.key === "Escape" && gatherMenuOpen) {
        setGatherMenuOpen(false);
        return;
      }
      if (e.key === "Escape" && stageAreaSettingsOpen) {
        setStageAreaSettingsOpen(false);
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
      if (e.key === "Escape" && cueListModalOpen) {
        setCueListModalOpen(false);
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
    gatherMenuOpen,
    stageAreaSettingsOpen,
    stageSettingsOpen,
    shortcutsHelpOpen,
    exportDialogOpen,
    flowLibraryOpen,
    cuePagerListOpen,
    rosterImportDraft,
    cueListModalOpen,
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

  const interpolatedFloorMarkup = useMemo(() => {
    if (!project || project.cues.length === 0) return null;
    return floorMarkupAtTime(
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

  useEffect(() => {
    lastFormationIdForStageRef.current = null;
  }, [projectId]);

  /**
   * フォーメーション（ページ）を切り替えたとき、直前ページの舞台設定を `stageSnapshot` に保存し、
   * 次のページに保存済みがあればプロジェクトの舞台へ復元する。
   */
  useEffect(() => {
    if (!project) return;
    const nextId = selectedCue?.formationId ?? project.activeFormationId;
    if (!nextId) return;
    const prevId = lastFormationIdForStageRef.current;
    if (prevId === nextId) return;

    if (prevId !== null) {
      setProjectSafe((p) => {
        const snap = captureStageSnapshot(p);
        const formations1 = p.formations.map((f) =>
          f.id === prevId ? { ...f, stageSnapshot: snap } : f
        );
        const base: ChoreographyProjectJson = { ...p, formations: formations1 };
        const nf = formations1.find((f) => f.id === nextId);
        return nf?.stageSnapshot
          ? mergeStageSnapshotIntoProject(base, nf.stageSnapshot)
          : base;
      });
    } else {
      const nf = project.formations.find((f) => f.id === nextId);
      if (nf?.stageSnapshot) {
        setProjectSafe((p) => mergeStageSnapshotIntoProject(p, nf.stageSnapshot));
      }
    }
    lastFormationIdForStageRef.current = nextId;
  }, [project, selectedCue, setProjectSafe]);

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

  const playbackFloorMarkupForStage = !isPlaying ? null : interpolatedFloorMarkup;

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

  const browseFloorMarkup = useMemo(() => {
    if (!project || isPlaying) return null;
    if (stagePreviewDancers && stagePreviewDancers.length > 0) return null;
    if (selectedCue) {
      const f = project.formations.find((x) => x.id === selectedCue.formationId);
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
    const f = project.formations.find((x) => x.id === project.activeFormationId);
    return f?.floorMarkup ?? null;
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

  const onFloorTextPlaceSessionChange = useCallback((next: FloorTextPlaceSession) => {
    setFloorTextPlaceSession(next);
  }, []);

  const commitFloorTextPlace = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    if (project.cues.length > 0 && !selectedCueId) return;
    if (!floorTextPlaceSession) return;
    const text = floorTextPlaceSession.body.trim().slice(0, 400);
    if (!text) {
      window.alert("テキストを入力してください");
      return;
    }
    const formationId = selectedCue?.formationId ?? project.activeFormationId;
    const fs = Math.round(
      Math.min(56, Math.max(8, floorTextPlaceSession.fontSizePx))
    );
    const fw =
      Math.round(Math.min(900, Math.max(300, floorTextPlaceSession.fontWeight)) / 50) *
      50;
    setProjectSafe((p) => ({
      ...p,
      formations: p.formations.map((f) => {
        if (f.id !== formationId) return f;
        return {
          ...f,
          floorMarkup: [
            ...(f.floorMarkup ?? []),
            {
              kind: "text" as const,
              id: crypto.randomUUID(),
              xPct: round2Pct(
                Math.min(100, Math.max(0, floorTextPlaceSession.xPct))
              ),
              yPct: round2Pct(
                Math.min(100, Math.max(0, floorTextPlaceSession.yPct))
              ),
              text,
              color: "#fef08a",
              fontSizePx: fs,
              fontWeight: fw,
            },
          ],
        };
      }),
    }));
    setFloorTextPlaceSession(null);
  }, [
    project,
    floorTextPlaceSession,
    selectedCueId,
    selectedCue,
    setProjectSafe,
  ]);

  /**
   * いまの立ち位置・床テキスト・フォーメーションメモは作品データにそのまま含まれる。
   * ここでは横幅・客席・変形舞台などの「舞台設定」だけをこのページ用に明示保存する。
   */
  const saveCurrentPageStageSnapshot = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    if (project.cues.length > 0 && !selectedCueId) return;
    const fid = selectedCue?.formationId ?? project.activeFormationId;
    if (!fid) return;
    setProjectSafe((p) => {
      const snap = captureStageSnapshot(p);
      return {
        ...p,
        formations: p.formations.map((f) =>
          f.id === fid ? { ...f, stageSnapshot: snap } : f
        ),
      };
    });
  }, [project, selectedCue, selectedCueId, setProjectSafe]);

  useEffect(() => {
    if (stageView === "3d") setFloorTextPlaceSession(null);
  }, [stageView]);

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

  const hasRosterMembers = project.crews.some((c) => c.members.length > 0);
  /** 名簿ストリップのみ表示しタイムライン列を隠す（取り込み直後や「メンバーを表示」から） */
  const rosterOnlyMode =
    project.rosterHidesTimeline === true && hasRosterMembers;
  /** ワイド時は波形・再生を上部に固定（名簿専用モードでは従来の下段タイムライン） */
  const showTopWaveDock = wideEditorLayout && !rosterOnlyMode;

  const choreoToolbarSharedProps = {
    snapGrid: project.snapGrid,
    stageGridLinesEnabled: project.stageGridLinesEnabled ?? false,
    stageShapeActive:
      (project.stageShape != null &&
        project.stageShape.presetId !== "rectangle") ||
      (project.hanamichiEnabled ?? false),
    disabled: project.viewMode === "view",
    onToggleSnapGrid: () =>
      setProjectSafe((p) => ({ ...p, snapGrid: !p.snapGrid })),
    onToggleStageGridLines: () =>
      setProjectSafe((p) => ({
        ...p,
        stageGridLinesEnabled: !(p.stageGridLinesEnabled ?? false),
      })),
    stageGridLinesToggleDisabled: !(
      project.stageWidthMm != null &&
      project.stageWidthMm > 0 &&
      project.stageDepthMm != null &&
      project.stageDepthMm > 0
    ),
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
      compactTopDock={showTopWaveDock}
      cueListPortalTarget={showTopWaveDock ? cueListPortalEl : null}
    />
  );

  const stageUndoDisabled =
    project.viewMode === "view" ||
    (collabActive
      ? yjsCollab.undoStackSize === 0
      : historyRef.current.undo.length === 0);
  const stageRedoDisabled =
    project.viewMode === "view" ||
    (collabActive
      ? yjsCollab.redoStackSize === 0
      : historyRef.current.redo.length === 0);
  const workbenchInRightRail = wideEditorLayout && !rightPaneCollapsed;

  const stageWorkbenchProps: Omit<EditorStageWorkbenchProps, "layout"> = {
    project,
    setProjectSafe,
    cuesSortedForStageJump,
    selectedCueId,
    selectedCue: selectedCue ?? null,
    jumpToCueByIdx,
    cuePagerListOpen,
    setCuePagerListOpen,
    stageAreaSettingsOpen,
    setStageAreaSettingsOpen,
    stageSettingsOpen,
    setStageSettingsOpen,
    gatherMenuOpen,
    setGatherMenuOpen,
    applyGatherToward,
    rightPaneCollapsed,
    setRightPaneCollapsed,
    wideEditorLayout,
    stageUndoDisabled,
    stageRedoDisabled,
    undo,
    redo,
    setAddCueDialogOpen,
    saveMenuOpen,
    setSaveMenuOpen,
    saveCurrentPageStageSnapshot,
    saveStageToFormationBox,
    setFlowLibraryOpen,
    addDancerFromStageToolbar,
    importCrewCsvFromStageToolbar,
    stageView,
    setStageView,
    stageBoardFullscreen,
    toggleStageBoardFullscreen,
    floorTextPlaceSession,
    setFloorTextPlaceSession,
    commitFloorTextPlace,
    hasRosterMembers,
  };

  return (
    <div
      style={{
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
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "nowrap",
          gap: "8px",
          alignItems: "center",
          padding: "4px 8px",
          borderBottom: `1px solid ${shell.border}`,
          background: shell.bgChrome,
          minHeight: 0,
          flexShrink: 0,
        }}
      >
        <Link
          to="/"
          title={t("editor.backTitle")}
          aria-label={t("editor.backTitle")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            flexShrink: 0,
            textDecoration: "none",
            borderRadius: 8,
            color: shell.textMuted,
          }}
        >
          {/** 「く」の向きを反転した一本の角括弧（戻る） */}
          <span
            aria-hidden
            style={{
              fontSize: "22px",
              fontWeight: 500,
              lineHeight: 1,
              fontFamily: "ui-serif, 'Hiragino Mincho ProN', serif",
              letterSpacing: "-0.12em",
            }}
          >
            〉
          </span>
        </Link>
        <div style={{ flex: "1 1 auto", minWidth: 8 }} aria-hidden />
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            color: shell.textMuted,
            flexShrink: 0,
          }}
          title={t("editor.headcount")}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            aria-hidden
            style={{ display: "block", opacity: 0.75 }}
          >
            <circle cx="12" cy="9" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M6 20c0-4 3.5-6 6-6s6 2 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
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
              ...inputField,
              width: "56px",
              padding: "6px 8px",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </label>
        {me ? (
          <button
            type="button"
            style={{
              ...btnAccent,
              padding: "7px 14px",
              fontSize: "12px",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              ...(saving
                ? { opacity: 0.65, cursor: "wait", boxShadow: "none" }
                : {}),
            }}
            disabled={saving}
            title={
              serverId ? t("editor.saveTitleOverwrite") : t("editor.saveTitleNew")
            }
            aria-label={
              saving
                ? t("editor.savingAria")
                : serverId
                  ? t("editor.saveTitleOverwrite")
                  : t("editor.saveTitleNew")
            }
            onClick={() => void saveToCloud()}
          >
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              aria-hidden
              style={{ display: "block", opacity: 0.9 }}
            >
              <path
                d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M8 11h8M8 15h5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span>
              {saving ? t("editor.saving") : serverId ? t("editor.saveOverwrite") : t("editor.save")}
            </span>
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
          padding: "6px",
          minHeight: 0,
          overflow: "hidden",
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
              padding: "2px 4px 0",
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
                  padding: "0 4px 4px",
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
        {!wideEditorLayout ? (
          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              display: "flex",
            }}
          >
            <ChoreoGridToolbar {...choreoToolbarSharedProps} />
          </div>
        ) : null}
        <section
          ref={stageSectionRef}
          style={{
            ...panelCard,
            padding: "10px",
            minHeight: 0,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            ...(wideEditorLayout
              ? {
                  gridColumn: 1,
                  gridRow: showTopWaveDock ? 3 : 1,
                }
              : {}),
          }}
        >
          {wideEditorLayout && rightPaneCollapsed ? (
            <section
              style={{
                ...panelCard,
                padding: "10px",
                marginBottom: "10px",
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              <ChoreoGridToolbar embedInPanel {...choreoToolbarSharedProps} />
            </section>
          ) : null}
          {!workbenchInRightRail ? (
            <EditorStageWorkbench key="stage-wb" layout="stage" {...stageWorkbenchProps} />
          ) : null}
            ref={stageBoardHostRef}
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              ...(stageBoardFullscreen
                ? {
                    background: shell.bgDeep,
                    borderRadius: 8,
                  }
                : {}),
            }}
          >
            {stageView === "2d" ? (
              <StageBoard
                project={project}
                setProject={setProjectSafe}
                playbackDancers={playbackDancersForStage}
                browseFormationDancers={browseFormationDancers}
                previewDancers={stagePreviewDancers}
                playbackSetPieces={playbackSetPiecesForStage}
                browseSetPieces={browseSetPieces}
                playbackFloorMarkup={playbackFloorMarkupForStage}
                browseFloorMarkup={browseFloorMarkup}
                isPlaying={isPlaying}
                onStopPlaybackRequest={onStopPlaybackFromStage}
                editFormationId={
                  selectedCue?.formationId ?? project.activeFormationId
                }
                stageInteractionsEnabled={
                  project.viewMode !== "view" &&
                  (project.cues.length === 0 || Boolean(selectedCueId))
                }
                floorTextPlaceSession={floorTextPlaceSession}
                onFloorTextPlaceSessionChange={onFloorTextPlaceSessionChange}
              />
            ) : (
              <Suspense
                fallback={
                  <div style={{ padding: 24, color: shell.textSubtle, fontSize: "13px" }}>
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
          </div>
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
              gridColumn: 2,
              gridRow: showTopWaveDock ? 3 : 1,
            }}
          />
        ) : null}

        {rightPaneCollapsed && wideEditorLayout ? null : wideEditorLayout && showTopWaveDock ? (
          <div
            ref={rightPaneStackRef}
            style={{
              gridColumn: 3,
              gridRow: 3,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <section
              style={{
                ...panelCard,
                padding: "10px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                flexShrink: 0,
                minWidth: 0,
                minHeight: 0,
              }}
            >
              <ChoreoGridToolbar embedInPanel {...choreoToolbarSharedProps} />
              {!rosterOnlyMode ? (
                <button
                  type="button"
                  style={{
                    ...btnSecondary,
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    display: "flex",
                    justifyContent: "center",
                  }}
                  disabled={project.viewMode === "view"}
                  title="モーダルでキュー一覧を開きます"
                  onClick={() => setCueListModalOpen(true)}
                >
                  キュー一覧を開く
                </button>
              ) : null}
            </section>
            <section
              style={{
                ...panelCard,
                padding: "10px",
                flex: "1 1 auto",
                minHeight: 0,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "auto",
              }}
            >
              <EditorStageWorkbench key="stage-wb" layout="rail" {...stageWorkbenchProps} />
            </section>
            {rosterOnlyMode ? (
              <RosterTimelineStrip project={project} setProject={setProjectSafe} />
            ) : null}
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
                ? { gridColumn: 3, gridRow: 1 }
                : {}),
            }}
          >
            {wideEditorLayout && !showTopWaveDock ? (
              <section
                style={{
                  flexShrink: 0,
                  minWidth: 0,
                  marginBottom: 8,
                  ...panelCard,
                  padding: "10px",
                }}
              >
                <ChoreoGridToolbar embedInPanel {...choreoToolbarSharedProps} />
              </section>
            ) : null}
            {workbenchInRightRail ? (
              <section
                style={{
                  ...panelCard,
                  padding: "10px",
                  flex: rosterOnlyMode ? "1 1 auto" : "0 0 auto",
                  minHeight: rosterOnlyMode ? 0 : undefined,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: rosterOnlyMode ? "auto" : "visible",
                  marginBottom: rosterOnlyMode ? 0 : 8,
                }}
              >
                <EditorStageWorkbench key="stage-wb" layout="rail" {...stageWorkbenchProps} />
              </section>
            ) : null}
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
                ...panelCard,
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
          </div>
        )}
      </div>

      {showTopWaveDock ? (
        <>
          {cueListModalOpen ? (
            <div
              role="presentation"
              onClick={() => setCueListModalOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2190,
                background: "rgba(15, 23, 42, 0.55)",
              }}
            />
          ) : null}
          <div
            style={{
              position: "fixed",
              ...(cueListModalOpen
                ? {
                    top: "7vh",
                    right: 14,
                    width: "min(440px, calc(100vw - 28px))",
                    maxHeight: "86vh",
                    zIndex: 2200,
                    borderRadius: 12,
                    border: `1px solid ${shell.border}`,
                    background: shell.surface,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
                  }
                : {
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
                  }),
            }}
          >
            {cueListModalOpen ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "10px 12px",
                  borderBottom: `1px solid ${shell.border}`,
                  flexShrink: 0,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: shell.text,
                  }}
                >
                  キュー一覧
                </h2>
                <button
                  type="button"
                  aria-label="閉じる"
                  onClick={() => setCueListModalOpen(false)}
                  style={{ ...btnSecondary, padding: "4px 10px" }}
                >
                  閉じる
                </button>
              </div>
            ) : null}
            <div
              ref={setCueListPortalEl}
              style={{
                flex: "1 1 auto",
                minHeight: 240,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            />
          </div>
        </>
      ) : null}

      {stageAreaSettingsOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 61,
            background: "rgba(15, 23, 42, 0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setStageAreaSettingsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-area-settings-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "440px",
              maxHeight: "min(90vh, 640px)",
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
                id="stage-area-settings-title"
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                ステージまわりの設定
              </h3>
              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setStageAreaSettingsOpen(false)}
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

            <div
              style={{
                borderBottom: "1px solid #1e293b",
                paddingBottom: "14px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.06em",
                  marginBottom: "8px",
                }}
              >
                舞台設定
              </div>
              <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
                幅・奥行・袖・バック・場ミリ・プリセットは専用ダイアログで編集します。
              </p>
              <button
                type="button"
                disabled={project.viewMode === "view"}
                onClick={() => {
                  setStageAreaSettingsOpen(false);
                  setStageSettingsOpen(true);
                }}
                style={{
                  ...btnSecondary,
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                舞台の寸法・袖・バックを開く…
              </button>
            </div>

            <div
              style={{
                borderBottom: "1px solid #1e293b",
                paddingBottom: "14px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.06em",
                  marginBottom: "8px",
                }}
              >
                客席の位置
              </div>
              <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#64748b", lineHeight: 1.45 }}>
                画面のどの辺を客席側としてステージを回転表示するか（詳細は上の「舞台の寸法」でも変更可）。
              </p>
              <select
                value={project.audienceEdge}
                disabled={project.viewMode === "view"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (
                    v !== "top" &&
                    v !== "bottom" &&
                    v !== "left" &&
                    v !== "right"
                  )
                    return;
                  setProjectSafe((p) => ({ ...p, audienceEdge: v }));
                }}
                aria-label="客席のある画面の辺"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #334155",
                  background: "#020617",
                  color: "#e2e8f0",
                  fontSize: "13px",
                }}
              >
                {STAGE_AREA_AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    客席：画面の{o.label}側
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                borderBottom: "1px solid #1e293b",
                paddingBottom: "14px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.06em",
                  marginBottom: "8px",
                }}
              >
                グリッド
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
                立ち位置をグリッドに合わせる
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  onClick={() =>
                    setProjectSafe((p) => ({ ...p, snapGrid: true }))
                  }
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border:
                      project.snapGrid
                        ? "1px solid rgba(99,102,241,0.9)"
                        : "1px solid #334155",
                    background: project.snapGrid
                      ? "rgba(99,102,241,0.22)"
                      : "#020617",
                    color: project.snapGrid ? "#e0e7ff" : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor:
                      project.viewMode === "view" ? "not-allowed" : "pointer",
                  }}
                >
                  合わせる
                </button>
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  onClick={() =>
                    setProjectSafe((p) => ({ ...p, snapGrid: false }))
                  }
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border:
                      !project.snapGrid
                        ? "1px solid rgba(148,163,184,0.85)"
                        : "1px solid #334155",
                    background: !project.snapGrid ? "#334155" : "#020617",
                    color: !project.snapGrid ? "#f8fafc" : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor:
                      project.viewMode === "view" ? "not-allowed" : "pointer",
                  }}
                >
                  合わせない
                </button>
              </div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "#94a3b8",
                  marginBottom: "4px",
                }}
              >
                スナップ刻み（幅・奥行 mm があるときは実寸グリッド優先。無いときは %）
              </label>
              <select
                value={project.gridStep}
                disabled={!project.snapGrid || project.viewMode === "view"}
                onChange={(e) =>
                  setProjectSafe((p) => ({
                    ...p,
                    gridStep: Number(e.target.value),
                  }))
                }
                style={{
                  width: "100%",
                  marginBottom: "10px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  background: "#020617",
                  color: "#e2e8f0",
                  fontSize: "12px",
                }}
              >
                <option value={0.5}>0.5% 刻み</option>
                <option value={1}>1% 刻み</option>
                <option value={2}>2% 刻み</option>
                <option value={5}>5% 刻み</option>
                <option value={10}>10% 刻み</option>
              </select>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "#94a3b8",
                  marginBottom: "4px",
                }}
              >
                実寸スナップの幅基準（ステージ幅 mm 設定時）
              </label>
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
                style={{
                  width: "100%",
                  marginBottom: "12px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  background: "#020617",
                  color: "#e2e8f0",
                  fontSize: "12px",
                }}
              >
                <option value={0}>実寸スナップ：なし</option>
                <option value={300}>30 cm</option>
                <option value={500}>50 cm</option>
                <option value={1000}>1 m</option>
                <option value={1500}>1.5 m</option>
                <option value={2000}>2 m</option>
                <option value={3000}>3 m</option>
              </select>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                グリッド線（表示のみ・スナップとは別）
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "#cbd5e1",
                  marginBottom: "8px",
                  cursor: project.viewMode === "view" ? "default" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={project.stageGridLinesEnabled ?? false}
                  disabled={
                    project.viewMode === "view" ||
                    !(
                      project.stageWidthMm != null &&
                      project.stageWidthMm > 0 &&
                      project.stageDepthMm != null &&
                      project.stageDepthMm > 0
                    )
                  }
                  onChange={(e) =>
                    setProjectSafe((p) => ({
                      ...p,
                      stageGridLinesEnabled: e.target.checked,
                    }))
                  }
                />
                線を表示する
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "#94a3b8",
                  flexWrap: "wrap",
                }}
              >
                <span>線の間隔（縦横・cm）</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={Math.max(
                    1,
                    Math.min(
                      500,
                      Math.round((project.stageGridLineSpacingMm ?? 10) / 10)
                    )
                  )}
                  disabled={
                    project.viewMode === "view" ||
                    !(
                      project.stageWidthMm != null &&
                      project.stageWidthMm > 0 &&
                      project.stageDepthMm != null &&
                      project.stageDepthMm > 0
                    )
                  }
                  onChange={(e) => {
                    const cm = Number(e.target.value);
                    if (!Number.isFinite(cm)) return;
                    const clampedCm = Math.max(1, Math.min(500, Math.round(cm)));
                    setProjectSafe((p) => ({
                      ...p,
                      stageGridLineSpacingMm: clampedCm * 10,
                    }));
                  }}
                  aria-label="グリッド線の間隔（cm）"
                  style={{
                    width: "56px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#020617",
                    color: "#e2e8f0",
                    fontSize: "12px",
                  }}
                />
              </label>
            </div>

            <div
              style={{
                borderBottom: "1px solid #1e293b",
                paddingBottom: "14px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.06em",
                  marginBottom: "8px",
                }}
              >
                立ち位置の名前
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  onClick={() =>
                    setProjectSafe((p) => ({ ...p, dancerLabelPosition: "inside" }))
                  }
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border:
                      (project.dancerLabelPosition ?? "inside") === "inside"
                        ? "1px solid rgba(99,102,241,0.9)"
                        : "1px solid #334155",
                    background:
                      (project.dancerLabelPosition ?? "inside") === "inside"
                        ? "rgba(99,102,241,0.22)"
                        : "#020617",
                    color:
                      (project.dancerLabelPosition ?? "inside") === "inside"
                        ? "#e0e7ff"
                        : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor:
                      project.viewMode === "view" ? "not-allowed" : "pointer",
                  }}
                >
                  ○の中に名前
                </button>
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  onClick={() =>
                    setProjectSafe((p) => ({ ...p, dancerLabelPosition: "below" }))
                  }
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border:
                      project.dancerLabelPosition === "below"
                        ? "1px solid rgba(99,102,241,0.9)"
                        : "1px solid #334155",
                    background:
                      project.dancerLabelPosition === "below"
                        ? "rgba(99,102,241,0.22)"
                        : "#020617",
                    color:
                      project.dancerLabelPosition === "below"
                        ? "#e0e7ff"
                        : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor:
                      project.viewMode === "view" ? "not-allowed" : "pointer",
                  }}
                >
                  ○の下に名前
                </button>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "10px", color: "#64748b", lineHeight: 1.45 }}>
                ○の下のときは印の中は番号（連番は右クリックメニューや各メンバー編集）。
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => void copyEditorShareLink()}
                style={{
                  ...btnSecondary,
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {shareLinkCopiedFlash
                  ? "URL をコピーしました"
                  : "この画面の URL を共有（コピー）"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStageAreaSettingsOpen(false);
                  setShortcutsHelpOpen(true);
                }}
                style={{
                  ...btnSecondary,
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                ショートカット・ヒントを開く
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                ステージ見出しの <strong style={{ color: "#e2e8f0" }}>全画面</strong>{" "}
                で床表示だけをブラウザ全画面に（<strong style={{ color: "#e2e8f0" }}>Esc</strong>{" "}
                または「全画面終了」で戻る）
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
