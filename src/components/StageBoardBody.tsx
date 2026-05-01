import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  STAGE_MAIN_FLOOR_MM_MAX,
  STAGE_MAIN_FLOOR_MM_MIN,
} from "../lib/stageDimensions";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
  snapXPctToCenterDistanceMmGrid,
} from "../lib/dancerSpacing";
import {
  resolveArrangeTargetIds,
} from "../lib/stageSelectionArrange";
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
import { StageBoardShell } from "./StageBoardShell";
import { StageBoardMainColumn } from "./StageBoardMainColumn";
import { StageBoardPreviewFormationBanner } from "./StageBoardPreviewFormationBanner";
import { StageBoardScreenOverlay } from "./StageBoardScreenOverlay";
import { StageBoardBodyOverlays } from "./StageBoardBodyOverlays";
import { StageBoardBulkColorToolbar } from "./StageBoardBulkColorToolbar";
import { StageBoardBulkToolbarSlot } from "./StageBoardBulkToolbarSlot";
import { StageBoardStageFrame } from "./StageBoardStageFrame";
import {
  type StageResizeHandleId,
} from "./StageResizeHandles";
import type { StageExportRootColumnProps } from "./StageExportRootColumn";
import { shell } from "../theme/choreoShell";
import {
  modDancerColorIndex,
  normalizeDancerFacingDeg,
} from "../lib/dancerColorPalette";
import { sliceMarkerBadgeForStorage } from "../lib/markerBadge";
import {
  pointerInViewportTrashRevealZone,
  syncRosterAfterRemovingLinkedMembersFromFirstCue,
  trashViewportStripWidthPx,
} from "../lib/stageBoardRosterAndTrash";
import {
  applySetPieceResizePct,
  clamp,
  EMPTY_FLOOR_TEXT_DRAFT,
  floorTextDraftColorHex,
  floorTextLayer,
  floorTextMarkupScale,
  FLOOR_TEXT_DEFAULT_FONT,
  getSetPieceCoordRoot,
  groupScaleForHandle,
  MIN_SET_PIECE_H_PCT,
  MIN_SET_PIECE_W_PCT,
  round2,
  setPieceLayer,
  setPieceRotationDegDisplay,
  type GroupBoxHandle,
  type SetPieceResizeHandle,
} from "../lib/stageBoardModelHelpers";
import { computeStageContextMenuStyle } from "../lib/stageContextMenuGeometry";
import { buildStageBoardExportColumnProps } from "../lib/buildStageBoardExportColumnProps";

/** 床テキスト: これ未満の移動は「タップして編集」、超えたらドラッグ移動 */
const FLOOR_TEXT_TAP_DRAG_THRESHOLD_PX = 6;

type SnapMode = "free" | "grid" | "fine";

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
  const setPieceDragRef = useRef<
    | {
        mode: "move";
        pieceId: string;
        offsetXPx: number;
        offsetYPx: number;
      }
    | {
        mode: "resize";
        pieceId: string;
        handle: SetPieceResizeHandle;
        start: { xPct: number; yPct: number; wPct: number; hPct: number };
        startClientX: number;
        startClientY: number;
        floorWpx: number;
        floorHpx: number;
      }
    | {
        mode: "rotate";
        pieceId: string;
        startRotationDeg: number;
        startPointerRad: number;
        centerClientX: number;
        centerClientY: number;
      }
    | null
  >(null);

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
  const [dancerQuickEditId, setDancerQuickEditId] = useState<string | null>(null);
  /**
   * ステージ上で選択中のダンサー ID（複数可）。
   * - 1 件なら Alt+矢印で微移動できる（従来の microNudgeDancerId の役割）。
   * - 2 件以上ならステージに枠が出て、8 ハンドルで群全体を比率スケールできる。
   * - 1 件以上なら代表ダンサーの右下に小さなハンドルが出て、○の直径を変更できる。
   */
  const [selectedDancerIds, setSelectedDancerIds] = useState<string[]>([]);
  const [selectedSetPieceId, setSelectedSetPieceId] = useState<string | null>(null);
  /** 設置済み床テキストのドラッグ移動 */
  const floorMarkupTextDragRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    layer: "stage" | "screen";
  } | null>(null);
  /**
   * ツール未選択時: テキスト上でポインタダウンした直後はここに保持し、
   * 微小移動ならタップ（編集モードへ）、それ以上ならドラッグ移動に切り替える。
   */
  const floorTextTapOrDragRef = useRef<FloorTextTapOrDragPayload | null>(null);
  /** 床テキスト枠の角ドラッグで scale を変える */
  const floorTextResizeDragRef = useRef<FloorTextResizeDragPayload | null>(null);
  /** 置き場所プレビューをドラッグ中 */
  const floorTextPlaceDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    session: FloorTextPlaceSession;
  } | null>(null);
  /** 床テキストツール：入力内容と次に置くときの書式 */
  const [floorTextDraft, setFloorTextDraft] = useState({ ...EMPTY_FLOOR_TEXT_DRAFT });
  /** 選択中の床テキスト id（スライダー・本文はこの項目を更新、空床クリックで移動） */
  const [floorTextEditId, setFloorTextEditId] = useState<string | null>(null);
  /** 角枠表示のみ（シングルタップ）。ダブルクリックでインライン編集 */
  const [selectedFloorTextId, setSelectedFloorTextId] = useState<string | null>(null);
  /** ダブルクリックでその場編集するテキストの画面上位置 */
  const [floorTextInlineRect, setFloorTextInlineRect] = useState<{
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  /** ドラッグ中のマーキー（範囲選択の四角）。pct 座標で親床内を示す */
  const [marquee, setMarquee] = useState<{
    startXPct: number;
    startYPct: number;
    curXPct: number;
    curYPct: number;
  } | null>(null);
  const marqueeSessionRef = useRef<
    | {
        startClientX: number;
        startClientY: number;
        startXPct: number;
        startYPct: number;
        floorWpx: number;
        floorHpx: number;
        additive: boolean;
        baseIds: string[];
        movedPx: number;
      }
    | null
  >(null);
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
  /**
   * 代表ダンサーの右下ハンドルで、選択中のダンサー群の○サイズ（px）を変更するセッション。
   * 開始時点の各ダンサーのサイズを覚えておき、ポインタ移動量に応じて全員を同じ差分で動かす。
   */
  const markerResizeRef = useRef<
    | {
        startClientX: number;
        startClientY: number;
        startSizes: Map<string, number>;
        ids: string[];
      }
    | null
  >(null);
  /** サイズドラッグ中は選択中ダンサー ID → 仮の直径 px を保持してライブプレビュー */
  const [markerDiamDraft, setMarkerDiamDraft] = useState<Map<
    string,
    number
  > | null>(null);
  /**
   * 回転ハンドルドラッグ中の向きプレビュー（選択中の各 ID → 度）。
   * ポインターアップでプロジェクトに確定するまで `facingDeg` 表示に使う。
   */
  const [markerFacingDraft, setMarkerFacingDraft] = useState<Map<
    string,
    number
  > | null>(null);
  const markerRotateRef = useRef<
    | {
        centerClientX: number;
        centerClientY: number;
        startPointerAngle: number;
        startFacings: Map<string, number>;
        ids: string[];
        /** 2 人以上＋選択枠あり：位置もまとめて回す。1 人は向きのみ。 */
        mode: "facing" | "groupRigid";
        startPositions?: Map<string, { xPct: number; yPct: number }>;
      }
    | null
  >(null);
  /** `markerFacingDraft` と同内容をポインターアップで確実に読むため */
  const markerFacingDraftRef = useRef<Map<string, number> | null>(null);
  /**
   * 複数選択の回転ドラッグ中のみ：各 ID の仮 `xPct` / `yPct`（選択枠中心まわりの剛体回転）。
   */
  const [markerGroupPosDraft, setMarkerGroupPosDraft] = useState<Map<
    string,
    { xPct: number; yPct: number }
  > | null>(null);
  const markerGroupPosDraftRef = useRef<Map<
    string,
    { xPct: number; yPct: number }
  > | null>(null);

  /**
   * ステージ枠の四隅ハンドルでステージ全体の寸法を変更するドラッグセッション。
   *
   * ローテーション（audienceEdge による舞台の回転）があっても正しく動かせるように、
   * 画面中心座標・回転角・CSS 軸サイズ・反対コーナーのアンカー位置（CSS座標）を
   * 開始時点で記録し、ポインタ位置を CSS 軸上に戻してから新寸法を計算する。
   */
  const stageResizeRef = useRef<
    | {
        /**
         * ハンドルの種類。
         * - "nw" / "ne" / "se" / "sw" … 四隅。横・奥の両方を同時に変更。
         * - "n" / "s" … 上下の辺。奥行き（Dmm）のみ変更。
         * - "e" / "w" … 左右の辺。横幅（Wmm）のみ変更。
         */
        handle: "nw" | "ne" | "se" | "sw" | "n" | "s" | "e" | "w";
        /** 画面上のステージ中心（drag 開始時点） */
        cx: number;
        cy: number;
        /** 回転角（度）。audienceEdge から算出した rot をそのまま使う */
        rotDeg: number;
        /** アンカー（対角コーナー）の CSS 座標系での位置（中心基準） */
        anchorCssX: number;
        anchorCssY: number;
        /** 開始時点の要素 CSS 幅・高さ（px、回転前の axis） */
        W0css: number;
        H0css: number;
        /** 開始時点の外枠寸法（mm）と側方/奥方の mm */
        outerWmm0: number;
        outerDmm0: number;
        Smm: number;
        Bmm: number;
      }
    | null
  >(null);
  /** コーナーリサイズの最新 mm（rAF で state に反映するため）。ポインタアップで確定にも使う。 */
  const stageResizeLastMmRef = useRef<{ w: number; d: number } | null>(null);
  /** setStageResizeDraft を 1 フレームにまとめ、ドラッグ中の過剰再レンダーを防ぐ */
  const stageResizeDraftRafRef = useRef<number | null>(null);
  /** ステージ枠ドラッグ中のライブプレビュー値（コミット前の W/D）。 */
  const [stageResizeDraft, setStageResizeDraft] = useState<
    | { stageWidthMm: number; stageDepthMm: number }
    | null
  >(null);
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
  /** 現在カーソルが乗っているステージリサイズハンドル。ホバー時だけ少し大きくする。 */
  const [hoveredStageHandle, setHoveredStageHandle] =
    useState<StageResizeHandleId | null>(null);

  /** ダンサー 1 人分の実効サイズ（px）。draft > 個別 sizePx > プロジェクト共通、の順で解決。 */
  const effectiveMarkerPx = useCallback(
    (d: DancerSpot) => {
      const draft = markerDiamDraft?.get(d.id);
      if (typeof draft === "number" && Number.isFinite(draft)) {
        return Math.max(MARKER_PX_MIN, Math.min(MARKER_PX_MAX, Math.round(draft)));
      }
      if (typeof d.sizePx === "number" && Number.isFinite(d.sizePx)) {
        return Math.max(MARKER_PX_MIN, Math.min(MARKER_PX_MAX, Math.round(d.sizePx)));
      }
      return baseMarkerPx;
    },
    [markerDiamDraft, baseMarkerPx]
  );

  /** 回転ドラッグ中はドラフト、それ以外は `facingDeg`（未設定は 0）。 */
  const effectiveFacingDeg = useCallback(
    (d: DancerSpot): number => {
      const fd = markerFacingDraft?.get(d.id);
      if (typeof fd === "number" && Number.isFinite(fd)) return fd;
      const raw =
        typeof d.facingDeg === "number" && Number.isFinite(d.facingDeg)
          ? d.facingDeg
          : 0;
      return raw;
    },
    [markerFacingDraft]
  );

  /** ゴミ箱ドロップゾーン上でダンサーをドラッグ中 */
  const [trashHot, setTrashHot] = useState(false);
  /** ポインタが画面左端付近まで来たときだけゴミ箱 UI を出す */
  const [trashUiVisible, setTrashUiVisible] = useState(false);
  const trashRevealActiveRef = useRef(false);
  /**
   * ドラッグ開始時点の座標を薄く重ね表示（ポインタアップで消える）。
   */
  const [dragGhostById, setDragGhostById] = useState<
    Map<string, { xPct: number; yPct: number }> | null
  >(null);
  /** ステージ上の右クリックメニュー（ダンサー / 床テキスト / 大道具） */
  const [stageContextMenu, setStageContextMenu] = useState<StageBoardContextMenuState>(null);
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
  /** 群剛体回転ドラッグ中の累積回転角（度）— 角度バッジ表示用 */
  const [groupRotateGuideDeltaDeg, setGroupRotateGuideDeltaDeg] = useState<
    number | null
  >(null);
  const formationIdForWrites =
    editFormationId != null && formations.some((f) => f.id === editFormationId)
      ? editFormationId
      : activeFormationId;

  useEffect(() => {
    onGestureHistoryCancel?.();
    setDancerQuickEditId(null);
    setSelectedDancerIds([]);
    setStageContextMenu(null);
    setSelectedSetPieceId(null);
    setMarquee(null);
    marqueeSessionRef.current = null;
    groupDragRef.current = null;
    markerResizeRef.current = null;
    markerRotateRef.current = null;
    markerFacingDraftRef.current = null;
    markerGroupPosDraftRef.current = null;
    floorMarkupTextDragRef.current = null;
    floorTextTapOrDragRef.current = null;
    floorTextPlaceDragRef.current = null;
    floorTextResizeDragRef.current = null;
    setMarkerDiamDraft(null);
    setMarkerFacingDraft(null);
    setMarkerGroupPosDraft(null);
    setDragGhostById(null);
    setFloorMarkupTool(null);
    floorLineSessionRef.current = null;
    setFloorLineDraft(null);
    setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
    setFloorTextEditId(null);
    setSelectedFloorTextId(null);
    setFloorTextInlineRect(null);
    setShowStageDancerColorToolbar(false);
    setBulkHideDancerGlyphs(false);
    setGroupRotateGuideDeltaDeg(null);
  }, [formationIdForWrites, onGestureHistoryCancel]);

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
    [formations, activeFormationId]
  );

  const writeFormation = useMemo(
    () => formations.find((f) => f.id === formationIdForWrites),
    [formations, formationIdForWrites]
  );

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
    [writeFormation?.dancers, activeFormation?.dancers]
  );
  const stageDancerById = useMemo(
    () => new Map(stageDancersForLookup.map((d) => [d.id, d] as const)),
    [stageDancersForLookup]
  );
  const stageDancerIndexById = useMemo(
    () => new Map(stageDancersForLookup.map((d, i) => [d.id, i] as const)),
    [stageDancersForLookup]
  );

  const displaySetPieces: SetPiece[] =
    previewDancers != null && previewDancers.length > 0
      ? writeFormation?.setPieces ?? []
      : playbackSetPieces ??
        browseSetPieces ??
        writeFormation?.setPieces ??
        [];

  const displayFloorMarkup: StageFloorMarkup[] =
    previewDancers != null && previewDancers.length > 0
      ? writeFormation?.floorMarkup ?? []
      : playbackFloorMarkup ??
        browseFloorMarkup ??
        writeFormation?.floorMarkup ??
        [];

  const screenFloorTexts = useMemo((): StageFloorTextMarkup[] => {
    const out: StageFloorTextMarkup[] = [];
    for (const m of displayFloorMarkup) {
      if (m.kind === "text" && floorTextLayer(m) === "screen") out.push(m);
    }
    return out;
  }, [displayFloorMarkup]);

  const stageSetPieces = useMemo(
    () => displaySetPieces.filter((p) => setPieceLayer(p) === "stage"),
    [displaySetPieces]
  );
  const screenSetPieces = useMemo(
    () => displaySetPieces.filter((p) => setPieceLayer(p) === "screen"),
    [displaySetPieces]
  );

  /** 床テキストのその場編集 textarea は親の scale と見た目を揃える */
  const floorTextInlineMarkupScale = useMemo(() => {
    const id = floorTextInlineRect?.id;
    if (!id) return 1;
    const mk = displayFloorMarkup.find(
      (x): x is StageFloorTextMarkup => x.kind === "text" && x.id === id
    );
    return mk ? floorTextMarkupScale(mk) : 1;
  }, [displayFloorMarkup, floorTextInlineRect?.id]);

  const playbackOrPreview = Boolean(playbackDancers || previewDancers);
  /**
   * 客席帯・床下の場ミリ数字・翼の印は、閲覧・再生・客席を上にした回転でも欠けないよう、
   * ステージ周りの親は overflow visible（旧: 再生中に hidden にして帯が切れる不具合があった）。
   */

  const setPiecesEditable =
    viewMode !== "view" &&
    stageInteractionsEnabled &&
    !playbackOrPreview;

  const updateActiveFormation = useCallback(
    (updater: (f: NonNullable<typeof writeFormation>) => NonNullable<typeof writeFormation>) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false
      )
        return;
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) =>
          f.id === formationIdForWrites ? updater(f) : f
        ),
      }));
    },
    [writeFormation, formationIdForWrites, setProject, viewMode, stageInteractionsEnabled]
  );

  useEffect(() => {
    if (floorMarkupTool !== "text") {
      setFloorTextEditId(null);
      setFloorTextInlineRect(null);
    }
  }, [floorMarkupTool]);

  /** ヘッダからの床テキスト配置中はステージ内の旧テキストツールと競合しないよう解除 */
  useEffect(() => {
    if (!floorTextPlaceSession) return;
    setFloorMarkupTool(null);
    setFloorTextEditId(null);
    floorTextTapOrDragRef.current = null;
  }, [floorTextPlaceSession]);

  /** 画面全体配置: 編集グリッド上の空所クリックでプレビュー位置を更新（入力欄・ボタンは除外） */
  useEffect(() => {
    const root = viewportTextOverlayRoot;
    const sess = floorTextPlaceSession;
    const onChange = onFloorTextPlaceSessionChange;
    if (!sess || !onChange || !root || !setPiecesEditable || !writeFormation) return;
    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!root.contains(t)) return;
      if (
        t.closest(
          "button, input, textarea, select, option, a[href], [role='dialog'], [role='menu'], [data-floor-text-place-preview], [data-floor-text-box], [data-floor-markup]"
        )
      )
        return;
      if (t.closest("[data-dancer-id], [data-set-piece-id]")) return;
      const r = root.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      e.preventDefault();
      const xPct = round2(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100));
      const yPct = round2(clamp(((e.clientY - r.top) / r.height) * 100, 0, 100));
      onChange({ ...sess, xPct, yPct });
    };
    window.addEventListener("pointerdown", onPointerDownCapture, true);
    return () =>
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [
    floorTextPlaceSession,
    onFloorTextPlaceSessionChange,
    viewportTextOverlayRoot,
    setPiecesEditable,
    writeFormation,
  ]);

  /** 床テキストが削除されたあと、編集中 id が残らないようにする */
  useEffect(() => {
    if (!floorTextEditId || !writeFormation) return;
    const fm = writeFormation.floorMarkup ?? [];
    if (!fm.some((x) => x.id === floorTextEditId && x.kind === "text")) {
      setFloorTextEditId(null);
      setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
    }
  }, [writeFormation, floorTextEditId]);

  useEffect(() => {
    if (!selectedFloorTextId || !writeFormation) return;
    const fm = writeFormation.floorMarkup ?? [];
    if (!fm.some((x) => x.id === selectedFloorTextId && x.kind === "text")) {
      setSelectedFloorTextId(null);
      setFloorTextInlineRect(null);
    }
  }, [writeFormation, selectedFloorTextId]);

  const removeFloorMarkupById = useCallback(
    (id: string) => {
      if (!writeFormation || !setPiecesEditable) return;
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: (f.floorMarkup ?? []).filter((x) => x.id !== id),
      }));
    },
    [writeFormation, setPiecesEditable, updateActiveFormation]
  );

  const handleFloorTextMarkupContextMenu = useCallback(
    (markupId: string, clientX: number, clientY: number) => {
      setStageContextMenu({
        kind: "floorText",
        clientX,
        clientY,
        markupId,
      });
    },
    []
  );

  const handleFloorTextSelectMarkupTool = useCallback(
    (markupId: string, draft: FloorTextDraftPayload) => {
      setFloorTextEditId(markupId);
      setSelectedFloorTextId(markupId);
      setFloorTextDraft(draft);
    },
    []
  );

  const handleFloorTextDoubleClickInline = useCallback(
    (m: StageFloorTextMarkup, bounds: DOMRect, draft: FloorTextDraftPayload) => {
      setFloorTextInlineRect({
        id: m.id,
        left: bounds.left,
        top: bounds.top,
        width: Math.max(140, bounds.width),
        height: Math.max(40, bounds.height),
      });
      setFloorMarkupTool("text");
      setFloorTextEditId(m.id);
      setSelectedFloorTextId(m.id);
      setFloorTextDraft(draft);
    },
    [setFloorMarkupTool]
  );

  const handleFloorTextColorUpdate = useCallback(
    (id: string, color: string) => {
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: (f.floorMarkup ?? []).map((x) =>
          x.id === id && x.kind === "text" ? { ...x, color } : x
        ),
      }));
    },
    [updateActiveFormation]
  );

  const handleFloorTextFontFamilyUpdate = useCallback(
    (id: string, fontFamily: string) => {
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: (f.floorMarkup ?? []).map((x) =>
          x.id === id && x.kind === "text" ? { ...x, fontFamily } : x
        ),
      }));
    },
    [updateActiveFormation]
  );

  const floorTextMarkupSharedProps = useMemo(
    () => ({
      viewMode,
      setPiecesEditable,
      playbackOrPreview,
      previewDancers: Boolean(previewDancers),
      floorTextPlaceSession,
      floorMarkupTool,
      selectedFloorTextId,
      floorTextEditId,
      floorTextInlineRectId: floorTextInlineRect?.id,
      floorTextResizeDragRef,
      floorTextTapOrDragRef,
      onContextMenuFloorText: handleFloorTextMarkupContextMenu,
      onRemoveFloorMarkup: removeFloorMarkupById,
      onSelectTextMarkupTool: handleFloorTextSelectMarkupTool,
      onDoubleClickInlineEdit: handleFloorTextDoubleClickInline,
      onUpdateTextColor: handleFloorTextColorUpdate,
      onUpdateTextFontFamily: handleFloorTextFontFamilyUpdate,
    }),
    [
      viewMode,
      setPiecesEditable,
      playbackOrPreview,
      previewDancers,
      floorTextPlaceSession,
      floorMarkupTool,
      selectedFloorTextId,
      floorTextEditId,
      floorTextInlineRect?.id,
      handleFloorTextMarkupContextMenu,
      removeFloorMarkupById,
      handleFloorTextSelectMarkupTool,
      handleFloorTextDoubleClickInline,
      handleFloorTextColorUpdate,
      handleFloorTextFontFamilyUpdate,
    ]
  );

  const handleFloorTextPlacePreviewPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (!floorTextPlaceSession) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      floorTextPlaceDragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startXPct: floorTextPlaceSession.xPct,
        startYPct: floorTextPlaceSession.yPct,
        session: { ...floorTextPlaceSession },
      };
    },
    [floorTextPlaceSession]
  );

  const beginFloorLineDraw = useCallback(
    (clientX: number, clientY: number, r: DOMRect) => {
      if (!writeFormation || !setPiecesEditable) return;
      const xPct = round2(clamp(((clientX - r.left) / r.width) * 100, 0, 100));
      const yPct = round2(clamp(((clientY - r.top) / r.height) * 100, 0, 100));
      const session = {
        points: [[xPct, yPct]] as [number, number][],
        lastClientX: clientX,
        lastClientY: clientY,
      };
      floorLineSessionRef.current = session;
      setFloorLineDraft([[xPct, yPct]]);
      const move = (ev: PointerEvent) => {
        const s = floorLineSessionRef.current;
        if (!s) return;
        const dx = ev.clientX - s.lastClientX;
        const dy = ev.clientY - s.lastClientY;
        if (Math.hypot(dx, dy) < 4) return;
        if (s.points.length >= 200) return;
        const nx = round2(
          clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100)
        );
        const ny = round2(
          clamp(((ev.clientY - r.top) / r.height) * 100, 0, 100)
        );
        s.points.push([nx, ny]);
        s.lastClientX = ev.clientX;
        s.lastClientY = ev.clientY;
        setFloorLineDraft([...s.points]);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        const s = floorLineSessionRef.current;
        floorLineSessionRef.current = null;
        setFloorLineDraft(null);
        if (!s || s.points.length < 2) return;
        let len = 0;
        for (let i = 1; i < s.points.length; i++) {
          const a = s.points[i - 1]!;
          const b = s.points[i]!;
          len += Math.hypot(b[0] - a[0], b[1] - a[1]);
        }
        if (len < 0.35) return;
        const newLine: StageFloorMarkup = {
          kind: "line",
          id: crypto.randomUUID(),
          pointsPct: s.points,
          widthPx: 3,
          color: "#fbbf24",
        };
        updateActiveFormation((f) => ({
          ...f,
          floorMarkup: [...(f.floorMarkup ?? []), newLine],
        }));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [writeFormation, setPiecesEditable, updateActiveFormation]
  );

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
              : f
          ),
        };
        if (spot) {
          next = syncRosterAfterRemovingLinkedMembersFromFirstCue(
            next,
            formationIdForWrites,
            [spot]
          );
        }
        return next;
      });
      setSelectedDancerIds((ids) => ids.filter((id) => id !== dancerId));
      setDancerQuickEditId((id) => (id === dancerId ? null : id));
      setStageContextMenu(null);
    },
    [
      writeFormation,
      formationIdForWrites,
      setProject,
      viewMode,
      stageInteractionsEnabled,
    ]
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
        const nid = crypto.randomUUID();
        const base = (d.label || "?").trim() || "?";
        const label = base.length <= 12 ? `${base}′` : `${base.slice(0, 11)}′`;
        return {
          ...d,
          id: nid,
          label,
          xPct: round2(
            clamp(d.xPct + 2.5, DANCER_STAGE_POSITION_PCT_LO, DANCER_STAGE_POSITION_PCT_HI)
          ),
          yPct: round2(
            clamp(d.yPct + 2.5, DANCER_STAGE_POSITION_PCT_LO, DANCER_STAGE_POSITION_PCT_HI)
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
            : f
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
    ]
  );

  /**
   * ステージ枠の四隅ハンドルをつかんだら寸法ドラッグを開始する。
   *
   * - `stageWidthMm/stageDepthMm` が未設定のプロジェクトでも、
   *   開始時に既定値（12m × 8m）を仮定してドラッグできる。
   * - 舞台の客席方向 (audienceEdge) による回転を考慮し、
   *   ポインタ位置を CSS 軸へ逆回転してから新寸法を計算する。
   */
  const onStageCornerResizeDown = useCallback(
    (
      handle: "nw" | "ne" | "se" | "sw" | "n" | "s" | "e" | "w",
      e: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (
        viewMode === "view" ||
        !stageInteractionsEnabled ||
        Boolean(playbackDancers) ||
        Boolean(previewDancers)
      )
        return;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const el = document.getElementById("stage-export-root");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rotDeg = (audienceRotationDeg(audienceEdge) + 180) % 360;
      const is90 = rotDeg === 90 || rotDeg === 270;
      const W0css = is90 ? rect.height : rect.width;
      const H0css = is90 ? rect.width : rect.height;
      /**
       * アンカー（動かない側）の CSS 座標系での位置。
       * 辺ハンドル（n/s/e/w）の場合、動かない軸は 0（中央）扱いにして
       * onMove 側で「その軸は元のまま」ロジックと併用する。
       */
      const anchorCssX =
        handle === "ne" || handle === "se" || handle === "e"
          ? -W0css / 2
          : handle === "nw" || handle === "sw" || handle === "w"
          ? W0css / 2
          : 0;
      const anchorCssY =
        handle === "sw" || handle === "se" || handle === "s"
          ? -H0css / 2
          : handle === "nw" || handle === "ne" || handle === "n"
          ? H0css / 2
          : 0;
      const curW =
        stageWidthMm != null && stageWidthMm > 0 ? stageWidthMm : 12000;
      const curD =
        stageDepthMm != null && stageDepthMm > 0 ? stageDepthMm : 8000;
      const SmmStart = sideStageMm != null && sideStageMm > 0 ? sideStageMm : 0;
      const BmmStart = backStageMm != null && backStageMm > 0 ? backStageMm : 0;
      stageResizeRef.current = {
        handle,
        cx,
        cy,
        rotDeg,
        anchorCssX,
        anchorCssY,
        W0css,
        H0css,
        outerWmm0: curW + 2 * SmmStart,
        outerDmm0: curD + BmmStart,
        Smm: SmmStart,
        Bmm: BmmStart,
      };
      stageResizeLastMmRef.current = { w: curW, d: curD };
      setStageResizeDraft({ stageWidthMm: curW, stageDepthMm: curD });
      const target = e.currentTarget as HTMLDivElement;
      try {
        target.setPointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
    },
    [
      viewMode,
      stageInteractionsEnabled,
      playbackDancers,
      previewDancers,
      audienceEdge,
      stageWidthMm,
      stageDepthMm,
      sideStageMm,
      backStageMm,
    ]
  );

  /** ドラッグ中: ポインタ位置を CSS 軸へ戻し、対角アンカーからの距離で新寸法を算出。 */
  useEffect(() => {
    /**
     * ピクセル比 → mm 比。Shift 押下で「広い範囲まで」伸ばしやすくする（拡大を加速）。
     * 縮小時は逆にやや鈍くして誤操作しにくくする。
     */
    const resizeRatioGain = (raw: number, shift: boolean): number => {
      if (!Number.isFinite(raw) || raw <= 0) return raw;
      if (!shift) return raw;
      if (raw >= 1) return 1 + (raw - 1) * 2.35;
      return 1 - (1 - raw) * 0.55;
    };

    const onMove = (e: PointerEvent) => {
      const s = stageResizeRef.current;
      if (!s) return;
      const dx = e.clientX - s.cx;
      const dy = e.clientY - s.cy;
      const rad = (s.rotDeg * Math.PI) / 180;
      /** 画面座標 → CSS 軸（rotate 前）へ逆回転。 */
      const lx = dx * Math.cos(rad) + dy * Math.sin(rad);
      const ly = -dx * Math.sin(rad) + dy * Math.cos(rad);
      /**
       * 辺ハンドル（n/s/e/w）の場合は担当軸だけを更新して、
       * もう片方の寸法は元のまま維持する。コーナーの場合は両軸変更。
       */
      const affectsW =
        s.handle === "e" ||
        s.handle === "w" ||
        s.handle === "nw" ||
        s.handle === "ne" ||
        s.handle === "se" ||
        s.handle === "sw";
      const affectsH =
        s.handle === "n" ||
        s.handle === "s" ||
        s.handle === "nw" ||
        s.handle === "ne" ||
        s.handle === "se" ||
        s.handle === "sw";
      const newCssW = affectsW
        ? Math.max(40, Math.abs(lx - s.anchorCssX))
        : s.W0css;
      const newCssH = affectsH
        ? Math.max(40, Math.abs(ly - s.anchorCssY))
        : s.H0css;
      const ratioW = affectsW
        ? resizeRatioGain(newCssW / Math.max(1, s.W0css), e.shiftKey)
        : 1;
      const ratioH = affectsH
        ? resizeRatioGain(newCssH / Math.max(1, s.H0css), e.shiftKey)
        : 1;
      const newOuterWmm = s.outerWmm0 * ratioW;
      const newOuterDmm = s.outerDmm0 * ratioH;
      let newW = Math.round(newOuterWmm - 2 * s.Smm);
      let newD = Math.round(newOuterDmm - s.Bmm);
      newW = Math.min(STAGE_MAIN_FLOOR_MM_MAX, Math.max(STAGE_MAIN_FLOOR_MM_MIN, newW));
      newD = Math.min(STAGE_MAIN_FLOOR_MM_MAX, Math.max(STAGE_MAIN_FLOOR_MM_MIN, newD));
      stageResizeLastMmRef.current = { w: newW, d: newD };
      if (stageResizeDraftRafRef.current !== null) return;
      stageResizeDraftRafRef.current = requestAnimationFrame(() => {
        stageResizeDraftRafRef.current = null;
        const p = stageResizeLastMmRef.current;
        if (!p) return;
        setStageResizeDraft((prev) =>
          prev &&
          prev.stageWidthMm === p.w &&
          prev.stageDepthMm === p.d
            ? prev
            : { stageWidthMm: p.w, stageDepthMm: p.d }
        );
      });
    };
    const onUp = () => {
      if (stageResizeDraftRafRef.current !== null) {
        cancelAnimationFrame(stageResizeDraftRafRef.current);
        stageResizeDraftRafRef.current = null;
      }
      const s = stageResizeRef.current;
      const last = stageResizeLastMmRef.current;
      stageResizeLastMmRef.current = null;
      stageResizeRef.current = null;
      setStageResizeDraft(null);
      if (!s || !last) return;
      setProject((p) => {
        if (p.stageWidthMm === last.w && p.stageDepthMm === last.d) return p;
        return { ...p, stageWidthMm: last.w, stageDepthMm: last.d };
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setProject]);

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
        removeSet.has(x.id)
      );
      setProject((p) => {
        let next: ChoreographyProjectJson = {
          ...p,
          formations: p.formations.map((f) =>
            f.id === formationIdForWrites
              ? { ...f, dancers: f.dancers.filter((x) => !removeSet.has(x.id)) }
              : f
          ),
        };
        next = syncRosterAfterRemovingLinkedMembersFromFirstCue(
          next,
          formationIdForWrites,
          removedSpots
        );
        return next;
      });
      setSelectedDancerIds((ids) => ids.filter((id) => !removeSet.has(id)));
      setDancerQuickEditId((id) => (id != null && removeSet.has(id) ? null : id));
      setStageContextMenu(null);
    },
    [
      writeFormation,
      formationIdForWrites,
      setProject,
      viewMode,
      stageInteractionsEnabled,
    ]
  );

  const removeSetPieceById = useCallback(
    (pieceId: string) => {
      if (!writeFormation || viewMode === "view" || stageInteractionsEnabled === false)
        return;
      updateActiveFormation((f) => ({
        ...f,
        setPieces: (f.setPieces ?? []).filter((x) => x.id !== pieceId),
      }));
      setSelectedSetPieceId((id) => (id === pieceId ? null : id));
      setStageContextMenu(null);
    },
    [writeFormation, updateActiveFormation, viewMode, stageInteractionsEnabled]
  );

  const handlePointerDownSetPiece = useCallback(
    (e: ReactPointerEvent, piece: SetPiece) => {
      if (e.button !== 0) return;
      if (!setPiecesEditable) return;
      setSelectedSetPieceId(piece.id);
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const el = getSetPieceCoordRoot(
        piece,
        stageMainFloorRef.current,
        viewportTextOverlayRoot
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      const leftPx = r.left + (piece.xPct / 100) * r.width;
      const topPx = r.top + (piece.yPct / 100) * r.height;
      setPieceDragRef.current = {
        mode: "move",
        pieceId: piece.id,
        offsetXPx: e.clientX - leftPx,
        offsetYPx: e.clientY - topPx,
      };
    },
    [setPiecesEditable, stageMainFloorRef, viewportTextOverlayRoot]
  );

  const handlePointerDownSetPieceResize = useCallback(
    (e: ReactPointerEvent, piece: SetPiece, handle: SetPieceResizeHandle) => {
      if (e.button !== 0) return;
      if (!setPiecesEditable) return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedSetPieceId(piece.id);
      const el = getSetPieceCoordRoot(
        piece,
        stageMainFloorRef.current,
        viewportTextOverlayRoot
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPieceDragRef.current = {
        mode: "resize",
        pieceId: piece.id,
        handle,
        start: {
          xPct: piece.xPct,
          yPct: piece.yPct,
          wPct: piece.wPct,
          hPct: piece.hPct,
        },
        startClientX: e.clientX,
        startClientY: e.clientY,
        floorWpx: r.width,
        floorHpx: r.height,
      };
    },
    [setPiecesEditable, stageMainFloorRef, viewportTextOverlayRoot]
  );

  const handlePointerDownSetPieceRotate = useCallback(
    (e: ReactPointerEvent, piece: SetPiece) => {
      if (e.button !== 0) return;
      if (!setPiecesEditable) return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedSetPieceId(piece.id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const el = getSetPieceCoordRoot(
        piece,
        stageMainFloorRef.current,
        viewportTextOverlayRoot
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + ((piece.xPct + piece.wPct / 2) / 100) * r.width;
      const cy = r.top + ((piece.yPct + piece.hPct / 2) / 100) * r.height;
      const startPointerRad = Math.atan2(e.clientY - cy, e.clientX - cx);
      setPieceDragRef.current = {
        mode: "rotate",
        pieceId: piece.id,
        startRotationDeg: setPieceRotationDegDisplay(piece),
        startPointerRad,
        centerClientX: cx,
        centerClientY: cy,
      };
    },
    [setPiecesEditable, stageMainFloorRef, viewportTextOverlayRoot]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (t instanceof HTMLElement && t.isContentEditable) return;
      if (!selectedSetPieceId || !setPiecesEditable) return;
      e.preventDefault();
      removeSetPieceById(selectedSetPieceId);
      setSelectedSetPieceId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSetPieceId, setPiecesEditable, removeSetPieceById]);

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
    return (
      clientX >= 0 &&
      clientX <= strip &&
      clientY >= 0 &&
      clientY <= h
    );
  }, []);

  const quantizeCoord = useCallback(
    (v: number, axis: "x" | "y", mode: SnapMode) => {
      const c = clamp(v, DANCER_STAGE_POSITION_PCT_LO, DANCER_STAGE_POSITION_PCT_HI);
      if (mode === "free" || !snapGrid) return round2(c);
      if (mmSnapGrid) {
        const base =
          axis === "x" ? mmSnapGrid.stepXPct : mmSnapGrid.stepYPct;
        const useStep =
          mode === "fine" ? Math.max(0.05, base / 4) : base;
        return round2(
          clamp(
            Math.round(c / useStep) * useStep,
            DANCER_STAGE_POSITION_PCT_LO,
            DANCER_STAGE_POSITION_PCT_HI
          )
        );
      }
      const step =
        mode === "fine" ? Math.max(0.25, gridStep / 4) : gridStep;
      return round2(
        clamp(
          Math.round(c / step) * step,
          DANCER_STAGE_POSITION_PCT_LO,
          DANCER_STAGE_POSITION_PCT_HI
        )
      );
    },
    [snapGrid, gridStep, mmSnapGrid]
  );

  const pointerToPctInRoot = useCallback(
    (
      rootEl: HTMLElement,
      clientX: number,
      clientY: number,
      shiftKey: boolean,
      /** ダンサー印のドラッグ時のみ true。大道具の移動では false のまま。 */
      snapHorizontalCenter50mm = false
    ) => {
      const r = rootEl.getBoundingClientRect();
      if (r.width < 1e-6 || r.height < 1e-6) return null;
      const xPct = ((clientX - r.left) / r.width) * 100;
      const yPct = ((clientY - r.top) / r.height) * 100;
      const mode: SnapMode = snapGrid ? (shiftKey ? "fine" : "grid") : "free";
      let snappedX = quantizeCoord(xPct, "x", mode);
      const snappedY = quantizeCoord(yPct, "y", mode);
      /**
       * ダンサー移動時: センターからの水平距離が 5cm（50mm）刻みになるよう x を丸める。
       * Shift 押下時は抑止。大道具の移動では使わない。
       */
      const widthMm = (stageResizeDraft?.stageWidthMm ?? stageWidthMm) ?? null;
      if (
        snapHorizontalCenter50mm &&
        !shiftKey &&
        typeof widthMm === "number" &&
        widthMm > 0
      ) {
        snappedX = round2(snapXPctToCenterDistanceMmGrid(snappedX, widthMm, 50));
      }
      return { xPct: snappedX, yPct: snappedY };
    },
    [
      snapGrid,
      quantizeCoord,
      stageWidthMm,
      mmSnapGrid,
      stageResizeDraft?.stageWidthMm,
    ]
  );

  const pxToPct = useCallback(
    (
      clientX: number,
      clientY: number,
      shiftKey: boolean,
      snapHorizontalCenter50mm = false
    ) => {
      const el = stageMainFloorRef.current;
      if (!el) return null;
      return pointerToPctInRoot(
        el,
        clientX,
        clientY,
        shiftKey,
        snapHorizontalCenter50mm
      );
    },
    [pointerToPctInRoot]
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
      strong: boolean
    ): { xPct: number; yPct: number; guideX: number | null; guideY: number | null } => {
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
    []
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = setPieceDragRef.current;
      if (!d) return;
      if (d.mode === "move") {
        const piece = writeFormation?.setPieces?.find((x) => x.id === d.pieceId);
        const root = piece
          ? getSetPieceCoordRoot(
              piece,
              stageMainFloorRef.current,
              viewportTextOverlayRoot
            )
          : stageMainFloorRef.current;
        if (!root) return;
        const next = pointerToPctInRoot(
          root,
          e.clientX - d.offsetXPx,
          e.clientY - d.offsetYPx,
          e.shiftKey
        );
        if (!next) return;
        updateActiveFormation((f) => {
          const pieces = [...(f.setPieces ?? [])];
          const idx = pieces.findIndex((x) => x.id === d.pieceId);
          if (idx < 0) return f;
          const p = pieces[idx];
          const nx = clamp(next.xPct, 0, 100 - p.wPct);
          const ny = clamp(next.yPct, 0, 100 - p.hPct);
          pieces[idx] = { ...p, xPct: round2(nx), yPct: round2(ny) };
          return { ...f, setPieces: pieces };
        });
        return;
      }
      if (d.mode === "rotate") {
        const ang = Math.atan2(
          e.clientY - d.centerClientY,
          e.clientX - d.centerClientX
        );
        let deltaDeg = ((ang - d.startPointerRad) * 180) / Math.PI;
        let rawRot = d.startRotationDeg + deltaDeg;
        if (e.shiftKey) {
          const step = 15;
          rawRot = Math.round(rawRot / step) * step;
        }
        updateActiveFormation((f) => {
          const pieces = [...(f.setPieces ?? [])];
          const idx = pieces.findIndex((x) => x.id === d.pieceId);
          if (idx < 0) return f;
          const p = pieces[idx];
          pieces[idx] = { ...p, rotationDeg: round2(rawRot) };
          return { ...f, setPieces: pieces };
        });
        return;
      }
      const dxPct = ((e.clientX - d.startClientX) / d.floorWpx) * 100;
      const dyPct = ((e.clientY - d.startClientY) / d.floorHpx) * 100;
      const snapDim = (axis: "x" | "y", v: number) => {
        let c = clamp(v, 0, 100);
        if (!snapGrid) return round2(c);
        if (mmSnapGrid) {
          const base = axis === "x" ? mmSnapGrid.stepXPct : mmSnapGrid.stepYPct;
          const step = e.shiftKey ? Math.max(0.05, base / 4) : base;
          c = clamp(Math.round(c / step) * step, 0, 100);
          return round2(c);
        }
        const step = e.shiftKey ? Math.max(0.25, gridStep / 4) : gridStep;
        c = clamp(Math.round(c / step) * step, 0, 100);
        return round2(c);
      };
      const raw = applySetPieceResizePct(
        d.handle,
        d.start.xPct,
        d.start.yPct,
        d.start.wPct,
        d.start.hPct,
        dxPct,
        dyPct
      );
      let xPct = snapDim("x", raw.xPct);
      let yPct = snapDim("y", raw.yPct);
      let wPct = snapDim("x", raw.wPct);
      let hPct = snapDim("y", raw.hPct);
      wPct = Math.max(MIN_SET_PIECE_W_PCT, Math.min(wPct, 100 - xPct));
      hPct = Math.max(MIN_SET_PIECE_H_PCT, Math.min(hPct, 100 - yPct));
      xPct = clamp(xPct, 0, 100 - wPct);
      yPct = clamp(yPct, 0, 100 - hPct);
      updateActiveFormation((f) => {
        const pieces = [...(f.setPieces ?? [])];
        const idx = pieces.findIndex((x) => x.id === d.pieceId);
        if (idx < 0) return f;
        const p = pieces[idx];
        pieces[idx] = {
          ...p,
          xPct,
          yPct,
          wPct,
          hPct,
        };
        return { ...f, setPieces: pieces };
      });
    };
    const onUp = () => {
      setPieceDragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [
    pointerToPctInRoot,
    snapGrid,
    gridStep,
    updateActiveFormation,
    mmSnapGrid,
    writeFormation?.setPieces,
    viewportTextOverlayRoot,
  ]);

  const handlePointerDownDancer = (
    e: ReactPointerEvent,
    dancerId: string,
    xPct: number,
    yPct: number
  ) => {
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
            floor.contains(n)
        )
        .map((n) => n.dataset.dancerId!);
      const uniq = [...new Set(stack)];
      if (uniq.length > 1) {
        const i0 = uniq.indexOf(dancerId);
        const next = uniq[(i0 + 1) % uniq.length];
        setSelectedDancerIds([next]);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    e.stopPropagation();

    /** Shift / Cmd / Ctrl クリックは「追加選択のトグル」だけで、ドラッグは始めない */
    const toggleOnly = e.shiftKey || e.metaKey || e.ctrlKey;
    let nextSelection: string[];
    if (toggleOnly) {
      nextSelection = selectedDancerIds.includes(dancerId)
        ? selectedDancerIds.filter((id) => id !== dancerId)
        : [...selectedDancerIds, dancerId];
      setSelectedDancerIds(nextSelection);
      return;
    }
    if (selectedDancerIds.includes(dancerId)) {
      /** すでに選択中 → 現在の選択を保ったまま、その全員をドラッグで一括移動 */
      nextSelection = selectedDancerIds;
    } else {
      /** 未選択のダンサーを押した場合はその 1 人だけ選択しなおす */
      nextSelection = [dancerId];
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
    const dancers =
      writeFormation?.dancers ?? activeFormation?.dancers ?? [];
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
  };

  /** 複数選択の bounding box リサイズ開始 */
  const handlePointerDownGroupBoxHandle = (
    e: ReactPointerEvent,
    handle: GroupBoxHandle,
    startBox: { x0: number; y0: number; x1: number; y1: number }
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
    const dancers =
      writeFormation?.dancers ?? activeFormation?.dancers ?? [];
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
  };

  /**
   * 代表ダンサーの右下ハンドル → 選択中のダンサー全員の○サイズ（px）を変える。
   * 選択が 1 件ならそのダンサーだけ、複数件なら全員が同じ差分ずつ変化する。
   */
  const handlePointerDownMarkerResize = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (
      viewMode === "view" ||
      playbackDancers ||
      previewDancers ||
      !stageInteractionsEnabled
    )
      return;
    if (selectedDancerIds.length < 1) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const dancers =
      writeFormation?.dancers ?? activeFormation?.dancers ?? [];
    const startSizes = new Map<string, number>();
    for (const id of selectedDancerIds) {
      const d = dancers.find((x) => x.id === id);
      if (!d) continue;
      const cur =
        typeof d.sizePx === "number" && Number.isFinite(d.sizePx)
          ? Math.round(d.sizePx)
          : baseMarkerPx;
      startSizes.set(id, cur);
    }
    if (startSizes.size === 0) return;
    markerResizeRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startSizes,
      ids: [...selectedDancerIds],
    };
    setMarkerDiamDraft(new Map(startSizes));
  };

  /**
   * 回転ハンドル：1 人は印まわりのハンドルで向きのみ。2 人以上は枠下のグループハンドルで位置＋向きを剛体回転。
   */
  const handlePointerDownMarkerRotate = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if (
      viewMode === "view" ||
      playbackDancers ||
      previewDancers ||
      !stageInteractionsEnabled
    )
      return;
    if (selectedDancerIds.length < 1) return;
    e.stopPropagation();
    e.preventDefault();
    const rotateHandleEl = e.currentTarget;
    const floorEl = stageMainFloorRef.current;
    if (!floorEl) return;
    const rect = floorEl.getBoundingClientRect();
    const dancers =
      writeFormation?.dancers ?? activeFormation?.dancers ?? [];
    let centerClientX: number;
    let centerClientY: number;
    const groupRigid =
      selectedDancerIds.length >= 2 && selectionBox != null;
    if (groupRigid) {
      const cxPct = (selectionBox!.x0 + selectionBox!.x1) / 2;
      const cyPct = (selectionBox!.y0 + selectionBox!.y1) / 2;
      centerClientX = rect.left + (cxPct / 100) * rect.width;
      centerClientY = rect.top + (cyPct / 100) * rect.height;
    } else {
      const primaryId = selectedDancerIds[0]!;
      const primary = dancers.find((x) => x.id === primaryId);
      if (!primary) return;
      centerClientX = rect.left + (primary.xPct / 100) * rect.width;
      centerClientY = rect.top + (primary.yPct / 100) * rect.height;
    }
    /**
     * クリック位置ではなく回転マーク（ボタン）の幾何中心からの角度を基準にする。
     * マーク内の多少のズレで 45° グリッドやガイドの基準が歪まないようにする。
     */
    const hr = rotateHandleEl.getBoundingClientRect();
    const handleCenterX = hr.left + hr.width / 2;
    const handleCenterY = hr.top + hr.height / 2;
    const startPointerAngle = Math.atan2(handleCenterY - centerClientY, handleCenterX - centerClientX);
    const startFacings = new Map<string, number>();
    const startPositions = new Map<string, { xPct: number; yPct: number }>();
    for (const id of selectedDancerIds) {
      const d = dancers.find((x) => x.id === id);
      if (!d) continue;
      const cur =
        typeof d.facingDeg === "number" && Number.isFinite(d.facingDeg)
          ? d.facingDeg
          : 0;
      startFacings.set(id, normalizeDancerFacingDeg(cur));
      if (groupRigid) {
        startPositions.set(id, { xPct: d.xPct, yPct: d.yPct });
      }
    }
    if (startFacings.size === 0) return;
    try {
      rotateHandleEl.setPointerCapture(e.pointerId);
    } catch {
      /* capture 不可時も window の pointermove で回転は継続 */
    }
    markerRotateRef.current = {
      centerClientX,
      centerClientY,
      startPointerAngle,
      startFacings,
      ids: [...selectedDancerIds],
      mode: groupRigid ? "groupRigid" : "facing",
      ...(groupRigid ? { startPositions } : {}),
    };
    const initFacing = new Map(startFacings);
    markerFacingDraftRef.current = initFacing;
    setMarkerFacingDraft(initFacing);
    if (groupRigid) {
      const initPos = new Map(startPositions);
      markerGroupPosDraftRef.current = initPos;
      setMarkerGroupPosDraft(initPos);
      setBulkHideDancerGlyphs(true);
      setGroupRotateGuideDeltaDeg(0);
    } else {
      markerGroupPosDraftRef.current = null;
      setMarkerGroupPosDraft(null);
      setBulkHideDancerGlyphs(false);
      setGroupRotateGuideDeltaDeg(null);
    }
  };

  /** 空ステージを押したら範囲選択を始める（および選択のクリア） */
  const handlePointerDownFloor = (e: ReactPointerEvent<HTMLDivElement>) => {
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
      const fw = Math.round(clamp(floorTextDraft.fontWeight, 300, 900) / 50) * 50;
      if (floorTextEditId) {
        const col = floorTextDraftColorHex(floorTextDraft.color);
        const fam =
          (floorTextDraft.fontFamily ?? "").trim() || FLOOR_TEXT_DEFAULT_FONT;
        const editMk = writeFormation.floorMarkup?.find(
          (x): x is StageFloorTextMarkup =>
            x.id === floorTextEditId && x.kind === "text"
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
              : m
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
        id: crypto.randomUUID(),
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
            clamp(((e.clientX - rr.left) / rr.width) * 100, 0, 100)
          );
          newText.yPct = round2(
            clamp(((e.clientY - rr.top) / rr.height) * 100, 0, 100)
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
    if (!additive) setSelectedDancerIds([]);
    setSelectedSetPieceId(null);
  };

  useEffect(() => {
    let queuedFormationUpdater:
      | ((f: NonNullable<typeof writeFormation>) => NonNullable<typeof writeFormation>)
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
      updater: (f: NonNullable<typeof writeFormation>) => NonNullable<typeof writeFormation>
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
          true
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
          !e.shiftKey
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
              : x
          ),
        }));
        return;
      }
      /** 1b0: 床テキストの角スケール */
      const fr = floorTextResizeDragRef.current;
      if (fr && e.pointerId === fr.pointerId) {
        const nd = Math.max(
          12,
          Math.hypot(e.clientX - fr.anchorX, e.clientY - fr.anchorY)
        );
        const ratio = clamp(nd / fr.startDist, 0.12, 14);
        const nextScale = clamp(fr.startScale * ratio, 0.2, 8);
        queueFormationUpdate((f) => ({
          ...f,
          floorMarkup: (f.floorMarkup ?? []).map((x) =>
            x.id === fr.id && x.kind === "text" ? { ...x, scale: nextScale } : x
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
          e.clientY - tapOr.startClientY
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
                x.id === tid && x.kind === "text" ? { ...x, xPct: nx, yPct: ny } : x
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
            x.id === fmd.id && x.kind === "text" ? { ...x, xPct: nx, yPct: ny } : x
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
          (d) => !idSet.has(d.id)
        );
        if (guideX == null) {
          outer: for (const id of g.ids) {
            const s = g.startPositions.get(id);
            if (!s) continue;
            const nx = round2(
              clamp(
                s.xPct + dxPct,
                DANCER_STAGE_POSITION_PCT_LO,
                DANCER_STAGE_POSITION_PCT_HI
              )
            );
            const xTargets = [STAGE_CENTER_PCT, ...outsideDancers.map((d) => d.xPct)];
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
                DANCER_STAGE_POSITION_PCT_HI
              )
            );
            const yTargets = [STAGE_CENTER_PCT, ...outsideDancers.map((d) => d.yPct)];
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
              DANCER_STAGE_POSITION_PCT_HI
            );
            const ny = clamp(
              s.yPct + dyPct,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI
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
          keepAspect
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
              DANCER_STAGE_POSITION_PCT_HI
            );
            const ny = clamp(
              ay + (s.yPct - ay) * sy,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI
            );
            return { ...x, xPct: round2(nx), yPct: round2(ny) };
          }),
        }));
        setTrashHotIfChanged(false);
        return;
      }
      /** 4: 向き（丸い回転ハンドル）— 1 人は向きのみ。複数は枠中心まわりに位置＋向きを剛体回転 */
      const rot = markerRotateRef.current;
      if (rot) {
        const curAngle = Math.atan2(
          e.clientY - rot.centerClientY,
          e.clientX - rot.centerClientX
        );
        let deltaRad = curAngle - rot.startPointerAngle;
        while (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
        while (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
        const deltaDeg = (deltaRad * 180) / Math.PI;
        const cos = Math.cos(deltaRad);
        const sin = Math.sin(deltaRad);
        const draft = new Map<string, number>();
        for (const id of rot.ids) {
          const s = rot.startFacings.get(id) ?? 0;
          draft.set(id, normalizeDancerFacingDeg(s + deltaDeg));
        }
        markerFacingDraftRef.current = draft;
        setMarkerFacingDraft(draft);
        if (rot.mode === "groupRigid") {
          setGroupRotateGuideDeltaDeg(deltaDeg);
        }
        if (
          rot.mode === "groupRigid" &&
          rot.startPositions &&
          rot.startPositions.size > 0
        ) {
          const floor = stageMainFloorRef.current;
          if (floor) {
            const r = floor.getBoundingClientRect();
            const w = r.width;
            const h = r.height;
            if (w > 0 && h > 0) {
              const draftPos = new Map<string, { xPct: number; yPct: number }>();
              for (const id of rot.ids) {
                const s = rot.startPositions.get(id);
                if (!s) continue;
                const px0 = r.left + (s.xPct / 100) * w;
                const py0 = r.top + (s.yPct / 100) * h;
                const vx = px0 - rot.centerClientX;
                const vy = py0 - rot.centerClientY;
                const px1 = rot.centerClientX + vx * cos - vy * sin;
                const py1 = rot.centerClientY + vx * sin + vy * cos;
                const nxPct = clamp(
                  ((px1 - r.left) / w) * 100,
                  DANCER_STAGE_POSITION_PCT_LO,
                  DANCER_STAGE_POSITION_PCT_HI
                );
                const nyPct = clamp(
                  ((py1 - r.top) / h) * 100,
                  DANCER_STAGE_POSITION_PCT_LO,
                  DANCER_STAGE_POSITION_PCT_HI
                );
                draftPos.set(id, {
                  xPct: round2(nxPct),
                  yPct: round2(nyPct),
                });
              }
              markerGroupPosDraftRef.current = draftPos;
              setMarkerGroupPosDraft(draftPos);
            }
          }
        }
        setTrashHotIfChanged(false);
        return;
      }
      /** 5: 代表ダンサー右下の○サイズハンドル（選択中の全員に同じ差分を適用） */
      const m = markerResizeRef.current;
      if (m) {
        const dx = e.clientX - m.startClientX;
        const dy = e.clientY - m.startClientY;
        /** 右下方向に引っ張ると大きく、左上に引くと小さくなる */
        const delta = (dx + dy) / 2;
        const draft = new Map<string, number>();
        for (const [id, s0] of m.startSizes) {
          const next = Math.round(clamp(s0 + delta, MARKER_PX_MIN, MARKER_PX_MAX));
          draft.set(id, next);
        }
        setMarkerDiamDraft(draft);
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
          Math.hypot(e.clientX - mq.startClientX, e.clientY - mq.startClientY)
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
          e.clientY - tapUp.startClientY
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
      if (
        floorTextDragEnd &&
        hitTrashDropZone(e.clientX, e.clientY)
      ) {
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
      /** 向き／複数時は位置も含む回転ドラッグの確定 */
      const rotUp = markerRotateRef.current;
      const facingDraftSnap = markerFacingDraftRef.current;
      const posDraftSnap = markerGroupPosDraftRef.current;
      if (rotUp && facingDraftSnap && facingDraftSnap.size > 0) {
        let facingChanged = false;
        for (const id of rotUp.ids) {
          const a = normalizeDancerFacingDeg(rotUp.startFacings.get(id) ?? 0);
          const b = normalizeDancerFacingDeg(facingDraftSnap.get(id) ?? a);
          if (a !== b) {
            facingChanged = true;
            break;
          }
        }
        let posChanged = false;
        if (
          rotUp.mode === "groupRigid" &&
          rotUp.startPositions &&
          posDraftSnap &&
          posDraftSnap.size > 0
        ) {
          for (const id of rotUp.ids) {
            const a = rotUp.startPositions.get(id);
            const b = posDraftSnap.get(id);
            if (
              a &&
              b &&
              (a.xPct !== b.xPct || a.yPct !== b.yPct)
            ) {
              posChanged = true;
              break;
            }
          }
        }
        if (facingChanged || posChanged) {
          setProject((p) => ({
            ...p,
            formations: p.formations.map((f) =>
              f.id === formationIdForWrites
                ? {
                    ...f,
                    dancers: f.dancers.map((x) => {
                      if (!rotUp.ids.includes(x.id)) return x;
                      let next: DancerSpot = { ...x };
                      if (posDraftSnap?.has(x.id)) {
                        const pr = posDraftSnap.get(x.id)!;
                        next = { ...next, xPct: pr.xPct, yPct: pr.yPct };
                      }
                      if (facingDraftSnap.has(x.id)) {
                        const deg = normalizeDancerFacingDeg(
                          facingDraftSnap.get(x.id)!
                        );
                        const { facingDeg: _fd, ...rest } = next;
                        next =
                          deg === 0 ? rest : { ...rest, facingDeg: deg };
                      }
                      return next;
                    }),
                  }
                : f
            ),
          }));
        }
      }
      markerRotateRef.current = null;
      markerFacingDraftRef.current = null;
      markerGroupPosDraftRef.current = null;
      setMarkerFacingDraft(null);
      setMarkerGroupPosDraft(null);
      /** ○サイズ確定（選択中の各ダンサーに `sizePx` を保存する） */
      const m = markerResizeRef.current;
      if (m && markerDiamDraft && markerDiamDraft.size > 0) {
        const changed = [...markerDiamDraft.entries()].some(
          ([id, v]) => m.startSizes.get(id) !== v
        );
        if (changed) {
          const nextSizes = new Map(markerDiamDraft);
          setProject((p) => ({
            ...p,
            formations: p.formations.map((f) =>
              f.id === formationIdForWrites
                ? {
                    ...f,
                    dancers: f.dancers.map((x) => {
                      const v = nextSizes.get(x.id);
                      if (typeof v !== "number") return x;
                      return { ...x, sizePx: v };
                    }),
                  }
                : f
            ),
          }));
        }
      }
      markerResizeRef.current = null;
      setMarkerDiamDraft(null);
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
                  x.yPct <= maxY
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
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (t instanceof HTMLElement && t.isContentEditable) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateDancerIds(selectedDancerIds);
        return;
      }

      if (e.key === "Escape") {
        groupDragRef.current = null;
        markerRotateRef.current = null;
        markerFacingDraftRef.current = null;
        markerGroupPosDraftRef.current = null;
        floorMarkupTextDragRef.current = null;
        floorTextTapOrDragRef.current = null;
        setSelectedDancerIds([]);
        setMarquee(null);
        marqueeSessionRef.current = null;
        setFloorMarkupTool(null);
        floorLineSessionRef.current = null;
        setFloorLineDraft(null);
        setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
        setFloorTextEditId(null);
        setFloorTextInlineRect(null);
        setDragGhostById(null);
        setMarkerFacingDraft(null);
        setMarkerGroupPosDraft(null);
        setBulkHideDancerGlyphs(false);
        setGroupRotateGuideDeltaDeg(null);
        return;
      }
      /** 選択中が 1 件以上なら Alt+矢印で微移動。複数選択時は群全体を動かす。 */
      if (!e.altKey || selectedDancerIds.length === 0) return;
      const dk = e.key;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(dk)) return;
      e.preventDefault();
      const stepPx = e.shiftKey ? 0.05 : 0.25;
      const shiftFine = e.shiftKey;
      const afterSnap = (nx: number, ny: number) => {
        const mode: SnapMode = snapGrid ? "fine" : "free";
        let xPct = quantizeCoord(nx, "x", mode);
        const yPct = quantizeCoord(ny, "y", mode);
        if (
          !shiftFine &&
          typeof stageWidthMm === "number" &&
          stageWidthMm > 0 &&
          (dk === "ArrowLeft" || dk === "ArrowRight")
        ) {
          xPct = round2(
            snapXPctToCenterDistanceMmGrid(xPct, stageWidthMm, 50)
          );
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
  ]);

  /**
   * `rot` は `useStageBoardLayoutAfterDraft`（`stageShell` 相当の束）由来。
   * 客席を画面上にしたとき `rot` が 180° になり、帯ラベル・場ミリ数字が上下逆さまに見える。
   * 人数バッジと同様に、文字だけ画面に対して正立させる（transformOrigin で辺に固定）。
   */
  const labelScreenKeepUpright = (origin: string): CSSProperties =>
    rot % 360 !== 0
      ? { transform: `rotate(${-rot}deg)`, transformOrigin: origin }
      : {};

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

  const handleTapOverlayPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!tapStageToEditLayout || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onRequestLayoutEditFromStage();
  };

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

  const mainFloorStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    /** 常に印を床パネル外（翼・花道側）にも描けるよう visible（再生中も客席帯を切らない） */
    overflow: "visible",
    background: `linear-gradient(180deg, #0f1729 0%, #0a0f18 42%, ${shell.bgDeep} 100%)`,
  };

  const mmLabel = (xPct: number, yPct: number) => {
    if (stageWidthMm == null || stageDepthMm == null) return null;
    const xMm = Math.round((xPct / 100) * stageWidthMm);
    const yMm = Math.round((yPct / 100) * stageDepthMm);
    return `${xMm} × ${yMm} mm`;
  };

  const showTrashDrop =
    viewMode === "edit" &&
    !playbackDancers &&
    !previewDancers &&
    trashUiVisible;

  /** 選択中ダンサーを囲む bounding box（pct 単位）。2 件以上で表示。 */
  const selectionBox = useMemo(() => {
    if (playbackOrPreview) return null;
    if (viewMode === "view") return null;
    const ids = selectedDancerIds;
    if (ids.length < 2) return null;
    const ds = (writeFormation?.dancers ?? activeFormation?.dancers ?? []).filter(
      (x) => ids.includes(x.id)
    );
    if (ds.length < 2) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const d of ds) {
      const ox = markerGroupPosDraft?.get(d.id)?.xPct ?? d.xPct;
      const oy = markerGroupPosDraft?.get(d.id)?.yPct ?? d.yPct;
      if (ox < x0) x0 = ox;
      if (oy < y0) y0 = oy;
      if (ox > x1) x1 = ox;
      if (oy > y1) y1 = oy;
    }
    if (
      !Number.isFinite(x0) ||
      !Number.isFinite(y0) ||
      !Number.isFinite(x1) ||
      !Number.isFinite(y1)
    )
      return null;
    return { x0, y0, x1, y1 };
  }, [
    selectedDancerIds,
    writeFormation,
    activeFormation,
    playbackOrPreview,
    viewMode,
    markerGroupPosDraft,
  ]);

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
          crew: string | undefined
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
            m.skillRankLabel
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
                : m
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
    [formationIdForWrites, dancerQuickEditId, setProject]
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
            crewIds.has(m.id) ? { ...m, colorIndex: ci } : m
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
                idSet.has(d.id) ? { ...d, colorIndex: ci } : d
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
    ]
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
    ]
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
                : d
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
    ]
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
                : d
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
    ]
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
          "ステージの横幅（メイン床の幅）が未設定のため、センターからの距離を入れられません。舞台設定で幅を入れてください。"
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
    ]
  );

  const applyDancerArrange = useCallback(
    (
      fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
    ) => {
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
        selectedDancerIds
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
    ]
  );

  /** 位置の形を保った入れ替え（2人以上必須） */
  const applyPermuteArrange = useCallback(
    (
      fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
    ) => {
      if (!stageContextMenu || stageContextMenu.kind !== "dancer") return;
      const targetIds = resolveArrangeTargetIds(
        stageContextMenu.dancerId,
        selectedDancerIds
      );
      if (targetIds.length < 2) {
        window.alert(
          "いまの立ち位置のままの並び替えは、対象を 2 人以上選んでください。"
        );
        setStageContextMenu(null);
        return;
      }
      applyDancerArrange(fn);
    },
    [stageContextMenu, selectedDancerIds, applyDancerArrange]
  );

  const contextMenuStyle: CSSProperties | null = stageContextMenu
    ? computeStageContextMenuStyle(stageContextMenu)
    : null;

  const handleSetPieceBodyContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, piece: SetPiece) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedSetPieceId(piece.id);
      setStageContextMenu({
        kind: "setPiece",
        clientX: e.clientX,
        clientY: e.clientY,
        pieceId: piece.id,
      });
    },
    []
  );

  const handleSetPieceToggleInterpolate = useCallback(
    (p: SetPiece) => {
      updateActiveFormation((f) => ({
        ...f,
        setPieces: (f.setPieces ?? []).map((x) =>
          x.id === p.id ? { ...x, interpolateInGaps: !x.interpolateInGaps } : x
        ),
      }));
    },
    [updateActiveFormation]
  );

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
        screenSetPieces.length > 0)
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
      showStageFloorMarkup:
        displayFloorMarkup.length > 0 || !!floorLineDraft,
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
    ]
  );

  return (
    <StageBoardShell
      main={<StageBoardLayout {...stageBoardLayoutSlots} />}
      overlays={<StageBoardBodyOverlays {...stageBoardOverlaysProps} />}
    />
  );
}

StageBoardBody.displayName = "StageBoard";
