import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StageBoard } from "../components/StageBoard";
import { StageDimensionFields } from "../components/StageDimensionFields";
const Stage3DView = lazy(() =>
  import("../components/Stage3DView").then((m) => ({ default: m.Stage3DView }))
);
import { TimelinePanel, type TimelinePanelHandle } from "../components/TimelinePanel";
import { InspectorPanel } from "../components/InspectorPanel";
import { FormationSuggestionPanel } from "../components/FormationSuggestionPanel";
import { createEmptyProject, tryMigrateFromLocalStorage } from "../lib/projectDefaults";
import { preloadFFmpeg } from "../lib/extractVideoAudio";
import { normalizeProject } from "../lib/normalizeProject";
import { sortCuesByStart } from "../lib/cueInterval";
import { dancersAtTime } from "../lib/interpolatePlayback";
import { setPiecesAtTime } from "../lib/interpolateSetPieces";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  SetPieceKind,
} from "../types/choreography";
import {
  SetPiecePickerModal,
  type SetPiecePickerSubmit,
} from "../components/SetPiecePickerModal";
import { ChoreoGridToolbar } from "../components/ChoreoGridToolbar";
import { ExportDialog } from "../components/ExportDialog";
import { projectApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { btnSecondary } from "../components/StageBoard";

const HISTORY_CAP = 80;

const EDITOR_WIDE_MIN_PX = 1280;
/** メイン 4 列グリッドの列間（ステージ〜タイムラインのすき間に効く） */
const EDITOR_GRID_GAP_PX = 6;
/** ステージ列とタイムライン列の間のドラッグ幅 */
const STAGE_RESIZER_PX = 6;
const STAGE_COL_MIN_PX = 280;
const TIMELINE_COL_MIN_PX = 300;
const TOOLBAR_COL_PX = 52;

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
  const { me } = useAuth();
  const [project, setProject] = useState<ChoreographyProjectJson | null>(null);
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
  const timelineRef = useRef<TimelinePanelHandle>(null);
  const [formationSuggestionOpen, setFormationSuggestionOpen] = useState(false);
  /** キュー行「フォーメーション案」から開いたときのみ。null のときは選択キュー／アクティブに従う */
  const [formationSuggestionFormationId, setFormationSuggestionFormationId] = useState<
    string | null
  >(null);
  const [stageInfoOpen, setStageInfoOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [setPiecePickerOpen, setSetPiecePickerOpen] = useState(false);
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

  const historyRef = useRef<{ undo: string[]; redo: string[] }>({
    undo: [],
    redo: [],
  });

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
    if (projectId === "new" || !projectId) {
      const migrated = tryMigrateFromLocalStorage();
      setProject(migrated ?? createEmptyProject());
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
    let cancelled = false;
    (async () => {
      try {
        const row = await projectApi.get(id);
        if (cancelled) return;
        setServerId(row.id);
        setProjectName(row.name);
        setProject(normalizeProject(row.json));
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
  }, [projectId]);

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
      const minH = 120;
      const maxH = Math.max(minH, gridRect.height - 220);
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

  const editorGridColumns = wideEditorLayout
    ? stageColumnPx == null
      ? `52px minmax(${STAGE_COL_MIN_PX}px, 1.25fr) ${STAGE_RESIZER_PX}px minmax(${TIMELINE_COL_MIN_PX}px, 1fr)`
      : `${TOOLBAR_COL_PX}px ${Math.round(stageColumnPx)}px ${STAGE_RESIZER_PX}px minmax(${TIMELINE_COL_MIN_PX}px, 1fr)`
    : "1fr";

  const setProjectSafe: Dispatch<SetStateAction<ChoreographyProjectJson>> = useCallback(
    (action) => {
      setProject((prev) => {
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
    },
    []
  );

  const undo = useCallback(() => {
    setProject((cur) => {
      if (!cur) return cur;
      const { undo, redo } = historyRef.current;
      if (undo.length === 0) return cur;
      const prevStr = undo.pop()!;
      redo.push(JSON.stringify(cur));
      return normalizeProject(JSON.parse(prevStr));
    });
  }, []);

  const redo = useCallback(() => {
    setProject((cur) => {
      if (!cur) return cur;
      const { undo, redo } = historyRef.current;
      if (redo.length === 0) return cur;
      const nextStr = redo.pop()!;
      undo.push(JSON.stringify(cur));
      return normalizeProject(JSON.parse(nextStr));
    });
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
      if (e.key === "Escape" && stageInfoOpen) {
        setStageInfoOpen(false);
        return;
      }
      if (e.key === "Escape" && exportDialogOpen) {
        setExportDialogOpen(false);
        return;
      }
      if (e.key === "Escape" && shortcutsHelpOpen) {
        setShortcutsHelpOpen(false);
        return;
      }
      if (e.key === "Escape" && formationSuggestionOpen) {
        setFormationSuggestionOpen(false);
        setFormationSuggestionFormationId(null);
        setStagePreviewDancers(null);
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
    formationSuggestionOpen,
    stageInfoOpen,
    shortcutsHelpOpen,
    exportDialogOpen,
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

  const jumpToSortedCuePage = useCallback(
    (idx: 0 | 1) => {
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
      const n = f.dancers.length + 1;
      return {
        ...p,
        formations: p.formations.map((fm) =>
          fm.id === fid
            ? {
                ...fm,
                dancers: [
                  ...fm.dancers,
                  {
                    id: crypto.randomUUID(),
                    label: String(n),
                    xPct: 50,
                    yPct: 40,
                    colorIndex: n % 9,
                  },
                ],
              }
            : fm
        ),
      };
    });
  }, [project, selectedCue, setProjectSafe]);

  const openSetPiecePicker = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const fid =
      selectedCue?.formationId ??
      project.formations.find((x) => x.id === project.activeFormationId)?.id ??
      project.formations[0]?.id;
    if (!fid) return;
    setSetPiecePickerOpen(true);
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

  if (!project) {
    return <div style={{ padding: 24, color: "#94a3b8" }}>読み込み中…</div>;
  }

  const waveDockTopRow = wideEditorLayout && waveTimelineDockTop;

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
      onOpenFormationSuggestions={(formationId) => {
        setFormationSuggestionFormationId(formationId);
        setFormationSuggestionOpen(true);
      }}
      onUndo={undo}
      onRedo={redo}
      undoDisabled={
        project.viewMode === "view" || historyRef.current.undo.length === 0
      }
      redoDisabled={
        project.viewMode === "view" || historyRef.current.redo.length === 0
      }
      selectedCueIds={selectedCueIds}
      onSelectedCueIdsChange={setSelectedCueIds}
      formationIdForNewCue={selectedCue?.formationId ?? project.activeFormationId}
      wideWorkbench={wideEditorLayout}
      waveTimelineDockTop={waveTimelineDockTop}
      onWaveTimelineDockTopChange={setWaveTimelineDockTop}
      compactTopDock={wideEditorLayout && waveTimelineDockTop}
      cueListPortalTarget={
        wideEditorLayout && waveTimelineDockTop ? cueListPortalEl : null
      }
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
            ? waveDockTopRow
              ? `${
                  topDockRowPx != null
                    ? `${topDockRowPx}px`
                    : "minmax(160px, min(28vh, 300px))"
                } 6px minmax(0, 1fr)`
              : "1fr"
            : "auto auto auto",
          gap: `${EDITOR_GRID_GAP_PX}px`,
          padding: "12px",
          minHeight: 0,
        }}
      >
        {waveDockTopRow ? (
          <section
            style={{
              gridColumn: "1 / -1",
              gridRow: 1,
              background: "#020617",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              padding: "12px",
              minHeight: 0,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: "13px", color: "#94a3b8" }}>
              波形・再生
            </h2>
            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {timelinePanelEl}
            </div>
          </section>
        ) : null}
        {waveDockTopRow ? (
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
                height: 2,
                background: "#1e293b",
                borderRadius: 1,
              }}
            />
          </div>
        ) : null}
        <div
          style={
            wideEditorLayout
              ? {
                  gridColumn: 1,
                  gridRow: waveDockTopRow ? 3 : 1,
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
            hanamichiEnabled={project.hanamichiEnabled ?? false}
            disabled={project.viewMode === "view"}
            onToggleSnapGrid={() =>
              setProjectSafe((p) => ({ ...p, snapGrid: !p.snapGrid }))
            }
            onToggleHanamichi={() =>
              setProjectSafe((p) => ({
                ...p,
                hanamichiEnabled: !(p.hanamichiEnabled ?? false),
              }))
            }
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
                  gridRow: waveDockTopRow ? 3 : 1,
                }
              : {}),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                minWidth: 0,
              }}
            >
              <h2 style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                ステージ
              </h2>
              {cuesSortedForStageJump.length > 0 ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    flexShrink: 0,
                  }}
                  title="タイムライン上で先頭から 1 番目・2 番目のキュー（ページ）へ。再生は止まり、区間の頭に移ります。"
                >
                  <span
                    style={{
                      fontSize: "9px",
                      color: "#64748b",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}
                  >
                    ページ
                  </span>
                  {([0, 1] as const).map((idx) => {
                    const c = cuesSortedForStageJump[idx];
                    const active = c && selectedCueId === c.id;
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={project.viewMode === "view" || !c}
                        onClick={() => jumpToSortedCuePage(idx)}
                        style={{
                          fontSize: "10px",
                          lineHeight: 1,
                          minWidth: "22px",
                          padding: "2px 5px",
                          borderRadius: "5px",
                          border: active
                            ? "1px solid #818cf8"
                            : "1px solid #334155",
                          background: active ? "rgba(99, 102, 241, 0.2)" : "#0f172a",
                          color: active ? "#e0e7ff" : "#94a3b8",
                          cursor:
                            project.viewMode === "view" || !c
                              ? "not-allowed"
                              : "pointer",
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <button
                type="button"
                disabled={project.viewMode === "view"}
                title="メイン幅・奥行・サイド・バック・場ミリを編集"
                aria-haspopup="dialog"
                aria-expanded={stageInfoOpen}
                onClick={() => setStageInfoOpen(true)}
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
                ステージ情報
              </button>
              {selectedCue ? (
                <span style={{ fontSize: "11px", color: "#cbd5e1" }}>
                  編集中のキュー: {selectedCue.name?.trim() || "（無名）"}
                </span>
              ) : project.cues.length === 0 ? (
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
                  ...(formationSuggestionOpen
                    ? { borderColor: "#6366f1", color: "#c7d2fe" }
                    : {}),
                }}
                disabled={project.viewMode === "view"}
                title="右にパネルを開き、人数と多数のフォーメーション案（プリセット）から選べます（ステージはそのまま）"
                onClick={() =>
                  setFormationSuggestionOpen((v) => {
                    const next = !v;
                    setFormationSuggestionFormationId(null);
                    if (!next) setStagePreviewDancers(null);
                    return next;
                  })
                }
              >
                フォーメーション案
              </button>
              <button
                type="button"
                style={btnSecondary}
                disabled={project.viewMode === "view"}
                title="選択中のフォーメーションにダンサーを1人追加（中央付近）"
                onClick={() => addDancerFromStageToolbar()}
              >
                ＋ダンサー
              </button>
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
              <div
                style={{
                  width: "1px",
                  height: "22px",
                  background: "#334155",
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <div style={{ display: "flex", gap: "6px" }}>
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
                  3D（簡易）
                </button>
              </div>
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

        {wideEditorLayout ? (
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
              gridRow: waveDockTopRow ? 3 : 1,
            }}
          />
        ) : null}

        {wideEditorLayout && waveDockTopRow ? (
          <div
            style={{
              gridColumn: 4,
              gridRow: 3,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <section
              style={{
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "12px",
                minHeight: 0,
                flex: "1 1 55%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
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
            <section
              style={{
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "12px",
                minHeight: 0,
                flex: "1 1 45%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
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
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
              ...(wideEditorLayout
                ? { gridColumn: 4, gridRow: 1 }
                : {}),
            }}
          >
            <section
              style={{
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "12px",
                minHeight: 0,
                flex: "1 1 55%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: "13px", color: "#94a3b8" }}>
                タイムライン・楽曲
              </h2>
              <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
                {timelinePanelEl}
              </div>
            </section>
            <section
              style={{
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "12px",
                minHeight: 0,
                flex: "1 1 45%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
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

      {stageInfoOpen ? (
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
            if (e.target === e.currentTarget) setStageInfoOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-info-dialog-title"
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
                id="stage-info-dialog-title"
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                舞台の大きさ（詳細）
              </h3>
              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setStageInfoOpen(false)}
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
              onCommit={() => setStageInfoOpen(false)}
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
                波形: ツールバーの「全体表示」「拡大」「縮小」で表示範囲を変更
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

      {project ? (
        <ExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          project={project}
          projectName={projectName}
          stage2dVisible={stageView === "2d"}
        />
      ) : null}

      {formationSuggestionOpen && (
        <FormationSuggestionPanel
          project={project}
          setProject={setProjectSafe}
          formationTargetId={
            formationSuggestionFormationId ??
            selectedCue?.formationId ??
            project.activeFormationId
          }
          onStagePreviewChange={setStagePreviewDancers}
          onClose={() => {
            setFormationSuggestionOpen(false);
            setFormationSuggestionFormationId(null);
            setStagePreviewDancers(null);
          }}
          onAfterApply={() => {
            setFormationSuggestionOpen(false);
            setFormationSuggestionFormationId(null);
          }}
        />
      )}

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
          width: 2px;
          border-radius: 1px;
          background: transparent;
          pointer-events: none;
        }
        .editor-pane-resizer:hover::after {
          background: rgba(148, 163, 184, 0.55);
        }
      `}</style>
    </div>
  );
}
