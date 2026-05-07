import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateId } from "../lib/generateId";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  SetPiece,
  StageFloorMarkup,
  StageFloorTextMarkup,
} from "../types/choreography";
import { useStageBoardController } from "../hooks/useStageBoardController";
import { useStageBoardLayoutAfterDraft } from "../hooks/useStageBoardLayoutAfterDraft";
import { useFloorMarkupText } from "../hooks/useFloorMarkupText";
import { useFloorLineDraw } from "../hooks/useFloorLineDraw";
import { useMarkerHandles } from "../hooks/useMarkerHandles";
import { useSetPieceInteraction } from "../hooks/useSetPieceInteraction";
import { useStageResize } from "../hooks/useStageResize";
import { useSetPieceBlockElements } from "../hooks/useSetPieceBlockElements";
import { useStageDancerMarkerElements } from "../hooks/useStageDancerMarkerElements";
import type {
  BuildStageBoardExportColumnInput,
  StageBoardBodyOverlaysProps,
  StageBoardBodyProps,
  StageBoardLayoutSlots,
} from "./stageBoardTypes";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
  snapXPctToCenterDistanceMmGrid,
} from "../lib/dancerSpacing";
import { resolveArrangeTargetIds } from "../lib/stageSelectionArrange";
import type { DancerQuickEditApply } from "./DancerQuickEditDialog";
import { StageBoardContextMenuLayer } from "./StageBoardContextMenuLayer";
import type { StageBoardContextMenuState } from "./StageBoardContextMenuLayer";
import { StageBoardLayout } from "./StageBoardLayout";
import { StageBoardShell } from "./StageBoardShell";
import { StageBoardMainColumn } from "./StageBoardMainColumn";
import { StageBoardPreviewFormationBanner } from "./StageBoardPreviewFormationBanner";
import { StageBoardScreenOverlay } from "./StageBoardScreenOverlay";
import { StageBoardBodyOverlays } from "./StageBoardBodyOverlays";
import { StageBoardBulkColorToolbar } from "./StageBoardBulkColorToolbar";
import { StageBoardBulkToolbarSlot } from "./StageBoardBulkToolbarSlot";
import { StageBoardStageFrame } from "./StageBoardStageFrame";
import type { StageExportRootColumnProps } from "./StageExportRootColumn";
import { shell } from "../theme/choreoShell";
import {
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import { sliceMarkerBadgeForStorage } from "../lib/markerBadge";
import {
  pointerInViewportTrashRevealZone,
  syncRosterAfterRemovingLinkedMembersFromFirstCue,
  trashViewportStripWidthPx,
} from "../lib/stageBoardRosterAndTrash";
import {
  clamp,
  EMPTY_FLOOR_TEXT_DRAFT,
  floorTextDraftColorHex,
  floorTextLayer,
  FLOOR_TEXT_DEFAULT_FONT,
  groupScaleForHandle,
  round2,
  setPieceLayer,
  type GroupBoxHandle,
} from "../lib/stageBoardModelHelpers";
import { computeStageContextMenuStyle } from "../lib/stageContextMenuGeometry";
import { buildStageBoardExportColumnProps } from "../lib/buildStageBoardExportColumnProps";
import {
  FLOOR_TEXT_TAP_DRAG_THRESHOLD_PX,
  pickNextDancerInStack,
  removeDancerFromSelection,
  removeDancersFromSelection,
  replaceSelectionWithSingle,
  toggleDancerAdditiveSelection,
  type StageDancerSnapMode,
} from "../engine/stage";
import { useStageBoardInteractionStore } from "../store/stage/stageBoardInteractionStore";

/**
 * ステージボードの実装本体。`useStageDancerMarkerElements` / `useSetPieceBlockElements` 等で束ね、return 直前では次の順にオブジェクトを組み立てる:
 * `buildStageBoardExportColumnProps` → `stageBoardLayoutSlots` → `stageBoardOverlaysProps`（`useMemo`）→ `StageBoardShell`。
 */
export function StageBoardBody({
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
  floorMarkupTool: floorMarkupToolProp,
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
    stageMainFloorRef,
    setMainFloorPxWidth,
    baseMarkerPx,
    nameBelowClearanceExtraPx,
  } = useStageBoardController({
    project,
    floorMarkupTool: floorMarkupToolProp,
    onFloorMarkupToolChange,
  });

  /** 画面左端のゴミ箱帯（`position: fixed` で body に portal） */
  const trashDockViewportRef = useRef<HTMLDivElement>(null);
  const stageContextMenuRef = useRef<HTMLDivElement>(null);
  const trashHotRef = useRef(false);
  const dragRef = useRef<{
    dancerId: string;
    offsetXPx: number;
    offsetYPx: number;
    startXPct: number;
    startYPct: number;
  } | null>(null);
  /**
   * ドラッグ中に表示するスナップ補助線。
   * - `x`: 縦のガイド線（左右方向にセンター/他ダンサーと揃ったとき）
   * - `y`: 横のガイド線（前後方向にセンター/他ダンサーと揃ったとき）
   */
  const [alignGuides, setAlignGuides] = useState<{
    x: number | null;
    y: number | null;
  }>({ x: null, y: null });

  /** ダブルクリックで開くメンバー編集ダイアログの対象ダンサー id */
  const [dancerQuickEditId, setDancerQuickEditId] = useState<string | null>(
    null,
  );
  /**
   * ステージ上で選択中のダンサー ID（複数可）。状態は `useStageBoardInteractionStore`。
   * - 1 件なら Alt+矢印で微移動できる（従来の microNudgeDancerId の役割）。
   * - 2 件以上ならステージに枠が出て、8 ハンドルで群全体を比率スケールできる。
   * - 1 件以上なら代表ダンサーの右下に小さなハンドルが出て、○の直径を変更できる。
   */
  const selectedDancerIds = useStageBoardInteractionStore(
    (s) => s.selectedDancerIds,
  );
  const setSelectedDancerIds = useStageBoardInteractionStore(
    (s) => s.setSelectedDancerIds,
  );
  const clearSelectedDancers = useStageBoardInteractionStore(
    (s) => s.clearSelectedDancers,
  );
  /** ドラッグ中のマーキー（範囲選択の四角）。pct 座標で親床内を示す */
  const [marquee, setMarquee] = useState<{
    startXPct: number;
    startYPct: number;
    curXPct: number;
    curYPct: number;
  } | null>(null);
  const marqueeSessionRef = useRef<{
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    floorWpx: number;
    floorHpx: number;
    additive: boolean;
    baseIds: string[];
    movedPx: number;
  } | null>(null);
  /** 複数ダンサー選択時の群移動／群スケール操作セッション */
  const groupDragRef = useRef<
    | {
        mode: "move";
        ids: string[];
        startPositions: Map<string, { xPct: number; yPct: number }>;
        startClientX: number;
        startClientY: number;
        floorWpx: number;
        floorHpx: number;
      }
    | {
        mode: "scale";
        handle: GroupBoxHandle;
        ids: string[];
        startBox: { x0: number; y0: number; x1: number; y1: number };
        startPositions: Map<string, { xPct: number; yPct: number }>;
        startClientX: number;
        startClientY: number;
        floorWpx: number;
        floorHpx: number;
      }
    | null
  >(null);

  const {
    stageResizeDraft,
    hoveredStageHandle,
    setHoveredStageHandle,
    onStageCornerResizeDown,
  } = useStageResize({
    viewMode,
    stageInteractionsEnabled,
    playbackDancers,
    previewDancers: previewDancers ?? null,
    audienceEdge,
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
    setProject,
  });
  const {
    rot,
    effStageWidthMm,
    effStageDepthMm,
    Wmm,
    Dmm,
    Smm,
    Bmm,
    hasStageDims,
    outerWmm,
    outerDmm,
    stageAspectRatio,
    showShell,
    mmSnapGrid,
    showStageMmGridOverlay,
  } = useStageBoardLayoutAfterDraft({
    stageResizeDraft,
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
    audienceEdge,
    floorRef: stageMainFloorRef,
    setMainFloorPxWidth,
    project,
    stageGridLinesVertical,
    stageGridLinesHorizontal,
  });

  /** ゴミ箱ドロップゾーン上でダンサーをドラッグ中 */
  const [trashHot, setTrashHot] = useState(false);
  /** ポインタが画面左端付近まで来たときだけゴミ箱 UI を出す */
  const [trashUiVisible, setTrashUiVisible] = useState(false);
  const trashRevealActiveRef = useRef(false);
  /**
   * ドラッグ開始時点の座標を薄く重ね表示（ポインタアップで消える）。
   */
  const [dragGhostById, setDragGhostById] = useState<Map<
    string,
    { xPct: number; yPct: number }
  > | null>(null);
  /** ステージ上の右クリックメニュー（ダンサー / 床テキスト / 大道具） */
  const [stageContextMenu, setStageContextMenu] =
    useState<StageBoardContextMenuState>(null);
  const openFloorTextContextMenu = useCallback(
    (markupId: string, clientX: number, clientY: number) => {
      setStageContextMenu({
        kind: "floorText",
        clientX,
        clientY,
        markupId,
      });
    },
    [],
  );
  /**
   * ステージ直下の「選択中の色」一括ツールバー。
   * 左クリックで選んだだけでは出さず、ステージ上のダンサーを右クリックしたあとだけ表示する。
   */
  const [showStageDancerColorToolbar, setShowStageDancerColorToolbar] =
    useState(false);
  /**
   * 複数の一括移動・枠スケール・剛体回転ドラッグ中は、選択メンバーの○内番号と名前を隠す。
   */
  const [bulkHideDancerGlyphs, setBulkHideDancerGlyphs] = useState(false);
    const formationIdForWrites =
    editFormationId != null && formations.some((f) => f.id === editFormationId)
      ? editFormationId
      : activeFormationId;

  useEffect(() => {
    setShowStageDancerColorToolbar(false);
  }, [selectedDancerIds.join(",")]);

  useEffect(() => {
    if (!stageContextMenu) return;
    const close = (e: PointerEvent) => {
      const el = stageContextMenuRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setStageContextMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStageContextMenu(null);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [stageContextMenu]);

  const activeFormation = useMemo(
    () => formations.find((f) => f.id === activeFormationId),
    [formations, activeFormationId],
  );

  const writeFormation = useMemo(
    () => formations.find((f) => f.id === formationIdForWrites),
    [formations, formationIdForWrites],
  );

  const playbackOrPreview = Boolean(playbackDancers || previewDancers);

  const {
    markerDiamDraft,
    markerGroupPosDraft,
    groupRotateGuideDeltaDeg,
    selectionBox,
    effectiveMarkerPx,
    effectiveFacingDeg,
    handlePointerDownMarkerResize,
    handlePointerDownMarkerRotate,
    applyMarkerRotateMove,
    applyMarkerResizeMove,
    commitMarkerRotateUp,
    commitMarkerResizeUp,
    resetMarkerHandles,
  } = useMarkerHandles({
    viewMode,
    stageInteractionsEnabled,
    playbackDancers,
    previewDancers,
    playbackOrPreview,
    selectedDancerIds,
    writeFormation,
    activeFormation,
    stageMainFloorRef,
    baseMarkerPx,
    setBulkHideDancerGlyphs,
  });

  const displayDancers =
    previewDancers ??
    playbackDancers ??
    browseFormationDancers ??
    activeFormation?.dancers ??
    [];

  /** 群の剛体回転ドラッグ中は仮座標で上書き（印の位置表示用） */
  const dancersForStageMarkers = useMemo(() => {
    const base = displayDancers;
    if (!markerGroupPosDraft || markerGroupPosDraft.size === 0) return base;
    return base.map((d) => {
      const o = markerGroupPosDraft.get(d.id);
      if (!o) return d;
      return { ...d, xPct: o.xPct, yPct: o.yPct };
    });
  }, [displayDancers, markerGroupPosDraft]);

  /**
   * ドラッグゴースト描画は pointermove ごとに走るため、
   * ghostId -> dancer / index を先に Map 化して find 系の線形探索を避ける。
   */
  const stageDancersForLookup = useMemo(
    () => writeFormation?.dancers ?? activeFormation?.dancers ?? [],
    [writeFormation?.dancers, activeFormation?.dancers],
  );
  const stageDancerById = useMemo(
    () => new Map(stageDancersForLookup.map((d) => [d.id, d] as const)),
    [stageDancersForLookup],
  );
  const stageDancerIndexById = useMemo(
    () => new Map(stageDancersForLookup.map((d, i) => [d.id, i] as const)),
    [stageDancersForLookup],
  );

  const displaySetPieces: SetPiece[] =
    previewDancers != null && previewDancers.length > 0
      ? (writeFormation?.setPieces ?? [])
      : (playbackSetPieces ??
        browseSetPieces ??
        writeFormation?.setPieces ??
        []);

  const displayFloorMarkup: StageFloorMarkup[] =
    previewDancers != null && previewDancers.length > 0
      ? (writeFormation?.floorMarkup ?? [])
      : (playbackFloorMarkup ??
        browseFloorMarkup ??
        writeFormation?.floorMarkup ??
        []);

  const stageSetPieces = useMemo(
    () => displaySetPieces.filter((p) => setPieceLayer(p) === "stage"),
    [displaySetPieces],
  );
  const screenSetPieces = useMemo(
    () => displaySetPieces.filter((p) => setPieceLayer(p) === "screen"),
    [displaySetPieces],
  );

  /**
   * 客席帯・床下の場ミリ数字・翼の印は、閲覧・再生・客席を上にした回転でも欠けないよう、
   * ステージ周りの親は overflow visible（旧: 再生中に hidden にして帯が切れる不具合があった）。
   */

  const setPiecesEditable =
    viewMode !== "view" && stageInteractionsEnabled && !playbackOrPreview;

  const updateActiveFormation = useCallback(
    (
      updater: (
        f: NonNullable<typeof writeFormation>,
      ) => NonNullable<typeof writeFormation>,
    ) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false
      )
        return;
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) =>
          f.id === formationIdForWrites ? updater(f) : f,
        ),
      }));
    },
    [
      writeFormation,
      formationIdForWrites,
      setProject,
      viewMode,
      stageInteractionsEnabled,
    ],
  );

  const {
    floorMarkupTextDragRef,
    floorTextTapOrDragRef,
    floorTextResizeDragRef,
    floorTextPlaceDragRef,
    floorTextDraft,
    setFloorTextDraft,
    floorTextEditId,
    setFloorTextEditId,
    setSelectedFloorTextId,
    floorTextInlineRect,
    setFloorTextInlineRect,
    removeFloorMarkupById,
    handleFloorTextPlacePreviewPointerDown,
    floorTextMarkupSharedProps,
    floorTextInlineMarkupScale,
    screenFloorTexts,
    resetFloorTextInteraction,
  } = useFloorMarkupText({
    viewMode,
    setPiecesEditable,
    playbackOrPreview,
    previewDancers: Boolean(previewDancers),
    floorTextPlaceSession: floorTextPlaceSession ?? null,
    onFloorTextPlaceSessionChange,
    viewportTextOverlayRoot,
    floorMarkupTool,
    setFloorMarkupTool,
    writeFormation,
    displayFloorMarkup,
    updateActiveFormation,
    onFloorTextContextMenu: openFloorTextContextMenu,
  });

  const {
    floorLineSessionRef,
    floorLineDraft,
    setFloorLineDraft,
    beginFloorLineDraw,
    resetFloorLineDraw,
  } = useFloorLineDraw({
    updateActiveFormation,
    writeFormation,
    setPiecesEditable,
  });

  const removeDancerById = useCallback(
    (dancerId: string) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false
      )
        return;
      const spot = writeFormation.dancers.find((x) => x.id === dancerId);
      setProject((p) => {
        let next: ChoreographyProjectJson = {
          ...p,
          formations: p.formations.map((f) =>
            f.id === formationIdForWrites
              ? { ...f, dancers: f.dancers.filter((x) => x.id !== dancerId) }
              : f,
          ),
        };
        if (spot) {
          next = syncRosterAfterRemovingLinkedMembersFromFirstCue(
            next,
            formationIdForWrites,
            [spot],
          );
        }
        return next;
      });
      setSelectedDancerIds((ids) =>
        removeDancerFromSelection(ids, dancerId),
      );
      setDancerQuickEditId((id) => (id === dancerId ? null : id));
      setStageContextMenu(null);
    },
    [
      writeFormation,
      formationIdForWrites,
      setProject,
      viewMode,
      stageInteractionsEnabled,
    ],
  );

  /** 選択（または右クリック対象）のメンバーを複製し、少しずらして追加。新しい印だけ選択する。 */
  const duplicateDancerIds = useCallback(
    (ids: string[]) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false ||
        playbackOrPreview
      )
        return;
      const uniq = [...new Set(ids.filter(Boolean))];
      if (uniq.length === 0) return;
      const fid = formationIdForWrites;
      const snapshots = uniq
        .map((id) => writeFormation.dancers.find((d) => d.id === id))
        .filter((d): d is DancerSpot => d != null);
      if (snapshots.length === 0) return;
      const clones: DancerSpot[] = snapshots.map((d) => {
        const nid = generateId();
        const base = (d.label || "?").trim() || "?";
        const label = base.length <= 12 ? `${base}′` : `${base.slice(0, 11)}′`;
        return {
          ...d,
          id: nid,
          label,
          xPct: round2(
            clamp(
              d.xPct + 2.5,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI,
            ),
          ),
          yPct: round2(
            clamp(
              d.yPct + 2.5,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI,
            ),
          ),
          crewMemberId: undefined,
          markerBadge: undefined,
        };
      });
      const newIds = clones.map((c) => c.id);
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) =>
          f.id === fid
            ? {
                ...f,
                dancers: [...f.dancers, ...clones],
                confirmedDancerCount: f.dancers.length + clones.length,
              }
            : f,
        ),
      }));
      setSelectedDancerIds(newIds);
      setStageContextMenu(null);
    },
    [
      writeFormation,
      formationIdForWrites,
      setProject,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
    ],
  );

  /**
   * 範囲選択でまとめた複数ダンサーを一括で削除する。
   * ゴミ箱へ群ドロップしたときに使う。
   */
  const removeDancersByIds = useCallback(
    (dancerIds: string[]) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false ||
        dancerIds.length === 0
      )
        return;
      const removeSet = new Set(dancerIds);
      const removedSpots = writeFormation.dancers.filter((x) =>
        removeSet.has(x.id),
      );
      setProject((p) => {
        let next: ChoreographyProjectJson = {
          ...p,
          formations: p.formations.map((f) =>
            f.id === formationIdForWrites
              ? { ...f, dancers: f.dancers.filter((x) => !removeSet.has(x.id)) }
              : f,
          ),
        };
        next = syncRosterAfterRemovingLinkedMembersFromFirstCue(
          next,
          formationIdForWrites,
          removedSpots,
        );
        return next;
      });
      setSelectedDancerIds((ids) =>
        removeDancersFromSelection(ids, removeSet),
      );
      setDancerQuickEditId((id) =>
        id != null && removeSet.has(id) ? null : id,
      );
      setStageContextMenu(null);
    },
    [
      writeFormation,
      formationIdForWrites,
      setProject,
      viewMode,
      stageInteractionsEnabled,
    ],
  );

  const setTrashHotIfChanged = useCallback((v: boolean) => {
    if (trashHotRef.current === v) return;
    trashHotRef.current = v;
    setTrashHot(v);
  }, []);

  const hitTrashDropZone = useCallback((clientX: number, clientY: number) => {
    if (!trashRevealActiveRef.current) return false;
    const dock = trashDockViewportRef.current;
    if (dock) {
      const r = dock.getBoundingClientRect();
      return (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      );
    }
    if (typeof window === "undefined") return false;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const strip = trashViewportStripWidthPx(w);
    return clientX >= 0 && clientX <= strip && clientY >= 0 && clientY <= h;
  }, []);

  const quantizeCoord = useCallback(
    (v: number, axis: "x" | "y", mode: StageDancerSnapMode) => {
      const c = clamp(
        v,
        DANCER_STAGE_POSITION_PCT_LO,
        DANCER_STAGE_POSITION_PCT_HI,
      );
      if (mode === "free" || !snapGrid) return round2(c);
      if (mmSnapGrid) {
        const base = axis === "x" ? mmSnapGrid.stepXPct : mmSnapGrid.stepYPct;
        const useStep = mode === "fine" ? Math.max(0.05, base / 4) : base;
        return round2(
          clamp(
            Math.round(c / useStep) * useStep,
            DANCER_STAGE_POSITION_PCT_LO,
            DANCER_STAGE_POSITION_PCT_HI,
          ),
        );
      }
      const step = mode === "fine" ? Math.max(0.25, gridStep / 4) : gridStep;
      return round2(
        clamp(
          Math.round(c / step) * step,
          DANCER_STAGE_POSITION_PCT_LO,
          DANCER_STAGE_POSITION_PCT_HI,
        ),
      );
    },
    [snapGrid, gridStep, mmSnapGrid],
  );

  const pointerToPctInRoot = useCallback(
    (
      rootEl: HTMLElement,
      clientX: number,
      clientY: number,
      shiftKey: boolean,
      /** ダンサー印のドラッグ時のみ true。大道具の移動では false のまま。 */
      snapHorizontalCenter50mm = false,
    ) => {
      const r = rootEl.getBoundingClientRect();
      if (r.width < 1e-6 || r.height < 1e-6) return null;
      const xPct = ((clientX - r.left) / r.width) * 100;
      const yPct = ((clientY - r.top) / r.height) * 100;
      const mode: StageDancerSnapMode = snapGrid
        ? shiftKey
          ? "fine"
          : "grid"
        : "free";
      let snappedX = quantizeCoord(xPct, "x", mode);
      const snappedY = quantizeCoord(yPct, "y", mode);
      /**
       * ダンサー移動時: センターからの水平距離が 5cm（50mm）刻みになるよう x を丸める。
       * Shift 押下時は抑止。大道具の移動では使わない。
       */
      const widthMm = stageResizeDraft?.stageWidthMm ?? stageWidthMm ?? null;
      if (
        snapHorizontalCenter50mm &&
        !shiftKey &&
        typeof widthMm === "number" &&
        widthMm > 0
      ) {
        snappedX = round2(
          snapXPctToCenterDistanceMmGrid(snappedX, widthMm, 50),
        );
      }
      return { xPct: snappedX, yPct: snappedY };
    },
    [
      snapGrid,
      quantizeCoord,
      stageWidthMm,
      mmSnapGrid,
      stageResizeDraft?.stageWidthMm,
    ],
  );

  const {
    selectedSetPieceId,
    setSelectedSetPieceId,
    removeSetPieceById,
    handlePointerDownSetPiece,
    handlePointerDownSetPieceResize,
    handlePointerDownSetPieceRotate,
    handleSetPieceBodyContextMenu,
    handleSetPieceToggleInterpolate,
    resetSetPieceInteraction,
  } = useSetPieceInteraction({
    viewMode,
    stageInteractionsEnabled,
    setPiecesEditable,
    writeFormation,
    snapGrid,
    gridStep,
    mmSnapGrid,
    stageMainFloorRef,
    viewportTextOverlayRoot,
    updateActiveFormation,
    pointerToPctInRoot,
    onSetPieceContextMenu: setStageContextMenu,
  });

  useEffect(() => {
    onGestureHistoryCancel?.();
    setDancerQuickEditId(null);
    clearSelectedDancers();
    setStageContextMenu(null);
    resetSetPieceInteraction();
    setMarquee(null);
    marqueeSessionRef.current = null;
    groupDragRef.current = null;
    resetMarkerHandles();
    resetFloorTextInteraction();
    setDragGhostById(null);
    setFloorMarkupTool(null);
    resetFloorLineDraw();
    setShowStageDancerColorToolbar(false);
    setBulkHideDancerGlyphs(false);
    setGroupRotateGuideDeltaDeg(null);
  }, [
    formationIdForWrites,
    onGestureHistoryCancel,
    clearSelectedDancers,
    resetFloorTextInteraction,
    resetFloorLineDraw,
    resetMarkerHandles,
    resetSetPieceInteraction,
  ]);

  const pxToPct = useCallback(
    (
      clientX: number,
      clientY: number,
      shiftKey: boolean,
      snapHorizontalCenter50mm = false,
    ) => {
      const el = stageMainFloorRef.current;
      if (!el) return null;
      return pointerToPctInRoot(
        el,
        clientX,
        clientY,
        shiftKey,
        snapHorizontalCenter50mm,
      );
    },
    [pointerToPctInRoot],
  );

  /**
   * 現在のダンサー一覧を pointermove ハンドラから参照するための ref。
   * displayDancers が変わるたびに更新する。useCallback の deps を増やさずに済む。
   */
  const displayDancersSnapRef = useRef(displayDancers);
  useEffect(() => {
    displayDancersSnapRef.current = displayDancers;
  });

  /**
   * ドラッグ中の立ち位置を、ステージのセンター線（x=50 / y=50）および
   * 他ダンサーの x/y 座標に揃えて吸着させる。
   * 揃った方向は guideX/guideY として返し、SVG 補助線に反映される。
   *
   * @param xPct       現在の x（％）
   * @param yPct       現在の y（％）
   * @param excludeIds ドラッグ中のダンサー自身（スナップ候補から除外）
   * @param strong     Shift 等で一時的にスナップを無効化したい場合は false
   */
  const computeAlignmentSnap = useCallback(
    (
      xPct: number,
      yPct: number,
      excludeIds: ReadonlySet<string>,
      strong: boolean,
    ): {
      xPct: number;
      yPct: number;
      guideX: number | null;
      guideY: number | null;
    } => {
      if (!strong) {
        return { xPct, yPct, guideX: null, guideY: null };
      }
      /** 吸着する距離しきい値（％）。ステージ幅の約 1.2% 程度 */
      const THRESHOLD = 1.2;
      /** センター + 他ダンサーの座標をスナップ候補に追加 */
      const xCandidates: number[] = [50];
      const yCandidates: number[] = [50];
      for (const d of displayDancersSnapRef.current) {
        if (excludeIds.has(d.id)) continue;
        xCandidates.push(d.xPct);
        yCandidates.push(d.yPct);
      }
      let bestXDist = THRESHOLD;
      let guideX: number | null = null;
      let snappedX = xPct;
      for (const cx of xCandidates) {
        const dist = Math.abs(xPct - cx);
        if (dist < bestXDist) {
          bestXDist = dist;
          guideX = cx;
          snappedX = cx;
        }
      }
      let bestYDist = THRESHOLD;
      let guideY: number | null = null;
      let snappedY = yPct;
      for (const cy of yCandidates) {
        const dist = Math.abs(yPct - cy);
        if (dist < bestYDist) {
          bestYDist = dist;
          guideY = cy;
          snappedY = cy;
        }
      }
      return {
        xPct: round2(snappedX),
        yPct: round2(snappedY),
        guideX,
        guideY,
      };
    },
    [],
  );

  const handlePointerDownDancer = useCallback(
    (e: ReactPointerEvent, dancerId: string, xPct: number, yPct: number) => {
      if (e.button !== 0) return;
      if (dancerQuickEditId) return;
      if (
        viewMode === "view" ||
        playbackDancers ||
        previewDancers ||
        !stageInteractionsEnabled
      )
        return;
      if (e.altKey && stageMainFloorRef.current) {
        const floor = stageMainFloorRef.current;
        const stack = document
          .elementsFromPoint(e.clientX, e.clientY)
          .filter(
            (n): n is HTMLElement =>
              n instanceof HTMLElement &&
              typeof n.dataset.dancerId === "string" &&
              n.dataset.dancerId !== "" &&
              floor.contains(n),
          )
          .map((n) => n.dataset.dancerId!);
        const uniq = [...new Set(stack)];
        if (uniq.length > 1) {
          const next = pickNextDancerInStack(uniq, dancerId);
          if (next != null) {
            setSelectedDancerIds(replaceSelectionWithSingle(next));
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }
      e.stopPropagation();

      /** Shift / Cmd / Ctrl クリックは「追加選択のトグル」だけで、ドラッグは始めない */
      const toggleOnly = e.shiftKey || e.metaKey || e.ctrlKey;
      let nextSelection: string[];
      if (toggleOnly) {
        setSelectedDancerIds((ids) =>
          toggleDancerAdditiveSelection(ids, dancerId),
        );
        return;
      }
      if ((selectedDancerIds ?? []).includes(dancerId)) {
        /** すでに選択中 → 現在の選択を保ったまま、その全員をドラッグで一括移動 */
        nextSelection = selectedDancerIds;
      } else {
        /** 未選択のダンサーを押した場合はその 1 人だけ選択しなおす */
        nextSelection = replaceSelectionWithSingle(dancerId);
        setSelectedDancerIds(nextSelection);
      }

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const el = stageMainFloorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + (xPct / 100) * r.width;
      const cy = r.top + (yPct / 100) * r.height;
      if (nextSelection.length <= 1) {
        dragRef.current = {
          dancerId,
          offsetXPx: e.clientX - cx,
          offsetYPx: e.clientY - cy,
          startXPct: xPct,
          startYPct: yPct,
        };
        setDragGhostById(new Map([[dancerId, { xPct, yPct }]]));
        onGestureHistoryBegin?.();
        return;
      }
      /** 複数選択の一括移動: 各ダンサーの初期位置を覚えておき、差分だけ一斉に動かす */
      const dancers = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      const startPositions = new Map<string, { xPct: number; yPct: number }>();
      for (const id of nextSelection) {
        const d = dancers.find((x) => x.id === id);
        if (d) startPositions.set(id, { xPct: d.xPct, yPct: d.yPct });
      }
      groupDragRef.current = {
        mode: "move",
        ids: nextSelection,
        startPositions,
        startClientX: e.clientX,
        startClientY: e.clientY,
        floorWpx: r.width,
        floorHpx: r.height,
      };
      setBulkHideDancerGlyphs(true);
      setDragGhostById(new Map(startPositions));
      onGestureHistoryBegin?.();
    },
    [
      dancerQuickEditId,
      viewMode,
      playbackDancers,
      previewDancers,
      stageInteractionsEnabled,
      stageMainFloorRef,
      selectedDancerIds,
      setSelectedDancerIds,
      writeFormation,
      activeFormation,
      onGestureHistoryBegin,
      setDragGhostById,
      setBulkHideDancerGlyphs,
    ],
  );

  /** 複数選択の bounding box リサイズ開始 */
  const handlePointerDownGroupBoxHandle = useCallback(
    (
      e: ReactPointerEvent,
      handle: GroupBoxHandle,
      startBox: { x0: number; y0: number; x1: number; y1: number },
    ) => {
      if (e.button !== 0) return;
      if (
        viewMode === "view" ||
        playbackDancers ||
        previewDancers ||
        !stageInteractionsEnabled
      )
        return;
      if (selectedDancerIds.length < 2) return;
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const el = stageMainFloorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dancers = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      const startPositions = new Map<string, { xPct: number; yPct: number }>();
      for (const id of selectedDancerIds) {
        const d = dancers.find((x) => x.id === id);
        if (d) startPositions.set(id, { xPct: d.xPct, yPct: d.yPct });
      }
      groupDragRef.current = {
        mode: "scale",
        handle,
        ids: [...selectedDancerIds],
        startBox: { ...startBox },
        startPositions,
        startClientX: e.clientX,
        startClientY: e.clientY,
        floorWpx: r.width,
        floorHpx: r.height,
      };
      setBulkHideDancerGlyphs(true);
      onGestureHistoryBegin?.();
    },
    [
      viewMode,
      playbackDancers,
      previewDancers,
      stageInteractionsEnabled,
      selectedDancerIds,
      stageMainFloorRef,
      writeFormation,
      activeFormation,
      onGestureHistoryBegin,
      setBulkHideDancerGlyphs,
    ],
  );

  /** 空ステージを押したら範囲選択を始める（および選択のクリア） */
  const handlePointerDownFloor = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (
        viewMode === "view" ||
        playbackDancers ||
        previewDancers ||
        !stageInteractionsEnabled
      )
        return;
      /** ダンサー／大道具／ハンドル以外の床面のときだけ反応（削除ゴミ箱は画面左オーバーレイ） */
      const target = e.target as HTMLElement;
      if (target.closest("[data-dancer-id]")) return;
      if (target.closest("[data-set-piece-id]")) return;
      if (target.closest("[data-group-box-handle]")) return;
      if (target.closest("[data-group-rotate-handle]")) return;
      if (target.closest("[data-marker-resize-handle]")) return;
      if (target.closest("[data-marker-rotate-handle]")) return;
      const el = stageMainFloorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const xPct = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
      const yPct = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);

      if (
        floorTextPlaceSession &&
        onFloorTextPlaceSessionChange &&
        setPiecesEditable &&
        writeFormation
      ) {
        if (target.closest("[data-floor-markup]")) return;
        if (target.closest("[data-floor-text-place-preview]")) return;
        e.preventDefault();
        e.stopPropagation();
        if (viewportTextOverlayRoot) {
          const rr = viewportTextOverlayRoot.getBoundingClientRect();
          const vx = clamp(((e.clientX - rr.left) / rr.width) * 100, 0, 100);
          const vy = clamp(((e.clientY - rr.top) / rr.height) * 100, 0, 100);
          onFloorTextPlaceSessionChange({
            ...floorTextPlaceSession,
            xPct: round2(vx),
            yPct: round2(vy),
          });
        } else {
          onFloorTextPlaceSessionChange({
            ...floorTextPlaceSession,
            xPct: round2(xPct),
            yPct: round2(yPct),
          });
        }
        return;
      }

      if (setPiecesEditable && writeFormation && floorMarkupTool === "text") {
        if (target.closest("[data-floor-markup]")) return;
        e.preventDefault();
        e.stopPropagation();
        const fs = Math.round(clamp(floorTextDraft.fontSizePx, 8, 56));
        const fw =
          Math.round(clamp(floorTextDraft.fontWeight, 300, 900) / 50) * 50;
        if (floorTextEditId) {
          const col = floorTextDraftColorHex(floorTextDraft.color);
          const fam =
            (floorTextDraft.fontFamily ?? "").trim() || FLOOR_TEXT_DEFAULT_FONT;
          const editMk = writeFormation.floorMarkup?.find(
            (x): x is StageFloorTextMarkup =>
              x.id === floorTextEditId && x.kind === "text",
          );
          const editLayer = editMk ? floorTextLayer(editMk) : "stage";
          const rr =
            editLayer === "screen" && viewportTextOverlayRoot
              ? viewportTextOverlayRoot.getBoundingClientRect()
              : r;
          const mx = clamp(((e.clientX - rr.left) / rr.width) * 100, 0, 100);
          const my = clamp(((e.clientY - rr.top) / rr.height) * 100, 0, 100);
          updateActiveFormation((f) => ({
            ...f,
            floorMarkup: (f.floorMarkup ?? []).map((m) =>
              m.id === floorTextEditId && m.kind === "text"
                ? {
                    ...m,
                    xPct: round2(mx),
                    yPct: round2(my),
                    fontSizePx: fs,
                    fontWeight: fw,
                    color: col,
                    fontFamily: fam,
                  }
                : m,
            ),
          }));
          return;
        }
        const t = floorTextDraft.body.trim();
        if (!t) return;
        const col = floorTextDraftColorHex(floorTextDraft.color);
        const fam =
          (floorTextDraft.fontFamily ?? "").trim() || FLOOR_TEXT_DEFAULT_FONT;
        const root = viewportTextOverlayRoot;
        const newText: StageFloorTextMarkup = {
          kind: "text",
          id: generateId(),
          xPct: round2(xPct),
          yPct: round2(yPct),
          text: t.slice(0, 400),
          color: col,
          fontFamily: fam,
          scale: 1,
          fontSizePx: fs,
          fontWeight: fw,
        };
        if (root) {
          const rr = root.getBoundingClientRect();
          if (rr.width > 0 && rr.height > 0) {
            newText.layer = "screen";
            newText.xPct = round2(
              clamp(((e.clientX - rr.left) / rr.width) * 100, 0, 100),
            );
            newText.yPct = round2(
              clamp(((e.clientY - rr.top) / rr.height) * 100, 0, 100),
            );
          }
        }
        updateActiveFormation((f) => ({
          ...f,
          floorMarkup: [...(f.floorMarkup ?? []), newText],
        }));
        setFloorTextDraft((d) => ({ ...d, body: "" }));
        setFloorTextEditId(null);
        return;
      }

      if (setPiecesEditable && writeFormation && floorMarkupTool === "line") {
        if (target.closest("[data-floor-markup]")) return;
        e.preventDefault();
        e.stopPropagation();
        beginFloorLineDraw(e.clientX, e.clientY, r);
        return;
      }

      if (floorMarkupTool === "erase") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      setSelectedFloorTextId(null);
      setFloorTextInlineRect(null);

      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      marqueeSessionRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startXPct: xPct,
        startYPct: yPct,
        floorWpx: r.width,
        floorHpx: r.height,
        additive,
        baseIds: additive ? [...selectedDancerIds] : [],
        movedPx: 0,
      };
      if (!additive) clearSelectedDancers();
      setSelectedSetPieceId(null);
    },
    [
      viewMode,
      playbackDancers,
      previewDancers,
      stageInteractionsEnabled,
      stageMainFloorRef,
      floorTextPlaceSession,
      onFloorTextPlaceSessionChange,
      setPiecesEditable,
      writeFormation,
      viewportTextOverlayRoot,
      floorMarkupTool,
      floorTextDraft,
      floorTextEditId,
      updateActiveFormation,
      setFloorTextDraft,
      setFloorTextEditId,
      beginFloorLineDraw,
      setSelectedFloorTextId,
      setFloorTextInlineRect,
      marqueeSessionRef,
      selectedDancerIds,
      clearSelectedDancers,
      setSelectedSetPieceId,
    ],
  );

  useEffect(() => {
    let queuedFormationUpdater:
      | ((
          f: NonNullable<typeof writeFormation>,
        ) => NonNullable<typeof writeFormation>)
      | null = null;
    let queuedFormationRafId: number | null = null;

    const flushQueuedFormationUpdate = () => {
      if (!queuedFormationUpdater) return;
      const updater = queuedFormationUpdater;
      queuedFormationUpdater = null;
      if (queuedFormationRafId != null) {
        cancelAnimationFrame(queuedFormationRafId);
        queuedFormationRafId = null;
      }
      updateActiveFormation(updater);
    };

    const queueFormationUpdate = (
      updater: (
        f: NonNullable<typeof writeFormation>,
      ) => NonNullable<typeof writeFormation>,
    ) => {
      queuedFormationUpdater = updater;
      if (queuedFormationRafId != null) return;
      queuedFormationRafId = requestAnimationFrame(() => {
        queuedFormationRafId = null;
        const nextUpdater = queuedFormationUpdater;
        queuedFormationUpdater = null;
        if (nextUpdater) updateActiveFormation(nextUpdater);
      });
    };

    const onMove = (e: PointerEvent) => {
      /** 1: 単一ダンサーのドラッグ（画面左端のゴミ箱帯へドロップで削除） */
      const d = dragRef.current;
      if (d) {
        const next = pxToPct(
          e.clientX - d.offsetXPx,
          e.clientY - d.offsetYPx,
          e.shiftKey,
          true,
        );
        if (!next) return;
        const reveal = pointerInViewportTrashRevealZone(e.clientX);
        if (reveal !== trashRevealActiveRef.current) {
          trashRevealActiveRef.current = reveal;
          setTrashUiVisible(reveal);
        }
        const overTrash = hitTrashDropZone(e.clientX, e.clientY);
        setTrashHotIfChanged(overTrash);
        if (overTrash) {
          if (alignGuides.x !== null || alignGuides.y !== null) {
            setAlignGuides({ x: null, y: null });
          }
          return;
        }
        /** 中央線・他ダンサーに近づいたら吸着し、揃っている方向をガイド線で示す */
        const snapped = computeAlignmentSnap(
          next.xPct,
          next.yPct,
          new Set([d.dancerId]),
          !e.shiftKey,
        );
        if (
          snapped.guideX !== alignGuides.x ||
          snapped.guideY !== alignGuides.y
        ) {
          setAlignGuides({ x: snapped.guideX, y: snapped.guideY });
        }
        queueFormationUpdate((f) => ({
          ...f,
          dancers: f.dancers.map((x) =>
            x.id === d.dancerId
              ? { ...x, xPct: snapped.xPct, yPct: snapped.yPct }
              : x,
          ),
        }));
        return;
      }
      /** 1b0: 床テキストの角スケール */
      const fr = floorTextResizeDragRef.current;
      if (fr && e.pointerId === fr.pointerId) {
        const nd = Math.max(
          12,
          Math.hypot(e.clientX - fr.anchorX, e.clientY - fr.anchorY),
        );
        const ratio = clamp(nd / fr.startDist, 0.12, 14);
        const nextScale = clamp(fr.startScale * ratio, 0.2, 8);
        queueFormationUpdate((f) => ({
          ...f,
          floorMarkup: (f.floorMarkup ?? []).map((x) =>
            x.id === fr.id && x.kind === "text"
              ? { ...x, scale: nextScale }
              : x,
          ),
        }));
        return;
      }
      /** 1ba: ツールなし時 — テキスト上のタップ vs ドラッグ移動 */
      const tapOr = floorTextTapOrDragRef.current;
      if (
        tapOr &&
        e.pointerId === tapOr.pointerId &&
        !floorMarkupTextDragRef.current
      ) {
        const dist = Math.hypot(
          e.clientX - tapOr.startClientX,
          e.clientY - tapOr.startClientY,
        );
        if (dist > FLOOR_TEXT_TAP_DRAG_THRESHOLD_PX) {
          floorMarkupTextDragRef.current = {
            id: tapOr.id,
            startClientX: tapOr.startClientX,
            startClientY: tapOr.startClientY,
            startXPct: tapOr.startXPct,
            startYPct: tapOr.startYPct,
            layer: tapOr.layer,
          };
          floorTextTapOrDragRef.current = null;
          const rectEl =
            tapOr.layer === "screen" && viewportTextOverlayRoot
              ? viewportTextOverlayRoot
              : stageMainFloorRef.current;
          if (rectEl) {
            const rr = rectEl.getBoundingClientRect();
            const dxPct = ((e.clientX - tapOr.startClientX) / rr.width) * 100;
            const dyPct = ((e.clientY - tapOr.startClientY) / rr.height) * 100;
            const nx = round2(clamp(tapOr.startXPct + dxPct, 0, 100));
            const ny = round2(clamp(tapOr.startYPct + dyPct, 0, 100));
            const tid = tapOr.id;
            queueFormationUpdate((f) => ({
              ...f,
              floorMarkup: (f.floorMarkup ?? []).map((x) =>
                x.id === tid && x.kind === "text"
                  ? { ...x, xPct: nx, yPct: ny }
                  : x,
              ),
            }));
          }
        }
        return;
      }
      /** 1b: 床に置いたテキストの移動（画面左端でゴミ箱表示・ドロップで削除） */
      const fmd = floorMarkupTextDragRef.current;
      if (fmd) {
        const rectEl =
          fmd.layer === "screen" && viewportTextOverlayRoot
            ? viewportTextOverlayRoot
            : stageMainFloorRef.current;
        if (!rectEl) return;
        const rr = rectEl.getBoundingClientRect();
        const dxPct = ((e.clientX - fmd.startClientX) / rr.width) * 100;
        const dyPct = ((e.clientY - fmd.startClientY) / rr.height) * 100;
        const nx = round2(clamp(fmd.startXPct + dxPct, 0, 100));
        const ny = round2(clamp(fmd.startYPct + dyPct, 0, 100));
        const reveal = pointerInViewportTrashRevealZone(e.clientX);
        if (reveal !== trashRevealActiveRef.current) {
          trashRevealActiveRef.current = reveal;
          setTrashUiVisible(reveal);
        }
        const overTrash = hitTrashDropZone(e.clientX, e.clientY);
        setTrashHotIfChanged(overTrash);
        if (overTrash) {
          return;
        }
        queueFormationUpdate((f) => ({
          ...f,
          floorMarkup: (f.floorMarkup ?? []).map((x) =>
            x.id === fmd.id && x.kind === "text"
              ? { ...x, xPct: nx, yPct: ny }
              : x,
          ),
        }));
        return;
      }
      /** 1c: ヘッダから置くテキストのプレビュー位置ドラッグ */
      const ftpd = floorTextPlaceDragRef.current;
      if (ftpd && onFloorTextPlaceSessionChange) {
        const rectEl = viewportTextOverlayRoot ?? stageMainFloorRef.current;
        if (!rectEl) return;
        const rr = rectEl.getBoundingClientRect();
        const dxPct = ((e.clientX - ftpd.startClientX) / rr.width) * 100;
        const dyPct = ((e.clientY - ftpd.startClientY) / rr.height) * 100;
        const nx = round2(clamp(ftpd.startXPct + dxPct, 0, 100));
        const ny = round2(clamp(ftpd.startYPct + dyPct, 0, 100));
        onFloorTextPlaceSessionChange({ ...ftpd.session, xPct: nx, yPct: ny });
        return;
      }
      /** 2: 複数選択の一括移動（ゴミ箱一括削除付き） */
      const g = groupDragRef.current;
      if (g && g.mode === "move") {
        let dxPct = ((e.clientX - g.startClientX) / g.floorWpx) * 100;
        let dyPct = ((e.clientY - g.startClientY) / g.floorHpx) * 100;
        const idSet = new Set(g.ids);
        const STAGE_CENTER_PCT = 50;
        const CENTER_GUIDE_EPS = 0.02;
        /** 群移動中もポインタが画面左端付近ならゴミ箱 UI を出す */
        const reveal = pointerInViewportTrashRevealZone(e.clientX);
        if (reveal !== trashRevealActiveRef.current) {
          trashRevealActiveRef.current = reveal;
          setTrashUiVisible(reveal);
        }
        const overTrash = hitTrashDropZone(e.clientX, e.clientY);
        setTrashHotIfChanged(overTrash);
        if (overTrash) {
          /** ゴミ箱ホバー中はダンサーを固定して追従させない（単体ドラッグと揃える） */
          if (alignGuides.x !== null || alignGuides.y !== null) {
            setAlignGuides({ x: null, y: null });
          }
          return;
        }
        /**
         * 群移動では先頭を代表にセンター線（50%）へだけ吸着し、全体を同じデルタで動かす。
         */
        let guideX: number | null = null;
        let guideY: number | null = null;
        const leadId = g.ids[0];
        const leadStart = leadId ? g.startPositions.get(leadId) : undefined;
        if (leadStart && !e.shiftKey) {
          const leadX = leadStart.xPct + dxPct;
          const leadY = leadStart.yPct + dyPct;
          const snapped = computeAlignmentSnap(leadX, leadY, idSet, true);
          dxPct += snapped.xPct - leadX;
          dyPct += snapped.yPct - leadY;
          guideX = snapped.guideX;
          guideY = snapped.guideY;
        }
        /**
         * 先頭がスナップしなかった場合も、選択中の誰かがセンター線または
         * 他ダンサーの座標に揃っていればガイドを出す。
         */
        const outsideDancers = displayDancersSnapRef.current.filter(
          (d) => !idSet.has(d.id),
        );
        if (guideX == null) {
          outer: for (const id of g.ids) {
            const s = g.startPositions.get(id);
            if (!s) continue;
            const nx = round2(
              clamp(
                s.xPct + dxPct,
                DANCER_STAGE_POSITION_PCT_LO,
                DANCER_STAGE_POSITION_PCT_HI,
              ),
            );
            const xTargets = [
              STAGE_CENTER_PCT,
              ...outsideDancers.map((d) => d.xPct),
            ];
            for (const tx of xTargets) {
              if (Math.abs(nx - tx) <= CENTER_GUIDE_EPS) {
                guideX = tx;
                break outer;
              }
            }
          }
        }
        if (guideY == null) {
          outer: for (const id of g.ids) {
            const s = g.startPositions.get(id);
            if (!s) continue;
            const ny = round2(
              clamp(
                s.yPct + dyPct,
                DANCER_STAGE_POSITION_PCT_LO,
                DANCER_STAGE_POSITION_PCT_HI,
              ),
            );
            const yTargets = [
              STAGE_CENTER_PCT,
              ...outsideDancers.map((d) => d.yPct),
            ];
            for (const ty of yTargets) {
              if (Math.abs(ny - ty) <= CENTER_GUIDE_EPS) {
                guideY = ty;
                break outer;
              }
            }
          }
        }
        if (guideX !== alignGuides.x || guideY !== alignGuides.y) {
          setAlignGuides({ x: guideX, y: guideY });
        }
        queueFormationUpdate((f) => ({
          ...f,
          dancers: f.dancers.map((x) => {
            if (!idSet.has(x.id)) return x;
            const s = g.startPositions.get(x.id);
            if (!s) return x;
            const nx = clamp(
              s.xPct + dxPct,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI,
            );
            const ny = clamp(
              s.yPct + dyPct,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI,
            );
            return { ...x, xPct: round2(nx), yPct: round2(ny) };
          }),
        }));
        return;
      }
      /** 3: 複数選択の群スケール（枠のハンドル） */
      if (g && g.mode === "scale") {
        const el = stageMainFloorRef.current;
        if (!el) return;
        const rr = el.getBoundingClientRect();
        const curXPct = clamp(((e.clientX - rr.left) / rr.width) * 100, 0, 100);
        const curYPct = clamp(((e.clientY - rr.top) / rr.height) * 100, 0, 100);
        /**
         * コーナーハンドルは既定で比率（アスペクト保持）スケール。
         * 辺ハンドルは 1 軸のみ。Shift を押すと挙動を反転（コーナーでも 1 軸・辺でも比率保持）。
         */
        const isCorner =
          g.handle === "ne" ||
          g.handle === "nw" ||
          g.handle === "se" ||
          g.handle === "sw";
        const keepAspect = e.shiftKey ? !isCorner : isCorner;
        const { sx, sy, ax, ay } = groupScaleForHandle(
          g.handle,
          g.startBox,
          curXPct,
          curYPct,
          keepAspect,
        );
        const idSet = new Set(g.ids);
        queueFormationUpdate((f) => ({
          ...f,
          dancers: f.dancers.map((x) => {
            if (!idSet.has(x.id)) return x;
            const s = g.startPositions.get(x.id);
            if (!s) return x;
            const nx = clamp(
              ax + (s.xPct - ax) * sx,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI,
            );
            const ny = clamp(
              ay + (s.yPct - ay) * sy,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI,
            );
            return { ...x, xPct: round2(nx), yPct: round2(ny) };
          }),
        }));
        setTrashHotIfChanged(false);
        return;
      }
      /** 4: 向き（丸い回転ハンドル）— 1 人は向きのみ。複数は枠中心まわりに位置＋向きを剛体回転 */
      if (applyMarkerRotateMove(e)) {
        setTrashHotIfChanged(false);
        return;
      }
      /** 5: 代表ダンサー右下の○サイズハンドル（選択中の全員に同じ差分を適用） */
      if (applyMarkerResizeMove(e)) {
        setTrashHotIfChanged(false);
        return;
      }
      /** 6: マーキー（範囲選択） */
      const mq = marqueeSessionRef.current;
      if (mq) {
        const el = stageMainFloorRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const curXPct = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
        const curYPct = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
        mq.movedPx = Math.max(
          mq.movedPx,
          Math.hypot(e.clientX - mq.startClientX, e.clientY - mq.startClientY),
        );
        setMarquee({
          startXPct: mq.startXPct,
          startYPct: mq.startYPct,
          curXPct,
          curYPct,
        });
        setTrashHotIfChanged(false);
        return;
      }
      setTrashHotIfChanged(false);
    };
    const onUp = (e: PointerEvent) => {
      flushQueuedFormationUpdate();
      const tapUp = floorTextTapOrDragRef.current;
      if (tapUp && e.pointerId === tapUp.pointerId) {
        floorTextTapOrDragRef.current = null;
        const dist = Math.hypot(
          e.clientX - tapUp.startClientX,
          e.clientY - tapUp.startClientY,
        );
        if (dist <= FLOOR_TEXT_TAP_DRAG_THRESHOLD_PX && setPiecesEditable) {
          setSelectedFloorTextId(tapUp.id);
          setFloorTextDraft({
            body: tapUp.text,
            fontSizePx: tapUp.fontSizePx,
            fontWeight: tapUp.fontWeight,
            color: tapUp.color,
            fontFamily: tapUp.fontFamily,
          });
        }
      }
      const floorTextDragEnd = floorMarkupTextDragRef.current;
      if (floorTextDragEnd && hitTrashDropZone(e.clientX, e.clientY)) {
        onGestureHistoryEnd?.();
        markHistorySkipNextPush?.();
        removeFloorMarkupById(floorTextDragEnd.id);
      }
      const d = dragRef.current;
      const gUp = groupDragRef.current;
      if (d && hitTrashDropZone(e.clientX, e.clientY)) {
        onGestureHistoryEnd?.();
        markHistorySkipNextPush?.();
        removeDancerById(d.dancerId);
      } else if (
        gUp &&
        gUp.mode === "move" &&
        hitTrashDropZone(e.clientX, e.clientY)
      ) {
        onGestureHistoryEnd?.();
        markHistorySkipNextPush?.();
        removeDancersByIds(gUp.ids);
      } else if (
        d != null ||
        (gUp != null && (gUp.mode === "move" || gUp.mode === "scale"))
      ) {
        onGestureHistoryEnd?.();
      }
      dragRef.current = null;
      floorMarkupTextDragRef.current = null;
      floorTextResizeDragRef.current = null;
      floorTextPlaceDragRef.current = null;
      groupDragRef.current = null;
      commitMarkerRotateUp({ setProject, formationIdForWrites });
      commitMarkerResizeUp({
        setProject,
        formationIdForWrites,
        markerDiamDraftNow: markerDiamDraft,
      });
      /** マーキー完了 → 範囲内のダンサーを選択 */
      const mq = marqueeSessionRef.current;
      if (mq) {
        const el = stageMainFloorRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          const endXPct = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
          const endYPct = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
          const minX = Math.min(mq.startXPct, endXPct);
          const maxX = Math.max(mq.startXPct, endXPct);
          const minY = Math.min(mq.startYPct, endYPct);
          const maxY = Math.max(mq.startYPct, endYPct);
          const dragged = mq.movedPx > 3;
          if (dragged) {
            const dancersNow =
              writeFormation?.dancers ?? activeFormation?.dancers ?? [];
            const hit = dancersNow
              .filter(
                (x) =>
                  x.xPct >= minX &&
                  x.xPct <= maxX &&
                  x.yPct >= minY &&
                  x.yPct <= maxY,
              )
              .map((x) => x.id);
            const combined = mq.additive
              ? Array.from(new Set([...mq.baseIds, ...hit]))
              : hit;
            setSelectedDancerIds(combined);
          }
        }
        marqueeSessionRef.current = null;
        setMarquee(null);
      }
      setTrashHotIfChanged(false);
      trashRevealActiveRef.current = false;
      setTrashUiVisible(false);
      setAlignGuides({ x: null, y: null });
      setDragGhostById(null);
      setBulkHideDancerGlyphs(false);
      setGroupRotateGuideDeltaDeg(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      if (queuedFormationRafId != null) {
        cancelAnimationFrame(queuedFormationRafId);
        queuedFormationRafId = null;
      }
      queuedFormationUpdater = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [
    pxToPct,
    updateActiveFormation,
    hitTrashDropZone,
    removeDancerById,
    removeDancersByIds,
    removeFloorMarkupById,
    setTrashHotIfChanged,
    markerDiamDraft,
    applyMarkerRotateMove,
    applyMarkerResizeMove,
    commitMarkerRotateUp,
    commitMarkerResizeUp,
    setProject,
    writeFormation,
    activeFormation,
    computeAlignmentSnap,
    alignGuides.x,
    alignGuides.y,
    formationIdForWrites,
    onFloorTextPlaceSessionChange,
    setFloorMarkupTool,
    setPiecesEditable,
    onGestureHistoryEnd,
    markHistorySkipNextPush,
    viewportTextOverlayRoot,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (viewMode === "view") return;
      if (playbackDancers || previewDancers) return;
      if (dancerQuickEditId) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)
        return;
      if (t instanceof HTMLElement && t.isContentEditable) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateDancerIds(selectedDancerIds);
        return;
      }

      if (e.key === "Escape") {
        groupDragRef.current = null;
        resetMarkerHandles();
        floorMarkupTextDragRef.current = null;
        floorTextTapOrDragRef.current = null;
        clearSelectedDancers();
        setMarquee(null);
        marqueeSessionRef.current = null;
        setFloorMarkupTool(null);
        resetFloorLineDraw();
        setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
        setFloorTextEditId(null);
        setFloorTextInlineRect(null);
        setDragGhostById(null);
        setBulkHideDancerGlyphs(false);
        setGroupRotateGuideDeltaDeg(null);
        return;
      }
      /** 選択中が 1 件以上なら Alt+矢印で微移動。複数選択時は群全体を動かす。 */
      if (!e.altKey || selectedDancerIds.length === 0) return;
      const dk = e.key;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(dk))
        return;
      e.preventDefault();
      const stepPx = e.shiftKey ? 0.05 : 0.25;
      const shiftFine = e.shiftKey;
      const afterSnap = (nx: number, ny: number) => {
        const mode: StageDancerSnapMode = snapGrid ? "fine" : "free";
        let xPct = quantizeCoord(nx, "x", mode);
        const yPct = quantizeCoord(ny, "y", mode);
        if (
          !shiftFine &&
          typeof stageWidthMm === "number" &&
          stageWidthMm > 0 &&
          (dk === "ArrowLeft" || dk === "ArrowRight")
        ) {
          xPct = round2(snapXPctToCenterDistanceMmGrid(xPct, stageWidthMm, 50));
        }
        return { xPct, yPct };
      };
      const idSet = new Set(selectedDancerIds);
      updateActiveFormation((f) => ({
        ...f,
        dancers: f.dancers.map((x) => {
          if (!idSet.has(x.id)) return x;
          let nx = x.xPct;
          let ny = x.yPct;
          if (dk === "ArrowLeft") nx -= stepPx;
          if (dk === "ArrowRight") nx += stepPx;
          if (dk === "ArrowUp") ny -= stepPx;
          if (dk === "ArrowDown") ny += stepPx;
          const q = afterSnap(nx, ny);
          return { ...x, xPct: q.xPct, yPct: q.yPct };
        }),
      }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    viewMode,
    playbackDancers,
    previewDancers,
    dancerQuickEditId,
    selectedDancerIds,
    snapGrid,
    quantizeCoord,
    updateActiveFormation,
    mmSnapGrid,
    duplicateDancerIds,
    stageWidthMm,
    clearSelectedDancers,
    resetFloorLineDraw,
    setFloorMarkupTool,
    setFloorTextDraft,
    setFloorTextEditId,
    setFloorTextInlineRect,
    floorMarkupTextDragRef,
    floorTextTapOrDragRef,
    resetMarkerHandles,
  ]);

  /**
   * `rot` は `useStageBoardLayoutAfterDraft`（`stageShell` 相当の束）由来。
   * 客席を画面上にしたとき `rot` が 180° になり、帯ラベル・場ミリ数字が上下逆さまに見える。
   * 人数バッジと同様に、文字だけ画面に対して正立させる（transformOrigin で辺に固定）。
   */
  const labelScreenKeepUpright = useCallback(
    (origin: string): CSSProperties =>
      rot % 360 !== 0
        ? { transform: `rotate(${-rot}deg)`, transformOrigin: origin }
        : {},
    [rot],
  );

  /** 床下の一括ツールバー用。常に高さを確保してコンテナクエリの高さが選択で変わらないようにする */
  const canStageBulkTools =
    viewMode !== "view" &&
    stageInteractionsEnabled &&
    !playbackOrPreview &&
    !previewDancers;
  /** 右クリック後の色一括バーがあるときだけ下余白を確保（名前・向きの帯はステージまわりの設定に集約） */
  const reserveStageBulkToolbarHeight = showStageDancerColorToolbar;

  const tapStageToEditLayout =
    viewMode === "edit" &&
    !!playbackDancers &&
    !previewDancers &&
    typeof onRequestLayoutEditFromStage === "function";

  const handleTapOverlayPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!tapStageToEditLayout || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onRequestLayoutEditFromStage();
    },
    [tapStageToEditLayout, onRequestLayoutEditFromStage],
  );

  /**
   * センターに近い順に k=1,2,3…（左右の線は同じ番号）。xp は SVG / 観客席帯ラベル共通。
   * 上手・下手が左右対称になるよう、丸めや定数オフセットは入れずに厳密な％値を使う。
   */
  const guideLineDrawMarks = useMemo(() => {
    const interval = centerFieldGuideIntervalMm;
    if (interval == null || interval <= 0 || Wmm <= 0) return [];
    const half = Wmm / 2;
    const marks: { xp: number; k: number }[] = [];
    let k = 1;
    const maxPairs = 200;
    while (k * interval <= half + 1e-9 && k <= maxPairs) {
      const deltaPct = ((k * interval) / Wmm) * 100;
      const left = Math.min(100, Math.max(0, 50 - deltaPct));
      const right = Math.min(100, Math.max(0, 50 + deltaPct));
      marks.push({ xp: left, k });
      marks.push({ xp: right, k });
      k++;
    }
    return marks;
  }, [centerFieldGuideIntervalMm, Wmm]);

  const mainFloorStyle: CSSProperties = useMemo(
    () => ({
      position: "relative",
      width: "100%",
      height: "100%",
      minWidth: 0,
      minHeight: 0,
      /** 常に印を床パネル外（翼・花道側）にも描けるよう visible（再生中も客席帯を切らない） */
      overflow: "visible",
      background: `linear-gradient(180deg, #0f1729 0%, #0a0f18 42%, ${shell.bgDeep} 100%)`,
    }),
    [shell.bgDeep],
  );

  const mmLabel = useCallback(
    (xPct: number, yPct: number) => {
      if (stageWidthMm == null || stageDepthMm == null) return null;
      const xMm = Math.round((xPct / 100) * stageWidthMm);
      const yMm = Math.round((yPct / 100) * stageDepthMm);
      return `${xMm} × ${yMm} mm`;
    },
    [stageWidthMm, stageDepthMm],
  );

  const showTrashDrop =
    viewMode === "edit" &&
    !playbackDancers &&
    !previewDancers &&
    trashUiVisible;

  /** 選択中の代表ダンサー（先頭）の座標。○サイズハンドルをその右下に置く。 */
  const primarySelectedDancer = useMemo(() => {
    if (playbackOrPreview) return null;
    if (viewMode === "view") return null;
    if (!stageInteractionsEnabled) return null;
    if (selectedDancerIds.length < 1) return null;
    const ds = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
    const id = selectedDancerIds[0]!;
    const base = ds.find((x) => x.id === id) ?? null;
    if (!base) return null;
    const pos = markerGroupPosDraft?.get(id);
    if (!pos) return base;
    return { ...base, xPct: pos.xPct, yPct: pos.yPct };
  }, [
    selectedDancerIds,
    writeFormation,
    activeFormation,
    playbackOrPreview,
    viewMode,
    stageInteractionsEnabled,
    markerGroupPosDraft,
  ]);

  const quickEditDancer = useMemo(() => {
    if (!dancerQuickEditId || !writeFormation) return null;
    return (
      writeFormation.dancers.find((x) => x.id === dancerQuickEditId) ?? null
    );
  }, [dancerQuickEditId, writeFormation]);

  /** 名簿に紐づくときはメンバー側の身長・学年などをマージしてダイアログに出す */
  const quickEditDancerForDialog = useMemo((): DancerSpot | null => {
    if (!quickEditDancer) return null;
    const cmid = quickEditDancer.crewMemberId;
    if (!cmid) return quickEditDancer;
    for (const c of project.crews) {
      const m = c.members.find((x) => x.id === cmid);
      if (m) {
        const pick = (
          spot: string | undefined,
          crew: string | undefined,
        ): string | undefined =>
          spot != null && spot.trim() !== "" ? spot : crew;
        return {
          ...quickEditDancer,
          label:
            quickEditDancer.label?.trim() !== ""
              ? quickEditDancer.label
              : m.label,
          heightCm: quickEditDancer.heightCm ?? m.heightCm,
          gradeLabel: pick(quickEditDancer.gradeLabel, m.gradeLabel),
          genderLabel: pick(quickEditDancer.genderLabel, m.genderLabel),
          skillRankLabel: pick(
            quickEditDancer.skillRankLabel,
            m.skillRankLabel,
          ),
          note: pick(quickEditDancer.note, m.note),
        };
      }
    }
    return quickEditDancer;
  }, [quickEditDancer, project.crews]);

  const applyDancerQuickEdit = useCallback(
    (patch: DancerQuickEditApply) => {
      if (!formationIdForWrites || !dancerQuickEditId) return;
      setProject((p) => {
        const form = p.formations.find((f) => f.id === formationIdForWrites);
        const spot = form?.dancers.find((x) => x.id === dancerQuickEditId);
        if (!form || !spot) return p;
        const dancerId = spot.id;
        const cmid = spot.crewMemberId;
        const matches = (x: DancerSpot) =>
          x.id === dancerId || Boolean(cmid && x.crewMemberId === cmid);

        let crews = p.crews;
        if (cmid) {
          crews = p.crews.map((crew) => ({
            ...crew,
            members: crew.members.map((m) =>
              m.id === cmid
                ? {
                    ...m,
                    label: patch.label.slice(0, 120),
                    colorIndex: modDancerColorIndex(patch.colorIndex),
                    heightCm: patch.heightCm,
                    gradeLabel: patch.gradeLabel,
                    genderLabel: patch.genderLabel,
                    skillRankLabel: patch.skillRankLabel,
                    note: patch.note,
                  }
                : m,
            ),
          }));
        }

        return {
          ...p,
          crews,
          formations: p.formations.map((f) => ({
            ...f,
            dancers: f.dancers.map((x) => {
              if (!matches(x)) return x;
              const slicedBadge = sliceMarkerBadgeForStorage(patch.markerBadge);
              return {
                ...x,
                label: patch.label.slice(0, 120),
                colorIndex: modDancerColorIndex(patch.colorIndex),
                note: patch.note,
                heightCm: patch.heightCm,
                gradeLabel: patch.gradeLabel,
                genderLabel: patch.genderLabel,
                skillRankLabel: patch.skillRankLabel,
                markerBadge: slicedBadge,
                ...(slicedBadge ? { markerBadgeSource: undefined } : {}),
              };
            }),
          })),
        };
      });
    },
    [formationIdForWrites, dancerQuickEditId, setProject],
  );

  /** 範囲選択・Shift 複数選択の対象に、印の色を一括で当てる（名簿紐付け時は名簿の色も同期） */
  const applyBulkColorToDancerIds = useCallback(
    (targetIds: string[], colorIndex: number) => {
      if (!formationIdForWrites || targetIds.length === 0) return;
      if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
        return;
      const ci = modDancerColorIndex(colorIndex);
      const idSet = new Set(targetIds);
      setProject((p) => {
        const crewIds = new Set<string>();
        const form = p.formations.find((f) => f.id === formationIdForWrites);
        if (!form) return p;
        for (const d of form.dancers) {
          if (!idSet.has(d.id)) continue;
          if (d.crewMemberId) crewIds.add(d.crewMemberId);
        }
        const crews = p.crews.map((crew) => ({
          ...crew,
          members: crew.members.map((m) =>
            crewIds.has(m.id) ? { ...m, colorIndex: ci } : m,
          ),
        }));
        return {
          ...p,
          crews,
          formations: p.formations.map((f) => {
            if (f.id !== formationIdForWrites) return f;
            return {
              ...f,
              dancers: f.dancers.map((d) =>
                idSet.has(d.id) ? { ...d, colorIndex: ci } : d,
              ),
            };
          }),
        };
      });
    },
    [
      formationIdForWrites,
      setProject,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
    ],
  );

  /**
   * 名前を○の下にしているとき、選択した全員の○内表示をフォーメーション順で連番にする。
   */
  const applyBulkMarkerSequence = useCallback(
    (targetIds: string[], startNum: number) => {
      if (!formationIdForWrites || targetIds.length === 0) return;
      if (
        !dancerLabelBelow ||
        viewMode === "view" ||
        !stageInteractionsEnabled ||
        playbackOrPreview
      )
        return;
      if (!Number.isFinite(startNum)) return;
      let n = Math.floor(startNum);
      const idSet = new Set(targetIds);
      setProject((p) => {
        const form = p.formations.find((f) => f.id === formationIdForWrites);
        if (!form) return p;
        const ordered = form.dancers.filter((d) => idSet.has(d.id));
        if (ordered.length === 0) return p;
        const idToBadge = new Map<string, string>();
        for (const d of ordered) {
          idToBadge.set(d.id, String(n).slice(0, 3));
          n += 1;
        }
        return {
          ...p,
          formations: p.formations.map((f) => {
            if (f.id !== formationIdForWrites) return f;
            return {
              ...f,
              dancers: f.dancers.map((d) => {
                const b = idToBadge.get(d.id);
                if (b === undefined) return d;
                return { ...d, markerBadge: b, markerBadgeSource: undefined };
              }),
            };
          }),
        };
      });
    },
    [
      formationIdForWrites,
      setProject,
      dancerLabelBelow,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
    ],
  );

  /** 名前を○の下にしているとき、選択した全員の○内表示を同じ文字列にする。 */
  const applyBulkMarkerSame = useCallback(
    (targetIds: string[], badgeRaw: string) => {
      if (!formationIdForWrites || targetIds.length === 0) return;
      if (
        !dancerLabelBelow ||
        viewMode === "view" ||
        !stageInteractionsEnabled ||
        playbackOrPreview
      )
        return;
      const badge = sliceMarkerBadgeForStorage(badgeRaw) ?? "";
      if (!badge) return;
      const idSet = new Set(targetIds);
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) => {
          if (f.id !== formationIdForWrites) return f;
          return {
            ...f,
            dancers: f.dancers.map((d) =>
              idSet.has(d.id)
                ? { ...d, markerBadge: badge, markerBadgeSource: undefined }
                : d,
            ),
          };
        }),
      }));
    },
    [
      formationIdForWrites,
      setProject,
      dancerLabelBelow,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
    ],
  );

  /** 「名前は○の下」のとき、選択メンバーの○内を空欄（連番フォールバックなし）にする */
  const applyBulkMarkerClear = useCallback(
    (targetIds: string[]) => {
      if (!formationIdForWrites || targetIds.length === 0) return;
      if (
        !dancerLabelBelow ||
        viewMode === "view" ||
        !stageInteractionsEnabled ||
        playbackOrPreview
      )
        return;
      const idSet = new Set(targetIds);
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) => {
          if (f.id !== formationIdForWrites) return f;
          return {
            ...f,
            dancers: f.dancers.map((d) =>
              idSet.has(d.id)
                ? { ...d, markerBadge: "", markerBadgeSource: undefined }
                : d,
            ),
          };
        }),
      }));
    },
    [
      formationIdForWrites,
      setProject,
      dancerLabelBelow,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
    ],
  );

  /**
   * 「名前は○の下」のとき、○内を「センターからの距離」モードにする。
   * 印の中心 x と現在のステージ幅から毎回 5cm 刻みの整数（cm）で表示するので、隣同士間隔や横幅を変えても数字が追従する。
   */
  const applyBulkMarkerCenterDistance = useCallback(
    (targetIds: string[]) => {
      if (!formationIdForWrites || targetIds.length === 0) return;
      if (
        !dancerLabelBelow ||
        viewMode === "view" ||
        !stageInteractionsEnabled ||
        playbackOrPreview
      )
        return;
      const Wmm = effStageWidthMm ?? 0;
      if (!(Wmm > 0)) {
        window.alert(
          "ステージの横幅（メイン床の幅）が未設定のため、センターからの距離を入れられません。舞台設定で幅を入れてください。",
        );
        return;
      }
      const idSet = new Set(targetIds);
      setProject((p) => {
        const WInner = effStageWidthMm ?? p.stageWidthMm ?? 0;
        if (!(WInner > 0)) return p;
        return {
          ...p,
          formations: p.formations.map((f) => {
            if (f.id !== formationIdForWrites) return f;
            return {
              ...f,
              dancers: f.dancers.map((d) => {
                if (!idSet.has(d.id)) return d;
                return {
                  ...d,
                  markerBadgeSource: "centerDistance",
                  markerBadge: "",
                };
              }),
            };
          }),
        };
      });
    },
    [
      formationIdForWrites,
      setProject,
      dancerLabelBelow,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
      effStageWidthMm,
    ],
  );

  const applyDancerArrange = useCallback(
    (fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false ||
        playbackOrPreview
      )
        return;
      if (!stageContextMenu || stageContextMenu.kind !== "dancer") return;
      const targetIds = resolveArrangeTargetIds(
        stageContextMenu.dancerId,
        selectedDancerIds,
      );
      updateActiveFormation((f) => ({
        ...f,
        dancers: fn(f.dancers, targetIds),
      }));
      setStageContextMenu(null);
    },
    [
      writeFormation,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
      stageContextMenu,
      selectedDancerIds,
      updateActiveFormation,
    ],
  );

  /** 位置の形を保った入れ替え（2人以上必須） */
  const applyPermuteArrange = useCallback(
    (fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]) => {
      if (!stageContextMenu || stageContextMenu.kind !== "dancer") return;
      const targetIds = resolveArrangeTargetIds(
        stageContextMenu.dancerId,
        selectedDancerIds,
      );
      if (targetIds.length < 2) {
        window.alert(
          "いまの立ち位置のままの並び替えは、対象を 2 人以上選んでください。",
        );
        setStageContextMenu(null);
        return;
      }
      applyDancerArrange(fn);
    },
    [stageContextMenu, selectedDancerIds, applyDancerArrange],
  );

  const contextMenuStyle: CSSProperties | null = stageContextMenu
    ? computeStageContextMenuStyle(stageContextMenu)
    : null;

  const stageSetPieceElements = useSetPieceBlockElements({
    pieces: stageSetPieces,
    coord: "stage",
    selectedSetPieceId,
    setPiecesEditable,
    snapGrid,
    viewMode,
    playbackOrPreview,
    onBodyPointerDown: handlePointerDownSetPiece,
    onBodyContextMenu: handleSetPieceBodyContextMenu,
    onToggleInterpolateInGaps: handleSetPieceToggleInterpolate,
    onResizePointerDown: handlePointerDownSetPieceResize,
    onRotatePointerDown: handlePointerDownSetPieceRotate,
  });

  const screenSetPieceElements = useSetPieceBlockElements({
    pieces: screenSetPieces,
    coord: "screen",
    selectedSetPieceId,
    setPiecesEditable,
    snapGrid,
    viewMode,
    playbackOrPreview,
    onBodyPointerDown: handlePointerDownSetPiece,
    onBodyContextMenu: handleSetPieceBodyContextMenu,
    onToggleInterpolateInGaps: handleSetPieceToggleInterpolate,
    onResizePointerDown: handlePointerDownSetPieceResize,
    onRotatePointerDown: handlePointerDownSetPieceRotate,
  });

  const stageDancerMarkerElements = useStageDancerMarkerElements({
    dancersForStageMarkers,
    effectiveMarkerPx,
    effectiveFacingDeg,
    bulkHideDancerGlyphs,
    playbackOrPreview,
    selectedDancerIds,
    effStageWidthMm,
    dancerLabelBelow,
    nameBelowClearanceExtraPx,
    rot,
    mmLabel,
    snapGrid,
    handlePointerDownDancer,
    viewMode,
    playbackDancers,
    previewDancers,
    stageInteractionsEnabled,
    rubyAccent: shell.ruby,
    dancerQuickEditId,
    setShowStageDancerColorToolbar,
    setStageContextMenu,
    setDancerQuickEditId,
    studentViewerFocus,
  });

  const screenOverlayOpen = Boolean(
    viewportTextOverlayRoot &&
    (screenFloorTexts.length > 0 ||
      floorTextPlaceSession ||
      screenSetPieces.length > 0),
  );

  const stageBoardExportColumn: StageExportRootColumnProps =
    // eslint-disable-next-line react-hooks/refs -- refs are forwarded into props; build does not read `.current`
    buildStageBoardExportColumnProps({
      /* エクスポート列メタ（プレビュー・人数・回転・花道・形状フラグ） */
      previewDancers,
      displayDancers,
      stageRotationDeg: rot,
      hanamichiEnabled,
      stageShapeActive,
      hanamichiDepthPct,
      /* メイン床：シェル寸法・床パネル */
      shellDims: {
        showShell,
        Bmm,
        Dmm,
        Wmm,
        Smm,
        labelScreenKeepUpright,
      },
      stageMainFloorRef,
      isPlaying,
      trimStartSec: project.trimStartSec,
      onPointerDownFloor: handlePointerDownFloor,
      mainFloorStyle,
      setPiecesEditable,
      /* 床マークアップ浮遊ツール（setPiecesEditable 時のみ有効） */
      floorMarkupToolbarWhenEditable: {
        hideFloorMarkupFloatingToolbars,
        floorMarkupTool,
        setFloorMarkupTool,
        floorTextEditId,
        setFloorTextEditId,
        floorTextDraft,
        setFloorTextDraft,
        updateActiveFormation,
        floorLineSessionRef,
        setFloorLineDraft,
        setFloorTextInlineRect,
      },
      /* 床下オーバーレイ（形状・格子・ガイド・床線／テキスト） */
      baseOverlaysWithoutShow: {
        stageShapeActive,
        stageShapeMaskPath,
        stageShapeSvgPoints,
        hasStageDims,
        showStageMmGridOverlay,
        mmSnapGrid,
        stageGridLinesVertical,
        stageGridLinesHorizontal,
        guideLineDrawMarks,
        alignGuides,
        displayFloorMarkup,
        floorLineDraft,
        floorMarkupTool,
        setPiecesEditable,
        onRemoveFloorLineById: removeFloorMarkupById,
        textShared: floorTextMarkupSharedProps,
        floorTextPlaceSession: floorTextPlaceSession ?? null,
        viewportTextOverlayRoot,
        playbackOrPreview,
        onFloorTextPlaceSessionChange,
        onFloorTextPlacePreviewPointerDown:
          handleFloorTextPlacePreviewPointerDown,
      },
      showStageFloorMarkup: displayFloorMarkup.length > 0 || !!floorLineDraft,
      /* 操作層（大道具・ダンサー印・マーキー等） */
      interaction: {
        setPieceElements: stageSetPieceElements,
        selectionBox,
        groupRotateGuideDeltaDeg,
        playbackOrPreview,
        viewMode,
        stageInteractionsEnabled,
        marquee,
        primarySelectedDancer,
        effectiveMarkerPx,
        effectiveFacingDeg,
        onGroupBoxHandlePointerDown: handlePointerDownGroupBoxHandle,
        selectedDancerIds,
        onGroupRotatePointerDown: handlePointerDownMarkerRotate,
        dragGhostById,
        stageDancerById,
        bulkHideDancerGlyphs,
        dancerLabelBelow,
        stageDancerIndexById,
        effStageWidthMm: effStageWidthMm ?? 0,
        nameBelowClearanceExtraPx,
        rot,
        dancerMarkerElements: stageDancerMarkerElements,
        onMarkerResizePointerDown: handlePointerDownMarkerResize,
        tapStageToEditLayout,
        onTapEditOverlayPointerDown: handleTapOverlayPointerDown,
      },
    } satisfies BuildStageBoardExportColumnInput);

  const stageBoardLayoutSlots = {
    /* screen レイヤー（床テキスト・大道具など） */
    screenOverlay: (
      <StageBoardScreenOverlay
        root={viewportTextOverlayRoot}
        open={screenOverlayOpen}
        screenFloorTexts={screenFloorTexts}
        markupShared={floorTextMarkupSharedProps}
        screenSetPieceElements={screenSetPieceElements}
        floorTextPlaceSession={floorTextPlaceSession ?? null}
        setPiecesEditable={Boolean(setPiecesEditable)}
        playbackOrPreview={playbackOrPreview}
        onFloorTextPlaceSessionChange={onFloorTextPlaceSessionChange}
        onFloorTextPlacePreviewPointerDown={
          handleFloorTextPlacePreviewPointerDown
        }
      />
    ),
    /* プレビュー帯・ステージ枠・床下一括色ツール */
    mainColumn: (
      <StageBoardMainColumn
        previewBanner={
          <StageBoardPreviewFormationBanner
            show={Boolean(previewDancers && previewDancers.length > 0)}
          />
        }
        stageFrame={
          <StageBoardStageFrame
            hasStageDims={hasStageDims}
            outerWmm={outerWmm}
            outerDmm={outerDmm}
            stageAspectRatio={stageAspectRatio}
            rotationDeg={rot}
            showResizeHandles={
              viewMode !== "view" &&
              stageInteractionsEnabled &&
              !playbackDancers &&
              !previewDancers
            }
            hoveredHandle={hoveredStageHandle}
            resizeDraftActive={Boolean(stageResizeDraft)}
            onResizePointerDown={onStageCornerResizeDown}
            onHandlePointerEnter={setHoveredStageHandle}
            onHandlePointerLeave={(h) =>
              setHoveredStageHandle((cur) => (cur === h ? null : cur))
            }
            exportColumn={stageBoardExportColumn}
          />
        }
        bulkToolbar={
          canStageBulkTools ? (
            <StageBoardBulkToolbarSlot
              reserveMinHeight={reserveStageBulkToolbarHeight}
            >
              <StageBoardBulkColorToolbar
                open={
                  selectedDancerIds.length >= 1 && showStageDancerColorToolbar
                }
                selectedCount={selectedDancerIds.length}
                primarySelectedDancer={primarySelectedDancer}
                onSelectPaletteIndex={(i) =>
                  applyBulkColorToDancerIds(selectedDancerIds, i)
                }
              />
            </StageBoardBulkToolbarSlot>
          ) : null
        }
      />
    ),
    /* ステージ上の右クリックメニュー */
    stageContextMenu:
      stageContextMenu && contextMenuStyle ? (
        <StageBoardContextMenuLayer
          menu={stageContextMenu}
          style={contextMenuStyle}
          containerRef={stageContextMenuRef}
          onCloseMenu={() => setStageContextMenu(null)}
          dancerMenu={{
            selectedDancerIds,
            menuInteractionDisabled:
              viewMode === "view" ||
              !stageInteractionsEnabled ||
              Boolean(playbackDancers) ||
              Boolean(previewDancers),
            rawDancerLabelPosition: project.dancerLabelPosition,
            dancerLabelBelow,
            setProject,
            duplicateDancerIds,
            removeDancersByIds,
            applyBulkColorToDancerIds,
            applyBulkMarkerClear,
            applyBulkMarkerSequence,
            applyBulkMarkerSame,
            applyBulkMarkerCenterDistance,
            applyPermuteArrange,
            applyDancerArrange,
          }}
          viewMode={viewMode}
          setPiecesEditable={setPiecesEditable}
          playbackDancers={playbackDancers}
          previewDancers={previewDancers}
          removeFloorMarkupById={removeFloorMarkupById}
          writeFormationSetPieces={writeFormation?.setPieces}
          updateActiveFormation={updateActiveFormation}
          removeSetPieceById={removeSetPieceById}
        />
      ) : null,
  } satisfies StageBoardLayoutSlots;

  const stageBoardOverlaysProps = useMemo(
    (): StageBoardBodyOverlaysProps => ({
      floorTextInlineRect,
      floorTextEditId,
      floorTextDraft,
      setFloorTextDraft,
      floorTextInlineMarkupScale,
      updateActiveFormation,
      onFloorTextInlineRequestClose: () => setFloorMarkupTool(null),
      showTrashDrop,
      trashHot,
      trashDockViewportRef,
      dancerQuickEditId,
      quickEditDancerForDialog,
      viewMode,
      onCloseQuickEdit: () => setDancerQuickEditId(null),
      onApplyQuickEdit: applyDancerQuickEdit,
    }),
    [
      applyDancerQuickEdit,
      dancerQuickEditId,
      floorTextDraft,
      floorTextEditId,
      floorTextInlineMarkupScale,
      floorTextInlineRect,
      quickEditDancerForDialog,
      setDancerQuickEditId,
      setFloorTextDraft,
      setFloorMarkupTool,
      showTrashDrop,
      trashDockViewportRef,
      trashHot,
      updateActiveFormation,
      viewMode,
    ],
  );

  return (
    <StageBoardShell
      main={<StageBoardLayout {...stageBoardLayoutSlots} />}
      overlays={<StageBoardBodyOverlays {...stageBoardOverlaysProps} />}
    />
  );
}

StageBoardBody.displayName = "StageBoard";
