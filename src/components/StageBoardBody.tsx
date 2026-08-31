import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  FloorTextPlaceSession,
  SetPiece,
  StageFloorMarkup,
  StageFloorTextMarkup,
} from "../types/choreography";
import { useStageBoardController } from "../hooks/useStageBoardController";
import { useStageBoardStageResize } from "../hooks/useStageBoardStageResize";
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
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
  snapXPctToCenterDistanceMmGrid,
} from "../lib/dancerSpacing";
import {
  screenDeltaPctToStageDelta,
  screenPctToStagePct,
  stagePctToScreenPct,
} from "../lib/stageRotationCoordinates";
import { computeMarkerResizeDraftSizes } from "../lib/stageMarkerSizing";
import {
  applyDancerFieldOverridesToFormations,
  type DancerSizeApplyScope,
} from "../lib/applyDancerSizeOverrides";
import {
  clampNameBelowFontPx,
  computeNameBelowFontResizeDraftSizes,
  defaultNameBelowFontPx,
  effectiveNameBelowFontPx,
  stableDancerMarkerPxForNameFont,
} from "../lib/stageNameBelowFontSizing";
import { resolveArrangeTargetIds } from "../lib/stageSelectionArrange";
import {
  alignSelectedDancers,
  distributeSelectedDancers,
  flipSelectedDancers,
} from "../lib/stageSelectionTransform";
import {
  resolveStageEditMode,
  retainDancerIdsInFormation,
} from "../lib/stageEditMode";
import { cueNumberById } from "../lib/cueInterval";
import {
  getStageEditDockHost,
  subscribeStageEditDockHost,
} from "../lib/stageEditDockHost";
import {
  buildPrevCueCompareMarks,
  resolvePreviousCueDancers,
  resolvePreviousCueOrdinal,
  summarizePrevCueCompare,
} from "../lib/stagePrevCueCompare";
import {
  applyEffectivePositions,
  getEffectiveDancerPosition,
} from "../lib/stageEffectivePosition";
import {
  applyShapePositionsToDancers,
  type StageShapePresetId,
} from "../lib/stageShapeGenerator";
import { draftShapePreview, draftLayoutPresetPreview } from "../lib/stageShapePreviewSession";
import type { LayoutPresetId } from "../lib/formationLayouts";
import { draftPositionRotation } from "../lib/stagePositionRotation";
import {
  draftTidyPreview,
  type StageTidyAction,
} from "../lib/stageTidyActions";
import {
  generateDepthSwapPreview,
  inspectFormationDepthSwap,
  layoutDepthGroupMarksOnStage,
  mapDancerDepthGroupMarks,
} from "../lib/stageDepthPreview";
import type { DancerQuickEditApply } from "./DancerQuickEditDialog";
import {
  StageSizeApplyScopeDialog,
  type StageSizeApplyKind,
} from "./StageSizeApplyScopeDialog";
import {
  FloorTextMarkupBlock,
  type FloorTextDraftPayload,
  type FloorTextResizeDragPayload,
  type FloorTextTapOrDragPayload,
  type FloorTextMultiDragPayload,
} from "./FloorTextMarkupBlock";
import { StageBoardContextMenuLayer } from "./StageBoardContextMenuLayer";
import type { StageBoardContextMenuState } from "./StageBoardContextMenuLayer";
import { StageDancerContextMenuSheet } from "./StageDancerContextMenuSheet";
import { StageBoardLayout } from "./StageBoardLayout";
import { StageBoardShell } from "./StageBoardShell";
import { StageBoardMainColumn } from "./StageBoardMainColumn";
import { StageEditModeHeader } from "./StageEditModeHeader";
import { StageDancerContextToolbar } from "./StageDancerContextToolbar";
import { StageBoardPreviewFormationBanner } from "./StageBoardPreviewFormationBanner";
import { StageBoardScreenOverlay } from "./StageBoardScreenOverlay";
import { StageBoardBodyOverlays } from "./StageBoardBodyOverlays";
import { ExportToast } from "./ExportToast";
import { useExportToast } from "../hooks/useExportToast";
import { StageBoardBulkColorToolbar } from "./StageBoardBulkColorToolbar";
import { StageBoardBulkToolbarSlot } from "./StageBoardBulkToolbarSlot";
import { StageBoardStageFrame } from "./StageBoardStageFrame";
import { StageMotionArrowsOverlay } from "./StageMotionArrowsOverlay";
import { StagePrevCueCompareOverlay } from "./StagePrevCueCompareOverlay";
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
import { STAGE_BOARD_ABORT_POINTER_GESTURES } from "../lib/stageBoardGestureAbort";

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
  globalFloorMarkup = null,
  onUpdateGlobalFloorMarkup,
  floorTextPlaceSession = null,
  onFloorTextPlaceSessionChange,
  viewportTextOverlayRoot = null,
  floorMarkupTool: floorMarkupToolProp,
  onFloorMarkupToolChange,
  hideFloorMarkupFloatingToolbars = false,
  textPanelPortalTarget,
  onGestureHistoryBegin,
  onGestureHistoryEnd,
  onGestureHistoryCancel,
  markHistorySkipNextPush,
  studentViewerFocus = null,
  markerDisplayScale = 1,
  compactViewportChrome = false,
  compactLandscapeViewport = false,
  hideStageFloorTextMarkup = false,
  audienceEdgeOverride,
  trashDropEdge = "left",
  onOpenTextEditSheet,
  showMotionArrows = false,
  onOpenDancerPathEditor,
  enablePinchViewport = false,
  onCreateNextCue,
  editCueId = null,
}: StageBoardBodyProps) {
  const {
    isPlaying,
    formations,
    activeFormationId,
    snapGrid,
    gridSpacingMm,
    audienceEdge: projectAudienceEdge,
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
  const audienceEdge = audienceEdgeOverride ?? projectAudienceEdge;

  const {
    stageResizeDraft,
    hoveredStageHandle,
    setHoveredStageHandle,
    onStageCornerResizeDown,
    resizeDraftActive,
  } = useStageBoardStageResize({
    setProject,
    viewMode,
    stageInteractionsEnabled,
    playbackDancers,
    previewDancers,
    audienceEdge,
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
  });

  /** 画面端のゴミ箱帯（`position: fixed` で body に portal） */
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
  const [selectedSetPieceId, setSelectedSetPieceId] = useState<string | null>(
    null,
  );
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
  const floorTextResizeDragRef = useRef<FloorTextResizeDragPayload | null>(
    null,
  );
  /** 置き場所プレビューをドラッグ中 */
  const floorTextPlaceDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    session: FloorTextPlaceSession;
  } | null>(null);
  /** 床テキストツール：入力内容と次に置くときの書式 */
  const [floorTextDraft, setFloorTextDraft] = useState({
    ...EMPTY_FLOOR_TEXT_DRAFT,
  });
  /** 選択中の床テキスト id（スライダー・本文はこの項目を更新、空床クリックで移動） */
  const [floorTextEditId, setFloorTextEditId] = useState<string | null>(null);
  /** 角枠表示のみ（シングルタップ）。ダブルクリックでインライン編集 */
  const [selectedFloorTextId, setSelectedFloorTextId] = useState<string | null>(
    null,
  );
  /** Shift+クリックで選択した複数テキストの id 一覧（ツールなし時のみ） */
  const [selectedFloorTextIds, setSelectedFloorTextIds] = useState<string[]>([]);
  /** 複数テキスト一括ドラッグのセッション ref */
  const floorTextMultiDragRef = useRef<FloorTextMultiDragPayload | null>(null);
  /** ダブルクリックでその場編集するテキストの画面上位置 */
  const [floorTextInlineRect, setFloorTextInlineRect] = useState<{
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  /** テキストツール：マウス位置ゴーストプレビュー用のステージ内 % 座標 */
  const [floorGhostPos, setFloorGhostPos] = useState<{ xPct: number; yPct: number }>({ xPct: 50, yPct: 50 });
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
  /** 空床ダブルタップで全員選択 */
  const floorDoubleTapRef = useRef<{ t: number; x: number; y: number } | null>(
    null,
  );
  const STAGE_FLOOR_DOUBLE_TAP_MS = 320;
  const STAGE_FLOOR_DOUBLE_TAP_PX = 28;
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
   * 複数選択時は基準直径＋差分の同一直径を全員に適用する。
   */
  const markerResizeRef = useRef<{
    startClientX: number;
    startClientY: number;
    startSizes: Map<string, number>;
    ids: string[];
    anchorSizePx: number;
  } | null>(null);
  /** サイズドラッグ中は選択中ダンサー ID → 仮の直径 px を保持してライブプレビュー */
  const [markerDiamDraft, setMarkerDiamDraft] = useState<Map<
    string,
    number
  > | null>(null);
  /** 名前サイズハンドルドラッグ中のプレビュー（ID → px） */
  const nameBelowFontResizeRef = useRef<{
    startClientY: number;
    startFonts: Map<string, number>;
    ids: string[];
    anchorFontPx: number;
  } | null>(null);
  const [nameBelowFontDraft, setNameBelowFontDraft] = useState<Map<
    string,
    number
  > | null>(null);
  /** ○ / 名前サイズ変更後の適用範囲確認（このキュー / すべて） */
  const [sizeApplyPending, setSizeApplyPending] = useState<{
    kind: StageSizeApplyKind;
    overrides: Map<string, number>;
  } | null>(null);
  /**
   * 回転ハンドルドラッグ中の向きプレビュー（選択中の各 ID → 度）。
   * ポインターアップでプロジェクトに確定するまで `facingDeg` 表示に使う。
   */
  const [markerFacingDraft, setMarkerFacingDraft] = useState<Map<
    string,
    number
  > | null>(null);
  const markerRotateRef = useRef<{
    centerClientX: number;
    centerClientY: number;
    startPointerAngle: number;
    startFacings: Map<string, number>;
    ids: string[];
    /** 2 人以上＋選択枠あり：位置もまとめて回す。1 人は向きのみ。 */
    mode: "facing" | "groupRigid";
    startPositions?: Map<string, { xPct: number; yPct: number }>;
  } | null>(null);
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
  const [shapePreviewById, setShapePreviewById] = useState<Map<
    string,
    { xPct: number; yPct: number }
  > | null>(null);
  const [shapePreviewMeta, setShapePreviewMeta] = useState<{
    presetId: string;
    movementCostPct: number;
  } | null>(null);
  const [depthPreviewById, setDepthPreviewById] = useState<Map<
    string,
    { xPct: number; yPct: number }
  > | null>(null);
  const [rotationPreviewById, setRotationPreviewById] = useState<Map<
    string,
    { xPct: number; yPct: number }
  > | null>(null);
  const [rotationPreviewDir, setRotationPreviewDir] = useState<
    "cw" | "ccw" | null
  >(null);
  const [tidyPreviewById, setTidyPreviewById] = useState<Map<
    string,
    { xPct: number; yPct: number }
  > | null>(null);
  const [tidyPreviewActionId, setTidyPreviewActionId] = useState<
    StageTidyAction["id"] | null
  >(null);
  const [, setDepthPreviewPair] = useState<{
    colA: number;
    colB: number;
  } | null>(null);
  const [depthGuidesVisible, setDepthGuidesVisible] = useState(false);
  const {
    toast: shapePreviewToast,
    showToast: showShapePreviewToast,
    dismiss: dismissShapePreviewToast,
  } = useExportToast(5200);
  const shapePreviewKeyRef = useRef<string>("");

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
  const markerScale =
    typeof markerDisplayScale === "number" &&
    Number.isFinite(markerDisplayScale) &&
    markerDisplayScale > 0
      ? markerDisplayScale
      : 1;

  const scaleMarkerPx = useCallback(
    (px: number) =>
      Math.max(
        MARKER_PX_MIN,
        Math.min(MARKER_PX_MAX, Math.round(px * markerScale)),
      ),
    [markerScale],
  );

  /** ダンサー 1 人分の実効サイズ（px）。draft > 個別 sizePx > プロジェクト共通、の順で解決。 */
  const effectiveMarkerPx = useCallback(
    (d: DancerSpot) => {
      const draft = markerDiamDraft?.get(d.id);
      if (typeof draft === "number" && Number.isFinite(draft)) {
        return scaleMarkerPx(draft);
      }
      if (typeof d.sizePx === "number" && Number.isFinite(d.sizePx)) {
        return scaleMarkerPx(d.sizePx);
      }
      return scaleMarkerPx(baseMarkerPx);
    },
    [markerDiamDraft, baseMarkerPx, scaleMarkerPx],
  );

  /** 名下ラベルの実効フォント（px）。床幅連動の ○ 表示サイズではなく保存値ベースで解決。 */
  const resolveNameBelowFontPx = useCallback(
    (d: DancerSpot, _markerPx?: number) =>
      effectiveNameBelowFontPx(
        d,
        stableDancerMarkerPxForNameFont(d, project.dancerMarkerDiameterPx),
        nameBelowFontDraft?.get(d.id),
      ),
    [nameBelowFontDraft, project.dancerMarkerDiameterPx],
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
    [markerFacingDraft],
  );

  /** ゴミ箱ドロップゾーン上でダンサーをドラッグ中 */
  const [trashHot, setTrashHot] = useState(false);
  /** ポインタが画面端付近まで来たときだけゴミ箱 UI を出す */
  const [, setTrashUiVisible] = useState(false);
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
  /**
   * ステージ直下の「選択中の色」一括ツールバー。
   * 左クリックで選んだだけでは出さず、ステージ上のダンサーを右クリックしたあとだけ表示する。
   */
  const [showStageDancerColorToolbar, setShowStageDancerColorToolbar] =
    useState(false);
  /** 範囲選択枠の緑ボタンから開く大きな操作パネル */
  const [dancerSelectionSheetOpen, setDancerSelectionSheetOpen] =
    useState(false);
  const [prevCueCompareOn, setPrevCueCompareOn] = useState(false);
  const [prevCueMotionViewOn, setPrevCueMotionViewOn] = useState(false);
  const stageEditDockHost = useSyncExternalStore(
    subscribeStageEditDockHost,
    getStageEditDockHost,
    getStageEditDockHost
  );
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

  const lastFormationResetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastFormationResetIdRef.current === formationIdForWrites) return;
    lastFormationResetIdRef.current = formationIdForWrites;

    onGestureHistoryCancel?.();
    setDancerQuickEditId((id) => (id === null ? id : null));
    const liveIds = (
      formations.find((f) => f.id === formationIdForWrites)?.dancers ?? []
    ).map((d) => d.id);
    setSelectedDancerIds((ids) => {
      const next = retainDancerIdsInFormation(ids, liveIds);
      if (
        next.length === ids.length &&
        next.every((id, i) => id === ids[i])
      ) {
        return ids;
      }
      return next;
    });
    setStageContextMenu((m) => (m === null ? m : null));
    setDancerSelectionSheetOpen(false);
    setSelectedSetPieceId((id) => (id === null ? id : null));
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
    setNameBelowFontDraft(null);
    setSizeApplyPending(null);
    setMarkerFacingDraft(null);
    setMarkerGroupPosDraft(null);
    setDragGhostById(null);
    setFloorMarkupTool((tool) => (tool === null ? tool : null));
    floorLineSessionRef.current = null;
    setFloorLineDraft(null);
    setFloorTextDraft((draft) => {
      try {
        if (JSON.stringify(draft) === JSON.stringify(EMPTY_FLOOR_TEXT_DRAFT)) {
          return draft;
        }
      } catch {
        /** fall through */
      }
      return { ...EMPTY_FLOOR_TEXT_DRAFT };
    });
    setFloorTextEditId((id) => (id === null ? id : null));
    setSelectedFloorTextId((id) => (id === null ? id : null));
    setSelectedFloorTextIds((ids) => (ids.length === 0 ? ids : []));
    setFloorTextInlineRect(null);
    setShowStageDancerColorToolbar(false);
    setBulkHideDancerGlyphs(false);
    setGroupRotateGuideDeltaDeg(null);
  }, [
    formationIdForWrites,
    formations,
    onGestureHistoryCancel,
    setSelectedDancerIds,
  ]);

  /** ピンチ拡大など: 進行中のドラッグを破棄する */
  useEffect(() => {
    const abort = () => {
      const hadGesture =
        dragRef.current != null ||
        groupDragRef.current != null ||
        setPieceDragRef.current != null ||
        markerResizeRef.current != null ||
        markerRotateRef.current != null ||
        floorMarkupTextDragRef.current != null ||
        floorTextResizeDragRef.current != null ||
        floorTextPlaceDragRef.current != null ||
        floorTextMultiDragRef.current != null ||
        floorTextTapOrDragRef.current != null ||
        marqueeSessionRef.current != null;
      if (hadGesture) onGestureHistoryCancel?.();
      dragRef.current = null;
      groupDragRef.current = null;
      setPieceDragRef.current = null;
      markerResizeRef.current = null;
      markerRotateRef.current = null;
      markerFacingDraftRef.current = null;
      markerGroupPosDraftRef.current = null;
      floorMarkupTextDragRef.current = null;
      floorTextTapOrDragRef.current = null;
      floorTextResizeDragRef.current = null;
      floorTextPlaceDragRef.current = null;
      floorTextMultiDragRef.current = null;
      marqueeSessionRef.current = null;
      setMarquee(null);
      setMarkerDiamDraft(null);
      setMarkerFacingDraft(null);
      setMarkerGroupPosDraft(null);
      setDragGhostById(null);
      setBulkHideDancerGlyphs(false);
      setAlignGuides({ x: null, y: null });
      setTrashUiVisible(false);
      trashRevealActiveRef.current = false;
      setGroupRotateGuideDeltaDeg(null);
    };
    window.addEventListener(STAGE_BOARD_ABORT_POINTER_GESTURES, abort);
    return () => {
      window.removeEventListener(STAGE_BOARD_ABORT_POINTER_GESTURES, abort);
    };
  }, [onGestureHistoryCancel]);

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

  const displayDancers =
    previewDancers ??
    playbackDancers ??
    browseFormationDancers ??
    activeFormation?.dancers ??
    [];

  const positionOverlays = useMemo(
    () => ({
      shapePreviewById,
      depthPreviewById,
      rotationPreviewById,
      tidyPreviewById,
      groupPosDraft: markerGroupPosDraft,
    }),
    [shapePreviewById, depthPreviewById, rotationPreviewById, tidyPreviewById, markerGroupPosDraft],
  );

  /** 群の剛体回転ドラッグ中／形プレビュー中は仮座標で上書き（合成は getEffectiveDancerPosition） */
  const dancersForStageMarkers = useMemo(
    () => applyEffectivePositions(displayDancers, positionOverlays),
    [displayDancers, positionOverlays],
  );

  /**
   * ドラッグゴースト描画は pointermove ごとに走るため、
   * ghostId -> dancer / index を先に Map 化して find 系の線形探索を避ける。
   */
  const stageDancersForLookup = useMemo(
    () => writeFormation?.dancers ?? activeFormation?.dancers ?? [],
    [writeFormation?.dancers, activeFormation?.dancers],
  );
  const stageEditMode = useMemo(
    () =>
      resolveStageEditMode(
        selectedDancerIds,
        stageDancersForLookup.map((d) => d.id)
      ),
    [selectedDancerIds, stageDancersForLookup],
  );
  const editCueOrdinal = useMemo(
    () => cueNumberById(project.cues, editCueId),
    [project.cues, editCueId],
  );
  const prevCueDancers = useMemo(
    () => resolvePreviousCueDancers(project.cues, formations, editCueId),
    [project.cues, formations, editCueId],
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

  const screenFloorTexts = useMemo((): StageFloorTextMarkup[] => {
    if (hideStageFloorTextMarkup) return [];
    const out: StageFloorTextMarkup[] = [];
    for (const m of displayFloorMarkup) {
      if (m.kind === "text" && floorTextLayer(m) === "screen") out.push(m);
    }
    return out;
  }, [displayFloorMarkup, hideStageFloorTextMarkup]);

  const stageSetPieces = useMemo(
    () => displaySetPieces.filter((p) => setPieceLayer(p) === "stage"),
    [displaySetPieces],
  );
  const screenSetPieces = useMemo(
    () => displaySetPieces.filter((p) => setPieceLayer(p) === "screen"),
    [displaySetPieces],
  );

  /** 床テキストのその場編集 textarea は親の scale と見た目を揃える */
  const floorTextInlineMarkupScale = useMemo(() => {
    const id = floorTextInlineRect?.id;
    if (!id) return 1;
    const mk = displayFloorMarkup.find(
      (x): x is StageFloorTextMarkup => x.kind === "text" && x.id === id,
    );
    return mk ? floorTextMarkupScale(mk) : 1;
  }, [displayFloorMarkup, floorTextInlineRect?.id]);

  const playbackOrPreview = Boolean(playbackDancers || previewDancers);
  const prevCueCompareAvailable = Boolean(prevCueDancers && !playbackOrPreview);
  const prevCueOverlayOn =
    prevCueCompareAvailable && (prevCueCompareOn || prevCueMotionViewOn);
  const prevCueFromOrdinal = useMemo(
    () => resolvePreviousCueOrdinal(project.cues, editCueId),
    [project.cues, editCueId],
  );
  const prevCueCompareMarks = useMemo(() => {
    if (!prevCueOverlayOn || !prevCueDancers) return [];
    return buildPrevCueCompareMarks({
      prevDancers: prevCueDancers,
      currentDancers: dancersForStageMarkers,
    });
  }, [prevCueOverlayOn, prevCueDancers, dancersForStageMarkers]);
  const prevCueCompareSummary = useMemo(() => {
    if (!prevCueOverlayOn || !prevCueDancers) return null;
    return summarizePrevCueCompare({
      prevDancers: prevCueDancers,
      currentDancers: dancersForStageMarkers,
    });
  }, [prevCueOverlayOn, prevCueDancers, dancersForStageMarkers]);

  /** 選択中ダンサーを囲む bounding box（pct 単位）。2 件以上で表示。`handlePointerDownMarkerRotate` 等が依存するため早期に定義する。 */
  const selectionBox = useMemo(() => {
    if (playbackOrPreview) return null;
    if (viewMode === "view") return null;
    const ids = selectedDancerIds;
    if (ids.length < 2) return null;
    const ds = (
      writeFormation?.dancers ??
      activeFormation?.dancers ??
      []
    ).filter((x) => ids.includes(x.id));
    if (ds.length < 2) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const d of ds) {
      const { xPct: ox, yPct: oy } = getEffectiveDancerPosition(
        d,
        positionOverlays,
      );
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
    positionOverlays,
  ]);

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

  useEffect(() => {
    if (floorMarkupTool !== "text") {
      setFloorTextEditId(null);
      setFloorTextInlineRect(null);
    }
  }, [floorMarkupTool]);

  /** テキストツール: ステージ床上のマウス位置をゴーストプレビュー用に追跡 */
  useEffect(() => {
    if (floorMarkupTool !== "text") return;
    const el = stageMainFloorRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setFloorGhostPos({ xPct, yPct });
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => el.removeEventListener("pointermove", onMove);
  }, [floorMarkupTool, stageMainFloorRef]);

  /** ヘッダからの床テキスト配置中はステージ内の旧テキストツールと競合しないよう解除 */
  useEffect(() => {
    if (!floorTextPlaceSession) return;
    setFloorMarkupTool(null);
    setFloorTextEditId(null);
    floorTextTapOrDragRef.current = null;
  }, [floorTextPlaceSession]);

  /** 画面全体配置: 編集グリッド上の空所クリックでプレビュー位置を更新（入力欄・ボタンは除外） */
  // ref で最新値を保持して、ステージクリック時の位置更新リスナーが
  // テキスト入力のたびに再アタッチされないようにする
  const floorTextPlaceSessionRef = useRef(floorTextPlaceSession);
  const onFloorTextPlaceSessionChangeRef = useRef(onFloorTextPlaceSessionChange);
  useEffect(() => { floorTextPlaceSessionRef.current = floorTextPlaceSession; }, [floorTextPlaceSession]);
  useEffect(() => { onFloorTextPlaceSessionChangeRef.current = onFloorTextPlaceSessionChange; }, [onFloorTextPlaceSessionChange]);

  useEffect(() => {
    const root = viewportTextOverlayRoot;
    if (!root || !setPiecesEditable || !writeFormation)
      return;
    const onPointerDownCapture = (e: PointerEvent) => {
      const sess = floorTextPlaceSessionRef.current;
      const onChange = onFloorTextPlaceSessionChangeRef.current;
      if (!sess || !onChange) return;
      if (e.button !== 0) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!root.contains(t)) return;
      if (
        t.closest(
          "button, input, textarea, select, option, a[href], [role='dialog'], [role='menu'], [data-floor-text-place-preview], [data-floor-text-box], [data-floor-markup]",
        )
      )
        return;
      if (t.closest("[data-dancer-id], [data-set-piece-id]")) return;
      const r = root.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      e.preventDefault();
      const xPct = round2(
        clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
      );
      const yPct = round2(
        clamp(((e.clientY - r.top) / r.height) * 100, 0, 100),
      );
      onChange({ ...sess, xPct, yPct });
    };
    window.addEventListener("pointerdown", onPointerDownCapture, true);
    return () =>
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [
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
      setSelectedFloorTextId((cur) => (cur === id ? null : cur));
      setFloorTextEditId((cur) => (cur === id ? null : cur));
      setSelectedFloorTextIds((prev) => prev.filter((x) => x !== id));
      setFloorTextInlineRect((cur) => (cur?.id === id ? null : cur));
    },
    [writeFormation, setPiecesEditable, updateActiveFormation],
  );

  const removeGlobalFloorMarkupById = useCallback(
    (id: string) => {
      if (!onUpdateGlobalFloorMarkup || !setPiecesEditable) return;
      onUpdateGlobalFloorMarkup((prev) => prev.filter((x) => x.id !== id));
      setSelectedFloorTextId((cur) => (cur === id ? null : cur));
      setFloorTextEditId((cur) => (cur === id ? null : cur));
      setSelectedFloorTextIds((prev) => prev.filter((x) => x !== id));
      setFloorTextInlineRect((cur) => (cur?.id === id ? null : cur));
    },
    [onUpdateGlobalFloorMarkup, setPiecesEditable],
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
    [],
  );

  const handleFloorTextSelectMarkupTool = useCallback(
    (markupId: string, draft: FloorTextDraftPayload) => {
      setFloorTextEditId(markupId);
      setSelectedFloorTextId(markupId);
      setFloorTextDraft(draft);
    },
    [],
  );

  const handleFloorTextDoubleClickInline = useCallback(
    (
      m: StageFloorTextMarkup,
      bounds: DOMRect,
      draft: FloorTextDraftPayload,
    ) => {
      setFloorTextInlineRect({
        id: m.id,
        left: bounds.left,
        top: bounds.top,
        width: Math.max(180, bounds.width),
        height: Math.max(56, bounds.height),
      });
      setFloorTextEditId(m.id);
      setSelectedFloorTextId(m.id);
      setFloorTextDraft(draft);
    },
    [],
  );

  const handleFloorTextColorUpdate = useCallback(
    (id: string, color: string) => {
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: (f.floorMarkup ?? []).map((x) =>
          x.id === id && x.kind === "text" ? { ...x, color } : x,
        ),
      }));
    },
    [updateActiveFormation],
  );

  const handleFloorTextFontFamilyUpdate = useCallback(
    (id: string, fontFamily: string) => {
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: (f.floorMarkup ?? []).map((x) =>
          x.id === id && x.kind === "text" ? { ...x, fontFamily } : x,
        ),
      }));
    },
    [updateActiveFormation],
  );

  /** テキスト回転更新 */
  const handleFloorTextRotationUpdate = useCallback(
    (id: string, rotation: number) => {
      const isGlobal = (globalFloorMarkup ?? []).some((x) => x.id === id);
      if (isGlobal && onUpdateGlobalFloorMarkup) {
        onUpdateGlobalFloorMarkup((prev) =>
          prev.map((x) =>
            x.id === id && x.kind === "text" ? { ...x, rotation } : x,
          ),
        );
      } else {
        updateActiveFormation((f) => ({
          ...f,
          floorMarkup: (f.floorMarkup ?? []).map((x) =>
            x.id === id && x.kind === "text" ? { ...x, rotation } : x,
          ),
        }));
      }
    },
    [globalFloorMarkup, onUpdateGlobalFloorMarkup, updateActiveFormation],
  );

  /** ダブルクリック → 右パネル編集シートを開く */
  const handleOpenTextEditSheet = useCallback(
    (m: StageFloorTextMarkup, draft: FloorTextDraftPayload) => {
      const isGlobal = (globalFloorMarkup ?? []).some((x) => x.id === m.id);
      // floorMarkupTool は触らない（floorTextPlaceSession系と競合するため）
      setFloorTextEditId(m.id);
      setSelectedFloorTextId(m.id);
      setFloorTextDraft(draft);
      onOpenTextEditSheet?.(m.id, draft, isGlobal, m);
    },
    [globalFloorMarkup, onOpenTextEditSheet],
  );

  const handleAddTemplateText = useCallback(
    (text: string) => {
      const col = floorTextDraftColorHex(floorTextDraft.color);
      const fam =
        (floorTextDraft.fontFamily ?? "").trim() || FLOOR_TEXT_DEFAULT_FONT;
      const fs = Math.round(clamp(floorTextDraft.fontSizePx, 8, 56));
      const fw =
        Math.round(clamp(floorTextDraft.fontWeight, 300, 900) / 50) * 50;
      const newId = crypto.randomUUID();
      const newText: StageFloorTextMarkup = {
        kind: "text",
        id: newId,
        xPct: 50,
        yPct: 50,
        text: text.slice(0, 400),
        color: col,
        fontFamily: fam,
        scale: 1,
        fontSizePx: fs,
        fontWeight: fw,
        ...(floorTextDraft.bgColor ? { bgColor: floorTextDraft.bgColor } : {}),
      };
      if (floorTextDraft.scope === "global" && onUpdateGlobalFloorMarkup) {
        onUpdateGlobalFloorMarkup((prev) => [...prev, newText]);
        setFloorTextEditId(newId);
        setSelectedFloorTextId(newId);
        setFloorMarkupTool("text");
      } else {
        updateActiveFormation((f) => ({
          ...f,
          floorMarkup: [...(f.floorMarkup ?? []), newText],
        }));
        setFloorTextEditId(newId);
        setSelectedFloorTextId(newId);
        setFloorMarkupTool("text");
      }
    },
    [
      floorTextDraft,
      updateActiveFormation,
      onUpdateGlobalFloorMarkup,
      setFloorTextEditId,
      setFloorMarkupTool,
    ],
  );

  const handleShiftSelectFloorText = useCallback((id: string) => {
    setSelectedFloorTextIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

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
      selectedFloorTextIds,
      onShiftSelectFloorText: handleShiftSelectFloorText,
      floorTextMultiDragRef,
      onOpenTextEditSheet: handleOpenTextEditSheet,
      onUpdateTextRotation: handleFloorTextRotationUpdate,
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
      selectedFloorTextIds,
      handleShiftSelectFloorText,
      handleOpenTextEditSheet,
      handleFloorTextRotationUpdate,
    ],
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
    [floorTextPlaceSession],
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
          clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100),
        );
        const ny = round2(
          clamp(((ev.clientY - r.top) / r.height) * 100, 0, 100),
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
    [writeFormation, setPiecesEditable, updateActiveFormation],
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
        const nid = crypto.randomUUID();
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

  const handleDeleteSelectedDancers = useCallback(() => {
    if (
      viewMode === "view" ||
      playbackOrPreview ||
      stageInteractionsEnabled === false ||
      selectedDancerIds.length === 0
    ) {
      return;
    }
    removeDancersByIds([...selectedDancerIds]);
  }, [
    viewMode,
    playbackOrPreview,
    stageInteractionsEnabled,
    selectedDancerIds,
    removeDancersByIds,
  ]);

  const removeSetPieceById = useCallback(
    (pieceId: string) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false
      )
        return;
      updateActiveFormation((f) => ({
        ...f,
        setPieces: (f.setPieces ?? []).filter((x) => x.id !== pieceId),
      }));
      setSelectedSetPieceId((id) => (id === pieceId ? null : id));
      setStageContextMenu(null);
    },
    [writeFormation, updateActiveFormation, viewMode, stageInteractionsEnabled],
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
        viewportTextOverlayRoot,
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
    [setPiecesEditable, stageMainFloorRef, viewportTextOverlayRoot],
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
        viewportTextOverlayRoot,
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
    [setPiecesEditable, stageMainFloorRef, viewportTextOverlayRoot],
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
        viewportTextOverlayRoot,
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
    [setPiecesEditable, stageMainFloorRef, viewportTextOverlayRoot],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)
        return;
      if (t instanceof HTMLElement && t.isContentEditable) return;
      if (!setPiecesEditable) return;

      const removeFloorTextById = (id: string) => {
        const isGlobal = (globalFloorMarkup ?? []).some((x) => x.id === id);
        if (isGlobal) {
          removeGlobalFloorMarkupById?.(id);
        } else {
          removeFloorMarkupById(id);
        }
      };

      if (selectedFloorTextIds.length > 0) {
        e.preventDefault();
        for (const id of selectedFloorTextIds) {
          removeFloorTextById(id);
        }
        setSelectedFloorTextIds([]);
        setSelectedFloorTextId(null);
        setFloorTextEditId(null);
        setFloorTextInlineRect(null);
        return;
      }

      const floorTextTargetId = selectedFloorTextId ?? floorTextEditId;
      if (floorTextTargetId) {
        e.preventDefault();
        removeFloorTextById(floorTextTargetId);
        setSelectedFloorTextId(null);
        setFloorTextEditId(null);
        setFloorTextInlineRect(null);
        return;
      }

      if (!selectedSetPieceId) return;
      e.preventDefault();
      removeSetPieceById(selectedSetPieceId);
      setSelectedSetPieceId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedSetPieceId,
    selectedFloorTextId,
    selectedFloorTextIds,
    floorTextEditId,
    setPiecesEditable,
    removeSetPieceById,
    removeFloorMarkupById,
    removeGlobalFloorMarkupById,
    globalFloorMarkup,
  ]);

  const setTrashHotIfChanged = useCallback((v: boolean) => {
    if (trashHotRef.current === v) return;
    trashHotRef.current = v;
    setTrashHot(v);
  }, []);

  const hitTrashDropZone = useCallback((_clientX: number, _clientY: number) => {
    return false;
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
      /** CSS回転されたダンサー座標だけ、画面座標から逆変換する。 */
      rotationDeg = 0,
    ) => {
      const r = rootEl.getBoundingClientRect();
      if (r.width < 1e-6 || r.height < 1e-6) return null;
      const point = screenPctToStagePct(
        {
          xPct: ((clientX - r.left) / r.width) * 100,
          yPct: ((clientY - r.top) / r.height) * 100,
        },
        rotationDeg,
      );
      const { xPct, yPct } = point;
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
        rot,
      );
    },
    [pointerToPctInRoot, rot],
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

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = setPieceDragRef.current;
      if (!d) return;
      if (d.mode === "move") {
        const piece = writeFormation?.setPieces?.find(
          (x) => x.id === d.pieceId,
        );
        const root = piece
          ? getSetPieceCoordRoot(
              piece,
              stageMainFloorRef.current,
              viewportTextOverlayRoot,
            )
          : stageMainFloorRef.current;
        if (!root) return;
        const next = pointerToPctInRoot(
          root,
          e.clientX - d.offsetXPx,
          e.clientY - d.offsetYPx,
          e.shiftKey,
        );
        if (!next) return;
        updateActiveFormation((f) => {
          const pieces = [...(f.setPieces ?? [])];
          const idx = pieces.findIndex((x) => x.id === d.pieceId);
          if (idx < 0) return f;
          const p = pieces[idx];
          // ステージ外への配置を許可（上下左右に最大200%まで）
          const nx = clamp(next.xPct, -200, 200);
          const ny = clamp(next.yPct, -200, 200);
          pieces[idx] = { ...p, xPct: round2(nx), yPct: round2(ny) };
          return { ...f, setPieces: pieces };
        });
        return;
      }
      if (d.mode === "rotate") {
        const ang = Math.atan2(
          e.clientY - d.centerClientY,
          e.clientX - d.centerClientX,
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
      // リサイズ: サイズのスナップのみ（位置のクランプは外してステージ外配置を許可）
      const snapDim = (axis: "x" | "y", v: number) => {
        let c = v; // clamp 撤廃 — ステージ外配置を許可
        if (!snapGrid) return round2(c);
        if (mmSnapGrid) {
          const base = axis === "x" ? mmSnapGrid.stepXPct : mmSnapGrid.stepYPct;
          const step = e.shiftKey ? Math.max(0.05, base / 4) : base;
          c = Math.round(c / step) * step;
          return round2(c);
        }
        const step = e.shiftKey ? Math.max(0.25, gridStep / 4) : gridStep;
        c = Math.round(c / step) * step;
        return round2(c);
      };
      const raw = applySetPieceResizePct(
        d.handle,
        d.start.xPct,
        d.start.yPct,
        d.start.wPct,
        d.start.hPct,
        dxPct,
        dyPct,
      );
      let xPct = snapDim("x", raw.xPct);
      let yPct = snapDim("y", raw.yPct);
      let wPct = snapDim("x", raw.wPct);
      let hPct = snapDim("y", raw.hPct);
      wPct = Math.max(MIN_SET_PIECE_W_PCT, wPct);
      hPct = Math.max(MIN_SET_PIECE_H_PCT, hPct);
      xPct = clamp(xPct, -200, 200);
      yPct = clamp(yPct, -200, 200);
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
      if (shapePreviewKeyRef.current) {
        setShapePreviewById(null);
        setDepthPreviewById(null);
        setDepthPreviewPair(null);
        shapePreviewKeyRef.current = "";
      }
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
      if (selectedDancerIds.includes(dancerId)) {
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
      const screenPoint = stagePctToScreenPct({ xPct, yPct }, rot);
      const cx = r.left + (screenPoint.xPct / 100) * r.width;
      const cy = r.top + (screenPoint.yPct / 100) * r.height;
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
      rot,
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
      if (shapePreviewKeyRef.current) {
        setShapePreviewById(null);
        setDepthPreviewById(null);
        setDepthPreviewPair(null);
        shapePreviewKeyRef.current = "";
      }
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

  /**
   * 代表ダンサーの右下ハンドル → 選択中のダンサー全員の○サイズ（px）を変える。
   * 複数選択時は基準直径＋差分の同一直径を全員に適用する（名下フォントは青ハンドル）。
   */
  const handlePointerDownMarkerResize = useCallback(
    (e: ReactPointerEvent) => {
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
      const dancers = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
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
      let anchorSizePx = 0;
      for (const v of startSizes.values()) {
        anchorSizePx = Math.max(anchorSizePx, v);
      }
      if (!(anchorSizePx > 0)) anchorSizePx = baseMarkerPx;
      markerResizeRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startSizes,
        ids: [...selectedDancerIds],
        anchorSizePx,
      };
      setMarkerDiamDraft(new Map(startSizes));
    },
    [
      viewMode,
      playbackDancers,
      previewDancers,
      stageInteractionsEnabled,
      selectedDancerIds,
      writeFormation,
      activeFormation,
      baseMarkerPx,
      setMarkerDiamDraft,
    ],
  );

  /** 選択範囲左上の青ハンドル → 名下フォントサイズ（○とは独立） */
  const handlePointerDownNameBelowFontResize = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      if (
        viewMode === "view" ||
        playbackDancers ||
        previewDancers ||
        !stageInteractionsEnabled ||
        !dancerLabelBelow
      )
        return;
      if (selectedDancerIds.length < 1) return;
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const dancers = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      const startFonts = new Map<string, number>();
      for (const id of selectedDancerIds) {
        const d = dancers.find((x) => x.id === id);
        if (!d) continue;
        const markerPx = effectiveMarkerPx(d);
        startFonts.set(id, resolveNameBelowFontPx(d, markerPx));
      }
      if (startFonts.size === 0) return;
      let anchorFontPx = 0;
      for (const v of startFonts.values()) {
        anchorFontPx = Math.max(anchorFontPx, v);
      }
      if (!(anchorFontPx > 0)) {
        const anchorDancer = dancers.find((x) => x.id === selectedDancerIds[0]);
        anchorFontPx = defaultNameBelowFontPx(
          stableDancerMarkerPxForNameFont(
            anchorDancer ?? { sizePx: undefined },
            project.dancerMarkerDiameterPx,
          ),
        );
      }
      nameBelowFontResizeRef.current = {
        startClientY: e.clientY,
        startFonts,
        ids: [...selectedDancerIds],
        anchorFontPx,
      };
      setNameBelowFontDraft(new Map(startFonts));
    },
    [
      viewMode,
      playbackDancers,
      previewDancers,
      stageInteractionsEnabled,
      dancerLabelBelow,
      selectedDancerIds,
      writeFormation,
      activeFormation,
      effectiveMarkerPx,
      resolveNameBelowFontPx,
      project.dancerMarkerDiameterPx,
    ],
  );

  /**
   * 回転ハンドル：1 人は印まわりのハンドルで向きのみ。2 人以上は枠下のグループハンドルで位置＋向きを剛体回転。
   */
  const handlePointerDownMarkerRotate = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if (
        viewMode === "view" ||
        playbackDancers ||
        previewDancers ||
        !stageInteractionsEnabled
      )
        return;
      if (selectedDancerIds.length < 1) return;
      if (shapePreviewKeyRef.current) {
        setShapePreviewById(null);
        setDepthPreviewById(null);
        setDepthPreviewPair(null);
        shapePreviewKeyRef.current = "";
      }
      e.stopPropagation();
      e.preventDefault();
      const rotateHandleEl = e.currentTarget;
      const floorEl = stageMainFloorRef.current;
      if (!floorEl) return;
      const rect = floorEl.getBoundingClientRect();
      const dancers = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      let centerClientX: number;
      let centerClientY: number;
      const groupRigid = selectedDancerIds.length >= 2 && selectionBox != null;
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
      const startPointerAngle = Math.atan2(
        handleCenterY - centerClientY,
        handleCenterX - centerClientX,
      );
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
    },
    [
      viewMode,
      playbackDancers,
      previewDancers,
      stageInteractionsEnabled,
      selectedDancerIds,
      selectionBox,
      stageMainFloorRef,
      writeFormation,
      activeFormation,
      setMarkerFacingDraft,
      setMarkerGroupPosDraft,
      setBulkHideDancerGlyphs,
      setGroupRotateGuideDeltaDeg,
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
      /** ダンサー／大道具／ハンドル以外の床面のときだけ反応（削除ゴミ箱は画面端オーバーレイ） */
      const target = e.target as HTMLElement;
      if (target.closest("[data-dancer-id]")) return;
      if (target.closest("[data-set-piece-id]")) return;
      if (target.closest("[data-group-box-handle]")) return;
      if (target.closest("[data-group-selection-menu-handle]")) return;
      if (target.closest("[data-dancer-context-toolbar]")) return;
      if (target.closest("[data-name-below-font-handle]")) return;
      if (target.closest("[data-dancer-delete-handle]")) return;
      if (target.closest("[data-group-rotate-handle]")) return;
      if (target.closest("[data-marker-resize-handle]")) return;
      if (target.closest("[data-marker-rotate-handle]")) return;
      const el = stageMainFloorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const xPct = ((e.clientX - r.left) / r.width) * 100;
      const yPct = ((e.clientY - r.top) / r.height) * 100;

      if (
        floorTextPlaceSession &&
        !floorTextPlaceSession.editTargetId &&
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
          const vx = ((e.clientX - rr.left) / rr.width) * 100;
          const vy = ((e.clientY - rr.top) / rr.height) * 100;
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
          // グローバルテキストか formation テキストかを判定
          const isGlobalEdit = (globalFloorMarkup ?? []).some(
            (x) => x.id === floorTextEditId,
          );
          const editMk = isGlobalEdit
            ? (globalFloorMarkup ?? []).find(
                (x): x is StageFloorTextMarkup =>
                  x.id === floorTextEditId && x.kind === "text",
              )
            : writeFormation.floorMarkup?.find(
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
          if (isGlobalEdit && onUpdateGlobalFloorMarkup) {
            onUpdateGlobalFloorMarkup((prev) =>
              prev.map((m) =>
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
            );
          } else {
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
          }
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
          ...(floorTextDraft.bgColor ? { bgColor: floorTextDraft.bgColor } : {}),
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
        if (floorTextDraft.scope === "global" && onUpdateGlobalFloorMarkup) {
          onUpdateGlobalFloorMarkup((prev) => [...prev, newText]);
        } else {
          updateActiveFormation((f) => ({
            ...f,
            floorMarkup: [...(f.floorMarkup ?? []), newText],
          }));
        }
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

      const now = performance.now();
      const prevTap = floorDoubleTapRef.current;
      const isDoubleTap =
        prevTap != null &&
        now - prevTap.t <= STAGE_FLOOR_DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) <=
          STAGE_FLOOR_DOUBLE_TAP_PX;
      floorDoubleTapRef.current = { t: now, x: e.clientX, y: e.clientY };

      if (isDoubleTap) {
        const dancers = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
        const allIds = dancers.map((d) => d.id);
        if (allIds.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          marqueeSessionRef.current = null;
          setMarquee(null);
          setSelectedDancerIds(allIds);
          setSelectedSetPieceId(null);
          setTrashUiVisible(true);
          trashRevealActiveRef.current = true;
          floorDoubleTapRef.current = null;
          return;
        }
      }

      setSelectedFloorTextId(null);
      setSelectedFloorTextIds([]);
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
      globalFloorMarkup,
      onUpdateGlobalFloorMarkup,
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
      setSelectedDancerIds,
      setMarquee,
      writeFormation,
      activeFormation,
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
      /** 1: 単一ダンサーのドラッグ（画面端のゴミ箱帯へドロップで削除） */
      const d = dragRef.current;
      if (d) {
        const next = pxToPct(
          e.clientX - d.offsetXPx,
          e.clientY - d.offsetYPx,
          e.shiftKey,
          true,
        );
        if (!next) return;
        const reveal = pointerInViewportTrashRevealZone(
          e.clientX,
          e.clientY,
          trashDropEdge,
        );
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
            const nx = round2(clamp(tapOr.startXPct + dxPct, -200, 200));
            const ny = round2(clamp(tapOr.startYPct + dyPct, -200, 200));
            const tid = tapOr.id;
            const isGlobal = (globalFloorMarkup ?? []).some((x) => x.id === tid);
            if (isGlobal && onUpdateGlobalFloorMarkup) {
              onUpdateGlobalFloorMarkup((prev) =>
                prev.map((x) =>
                  x.id === tid && x.kind === "text"
                    ? { ...x, xPct: nx, yPct: ny }
                    : x,
                )
              );
            } else {
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
        }
        return;
      }
      /** 1b: 床に置いたテキストの移動（画面端でゴミ箱表示・ドロップで削除） */
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
        const nx = round2(clamp(fmd.startXPct + dxPct, -200, 200));
        const ny = round2(clamp(fmd.startYPct + dyPct, -200, 200));
        const reveal = pointerInViewportTrashRevealZone(
          e.clientX,
          e.clientY,
          trashDropEdge,
        );
        if (reveal !== trashRevealActiveRef.current) {
          trashRevealActiveRef.current = reveal;
          setTrashUiVisible(reveal);
        }
        const overTrash = hitTrashDropZone(e.clientX, e.clientY);
        setTrashHotIfChanged(overTrash);
        if (overTrash) {
          return;
        }
        const fmdIsGlobal = (globalFloorMarkup ?? []).some((x) => x.id === fmd.id);
        if (fmdIsGlobal && onUpdateGlobalFloorMarkup) {
          onUpdateGlobalFloorMarkup((prev) =>
            prev.map((x) =>
              x.id === fmd.id && x.kind === "text"
                ? { ...x, xPct: nx, yPct: ny }
                : x,
            )
          );
        } else {
          queueFormationUpdate((f) => ({
            ...f,
            floorMarkup: (f.floorMarkup ?? []).map((x) =>
              x.id === fmd.id && x.kind === "text"
                ? { ...x, xPct: nx, yPct: ny }
                : x,
            ),
          }));
        }
        return;
      }
      /** 1c-multi: 複数テキスト一括ドラッグ移動 */
      const multiDrag = floorTextMultiDragRef.current;
      if (multiDrag && e.pointerId === multiDrag.pointerId) {
        /* 初回 move 時に全選択テキストの開始位置を補完 */
        if (multiDrag.startPositions.size < multiDrag.ids.length) {
          const allMarkup = [
            ...(displayFloorMarkup ?? []),
            ...(globalFloorMarkup ?? []),
          ];
          for (const id of multiDrag.ids) {
            if (!multiDrag.startPositions.has(id)) {
              const found = allMarkup.find((x) => x.id === id && x.kind === "text");
              if (found) {
                const isGlobal = (globalFloorMarkup ?? []).some((x) => x.id === id);
                multiDrag.startPositions.set(id, {
                  xPct: (found as { xPct: number }).xPct,
                  yPct: (found as { yPct: number }).yPct,
                  layer: isGlobal ? "stage" : "stage",
                });
              }
            }
          }
        }
        const rectEl = stageMainFloorRef.current;
        if (!rectEl) return;
        const rr = rectEl.getBoundingClientRect();
        const dxPct = ((e.clientX - multiDrag.startClientX) / rr.width) * 100;
        const dyPct = ((e.clientY - multiDrag.startClientY) / rr.height) * 100;
        const reveal = pointerInViewportTrashRevealZone(
          e.clientX,
          e.clientY,
          trashDropEdge,
        );
        if (reveal !== trashRevealActiveRef.current) {
          trashRevealActiveRef.current = reveal;
          setTrashUiVisible(reveal);
        }
        const overTrash = hitTrashDropZone(e.clientX, e.clientY);
        setTrashHotIfChanged(overTrash);
        if (overTrash) return;
        const globalIds = new Set((globalFloorMarkup ?? []).map((x) => x.id));
        const globalUpdates = new Map<string, { xPct: number; yPct: number }>();
        const localUpdates = new Map<string, { xPct: number; yPct: number }>();
        for (const [id, start] of multiDrag.startPositions) {
          const nx = round2(clamp(start.xPct + dxPct, -200, 200));
          const ny = round2(clamp(start.yPct + dyPct, -200, 200));
          if (globalIds.has(id)) {
            globalUpdates.set(id, { xPct: nx, yPct: ny });
          } else {
            localUpdates.set(id, { xPct: nx, yPct: ny });
          }
        }
        if (globalUpdates.size > 0 && onUpdateGlobalFloorMarkup) {
          onUpdateGlobalFloorMarkup((prev) =>
            prev.map((x) => {
              const upd = globalUpdates.get(x.id);
              return upd && x.kind === "text" ? { ...x, ...upd } : x;
            }),
          );
        }
        if (localUpdates.size > 0) {
          queueFormationUpdate((f) => ({
            ...f,
            floorMarkup: (f.floorMarkup ?? []).map((x) => {
              const upd = localUpdates.get(x.id);
              return upd && x.kind === "text" ? { ...x, ...upd } : x;
            }),
          }));
        }
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
        const nx = round2(clamp(ftpd.startXPct + dxPct, -200, 200));
        const ny = round2(clamp(ftpd.startYPct + dyPct, -200, 200));
        onFloorTextPlaceSessionChange({ ...ftpd.session, xPct: nx, yPct: ny });
        return;
      }
      /** 2: 複数選択の一括移動（ゴミ箱一括削除付き） */
      const g = groupDragRef.current;
      if (g && g.mode === "move") {
        const stageDelta = screenDeltaPctToStageDelta(
          {
            xPct: ((e.clientX - g.startClientX) / g.floorWpx) * 100,
            yPct: ((e.clientY - g.startClientY) / g.floorHpx) * 100,
          },
          rot,
        );
        let dxPct = stageDelta.xPct;
        let dyPct = stageDelta.yPct;
        const idSet = new Set(g.ids);
        const STAGE_CENTER_PCT = 50;
        const CENTER_GUIDE_EPS = 0.02;
        /** 群移動中もポインタが画面端付近ならゴミ箱 UI を出す */
        const reveal = pointerInViewportTrashRevealZone(
          e.clientX,
          e.clientY,
          trashDropEdge,
        );
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
      const markerRot = markerRotateRef.current;
      if (markerRot) {
        const curAngle = Math.atan2(
          e.clientY - markerRot.centerClientY,
          e.clientX - markerRot.centerClientX,
        );
        let deltaRad = curAngle - markerRot.startPointerAngle;
        while (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
        while (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
        const deltaDeg = (deltaRad * 180) / Math.PI;
        const cos = Math.cos(deltaRad);
        const sin = Math.sin(deltaRad);
        const draft = new Map<string, number>();
        for (const id of markerRot.ids) {
          const s = markerRot.startFacings.get(id) ?? 0;
          draft.set(id, normalizeDancerFacingDeg(s + deltaDeg));
        }
        markerFacingDraftRef.current = draft;
        setMarkerFacingDraft(draft);
        if (markerRot.mode === "groupRigid") {
          setGroupRotateGuideDeltaDeg(deltaDeg);
        }
        if (
          markerRot.mode === "groupRigid" &&
          markerRot.startPositions &&
          markerRot.startPositions.size > 0
        ) {
          const floor = stageMainFloorRef.current;
          if (floor) {
            const r = floor.getBoundingClientRect();
            const w = r.width;
            const h = r.height;
            if (w > 0 && h > 0) {
              const draftPos = new Map<
                string,
                { xPct: number; yPct: number }
              >();
              for (const id of markerRot.ids) {
                const s = markerRot.startPositions.get(id);
                if (!s) continue;
                const px0 = r.left + (s.xPct / 100) * w;
                const py0 = r.top + (s.yPct / 100) * h;
                const vx = px0 - markerRot.centerClientX;
                const vy = py0 - markerRot.centerClientY;
                const px1 = markerRot.centerClientX + vx * cos - vy * sin;
                const py1 = markerRot.centerClientY + vx * sin + vy * cos;
                const nxPct = clamp(
                  ((px1 - r.left) / w) * 100,
                  DANCER_STAGE_POSITION_PCT_LO,
                  DANCER_STAGE_POSITION_PCT_HI,
                );
                const nyPct = clamp(
                  ((py1 - r.top) / h) * 100,
                  DANCER_STAGE_POSITION_PCT_LO,
                  DANCER_STAGE_POSITION_PCT_HI,
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
      /** 5: 代表ダンサー右下の○サイズハンドル（○直径のみ。名前サイズは青ハンドル） */
      const m = markerResizeRef.current;
      if (m) {
        const dx = e.clientX - m.startClientX;
        const dy = e.clientY - m.startClientY;
        /** 右下方向に引っ張ると大きく、左上に引くと小さくなる */
        const bulk = m.ids.length >= 2;
        const delta = (dx + dy) * (bulk ? 0.85 : 0.65);
        const draft = computeMarkerResizeDraftSizes({
          startSizes: m.startSizes,
          delta,
          minPx: MARKER_PX_MIN,
          maxPx: MARKER_PX_MAX,
          bulk,
          anchorSizePx: m.anchorSizePx,
        });
        flushSync(() => {
          setMarkerDiamDraft(new Map(draft));
        });
        setTrashHotIfChanged(false);
        return;
      }
      /** 5b: 名前サイズハンドル（上下ドラッグ・○とは独立） */
      const nf = nameBelowFontResizeRef.current;
      if (nf) {
        const dy = e.clientY - nf.startClientY;
        const bulk = nf.ids.length >= 2;
        const draft = computeNameBelowFontResizeDraftSizes({
          startFonts: nf.startFonts,
          deltaY: dy,
          bulk,
          anchorFontPx: nf.anchorFontPx,
        });
        flushSync(() => {
          setNameBelowFontDraft(new Map(draft));
        });
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
          setSelectedFloorTextIds([]);
          setSelectedFloorTextId(tapUp.id);
          setFloorTextEditId(tapUp.id);
          const tapIsGlobal = (globalFloorMarkup ?? []).some(
            (x) => x.id === tapUp.id,
          );
          setFloorTextDraft((d) => ({
            ...d,
            body: tapUp.text,
            fontSizePx: tapUp.fontSizePx,
            fontWeight: tapUp.fontWeight,
            color: tapUp.color,
            fontFamily: tapUp.fontFamily,
            scope: tapIsGlobal ? "global" : "formation",
          }));
        }
      }
      const floorTextDragEnd = floorMarkupTextDragRef.current;
      if (floorTextDragEnd && hitTrashDropZone(e.clientX, e.clientY)) {
        onGestureHistoryEnd?.();
        markHistorySkipNextPush?.();
        removeFloorMarkupById(floorTextDragEnd.id);
      }
      /* 複数テキスト一括ドラッグのポインターアップ */
      const multiDragEnd = floorTextMultiDragRef.current;
      if (multiDragEnd && e.pointerId === multiDragEnd.pointerId) {
        if (hitTrashDropZone(e.clientX, e.clientY)) {
          onGestureHistoryEnd?.();
          markHistorySkipNextPush?.();
          const globalIds = new Set((globalFloorMarkup ?? []).map((x) => x.id));
          for (const id of multiDragEnd.ids) {
            if (globalIds.has(id)) {
              removeGlobalFloorMarkupById?.(id);
            } else {
              removeFloorMarkupById(id);
            }
          }
          setSelectedFloorTextIds([]);
        } else {
          onGestureHistoryEnd?.();
        }
        floorTextMultiDragRef.current = null;
        setTrashUiVisible(false);
        trashRevealActiveRef.current = false;
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
      floorTextMultiDragRef.current = null;
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
            if (a && b && (a.xPct !== b.xPct || a.yPct !== b.yPct)) {
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
                          facingDraftSnap.get(x.id)!,
                        );
                        const { facingDeg: _fd, ...rest } = next;
                        next = deg === 0 ? rest : { ...rest, facingDeg: deg };
                      }
                      return next;
                    }),
                  }
                : f,
            ),
          }));
        }
      }
      markerRotateRef.current = null;
      markerFacingDraftRef.current = null;
      markerGroupPosDraftRef.current = null;
      setMarkerFacingDraft(null);
      setMarkerGroupPosDraft(null);
      /** ○サイズ確定 → 適用範囲（このキュー / すべて）を確認（プレビューは確定まで残す） */
      const m = markerResizeRef.current;
      if (m && markerDiamDraft && markerDiamDraft.size > 0) {
        const changed = [...markerDiamDraft.entries()].some(
          ([id, v]) => m.startSizes.get(id) !== v,
        );
        if (changed) {
          setSizeApplyPending({
            kind: "marker",
            overrides: new Map(markerDiamDraft),
          });
        } else {
          setMarkerDiamDraft(null);
        }
      } else {
        setMarkerDiamDraft(null);
      }
      markerResizeRef.current = null;
      /** 名下フォントサイズ確定 → 適用範囲を確認 */
      const nf = nameBelowFontResizeRef.current;
      if (nf && nameBelowFontDraft && nameBelowFontDraft.size > 0) {
        const changed = [...nameBelowFontDraft.entries()].some(
          ([id, v]) => nf.startFonts.get(id) !== v,
        );
        if (changed) {
          setSizeApplyPending({
            kind: "name",
            overrides: new Map(nameBelowFontDraft),
          });
        } else {
          setNameBelowFontDraft(null);
        }
      } else {
        setNameBelowFontDraft(null);
      }
      nameBelowFontResizeRef.current = null;
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
    trashDropEdge,
    markerDiamDraft,
    nameBelowFontDraft,
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
    globalFloorMarkup,
    onUpdateGlobalFloorMarkup,
    removeGlobalFloorMarkupById,
    displayFloorMarkup,
    setSelectedFloorTextIds,
    rot,
  ]);

  const cancelShapePreview = useCallback(() => {
    setShapePreviewById(null);
    setShapePreviewMeta(null);
    setDepthPreviewById(null);
    setDepthPreviewPair(null);
    setRotationPreviewById(null);
    setRotationPreviewDir(null);
    setTidyPreviewById(null);
    setTidyPreviewActionId(null);
    shapePreviewKeyRef.current = "";
  }, []);

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
        if (
          (shapePreviewById && shapePreviewById.size > 0) ||
          (depthPreviewById && depthPreviewById.size > 0) ||
          (rotationPreviewById && rotationPreviewById.size > 0) ||
          (tidyPreviewById && tidyPreviewById.size > 0)
        ) {
          e.preventDefault();
          cancelShapePreview();
          return;
        }
        groupDragRef.current = null;
        markerRotateRef.current = null;
        markerFacingDraftRef.current = null;
        markerGroupPosDraftRef.current = null;
        floorMarkupTextDragRef.current = null;
        floorTextTapOrDragRef.current = null;
        clearSelectedDancers();
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
    shapePreviewById,
    depthPreviewById,
    rotationPreviewById,
    tidyPreviewById,
    cancelShapePreview,
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
      isolation: "isolate",
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

  /** 画面端の削除帯は出さない（印のゴミ箱・右クリック削除を使う） */
  const showTrashDrop = false;

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
    const pos = getEffectiveDancerPosition(base, positionOverlays);
    if (pos.xPct === base.xPct && pos.yPct === base.yPct) return base;
    return { ...base, xPct: pos.xPct, yPct: pos.yPct };
  }, [
    selectedDancerIds,
    writeFormation,
    activeFormation,
    playbackOrPreview,
    viewMode,
    stageInteractionsEnabled,
    positionOverlays,
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

  const commitSizeApplyPending = useCallback(
    (scope: DancerSizeApplyScope) => {
      if (!sizeApplyPending || !formationIdForWrites) {
        setSizeApplyPending(null);
        setMarkerDiamDraft(null);
        setNameBelowFontDraft(null);
        return;
      }
      const { kind, overrides } = sizeApplyPending;
      const field = kind === "marker" ? "sizePx" : "nameBelowFontPx";
      setProject((p) => ({
        ...p,
        formations: applyDancerFieldOverridesToFormations(p.formations, {
          scope,
          currentFormationId: formationIdForWrites,
          overrides,
          field,
        }),
      }));
      setSizeApplyPending(null);
      setMarkerDiamDraft(null);
      setNameBelowFontDraft(null);
    },
    [sizeApplyPending, formationIdForWrites, setProject],
  );

  const cancelSizeApplyPending = useCallback(() => {
    setSizeApplyPending(null);
    setMarkerDiamDraft(null);
    setNameBelowFontDraft(null);
  }, []);

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

  const applySelectedMarkerSizePx = useCallback(
    (px: number) => {
      if (selectedDancerIds.length === 0) return;
      if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
        return;
      const next = Math.max(MARKER_PX_MIN, Math.min(MARKER_PX_MAX, Math.round(px)));
      const idSet = new Set(selectedDancerIds);
      updateActiveFormation((f) => ({
        ...f,
        dancers: f.dancers.map((d) => (idSet.has(d.id) ? { ...d, sizePx: next } : d)),
      }));
    },
    [
      selectedDancerIds,
      updateActiveFormation,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
    ],
  );

  const handleCreateNextCue = useCallback(() => {
    if (!onCreateNextCue) return;
    cancelShapePreview();
    onCreateNextCue();
  }, [cancelShapePreview, onCreateNextCue]);

  const beginShapePreview = useCallback(
    (presetId: StageShapePresetId) => {
      if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
        return;
      if (dancerQuickEditId) return;
      const persistDancers =
        writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      const next = draftShapePreview({
        dancers: persistDancers,
        selectedIds: selectedDancerIds,
        presetId,
        layoutOpts: {
          dancerSpacingMm: project.dancerSpacingMm,
          stageWidthMm: project.stageWidthMm,
        },
      });
      if (!next) {
        showShapePreviewToast({
          kind: "error",
          title: "この形には配置できませんでした",
          description: "人数または間隔がステージに収まりません。",
        });
        return;
      }
      if (next.ignoredSpacing) {
        showShapePreviewToast({
          kind: "info",
          title: "間隔を詰めて配置しています",
          description:
            "このステージ幅では指定の最小間隔を守れないため、間隔制約を外して並べました。",
        });
      }
      setDepthPreviewById(null);
      setDepthPreviewPair(null);
      setRotationPreviewById(null);
      setRotationPreviewDir(null);
      setTidyPreviewById(null);
      setTidyPreviewActionId(null);
      setShapePreviewById(next.draft.positions);
      setShapePreviewMeta({
        presetId: next.draft.presetId,
        movementCostPct: next.draft.movementCostPct,
      });
      shapePreviewKeyRef.current = selectedDancerIds.join("\0");
    },
    [
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
      dancerQuickEditId,
      writeFormation,
      activeFormation,
      selectedDancerIds,
      project.dancerSpacingMm,
      project.stageWidthMm,
      showShapePreviewToast,
    ],
  );

  const beginLayoutPresetPreview = useCallback(
    (presetId: LayoutPresetId) => {
      if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
        return;
      if (dancerQuickEditId) return;
      const persistDancers =
        writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      const draft = draftLayoutPresetPreview({
        dancers: persistDancers,
        selectedIds: selectedDancerIds,
        presetId,
        layoutOpts: {
          dancerSpacingMm: project.dancerSpacingMm,
          stageWidthMm: project.stageWidthMm,
        },
      });
      if (!draft) {
        showShapePreviewToast({
          kind: "error",
          title: "この形には配置できませんでした",
          description: "人数または間隔がステージに収まりません。",
        });
        return;
      }
      setDepthPreviewById(null);
      setDepthPreviewPair(null);
      setRotationPreviewById(null);
      setRotationPreviewDir(null);
      setTidyPreviewById(null);
      setTidyPreviewActionId(null);
      setShapePreviewById(draft.positions);
      setShapePreviewMeta({
        presetId: draft.presetId,
        movementCostPct: draft.movementCostPct,
      });
      shapePreviewKeyRef.current = selectedDancerIds.join("\0");
    },
    [
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
      dancerQuickEditId,
      writeFormation,
      activeFormation,
      selectedDancerIds,
      project.dancerSpacingMm,
      project.stageWidthMm,
      showShapePreviewToast,
    ],
  );

  const applyShapePreview = useCallback(() => {
    const preview = shapePreviewById?.size
      ? shapePreviewById
      : depthPreviewById?.size
        ? depthPreviewById
        : rotationPreviewById?.size
          ? rotationPreviewById
          : tidyPreviewById?.size
            ? tidyPreviewById
            : null;
    if (!preview) return;
    if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
      return;
    updateActiveFormation((f) => ({
      ...f,
      dancers: applyShapePositionsToDancers(f.dancers, preview),
    }));
    cancelShapePreview();
  }, [
    shapePreviewById,
    depthPreviewById,
    rotationPreviewById,
    tidyPreviewById,
    viewMode,
    stageInteractionsEnabled,
    playbackOrPreview,
    updateActiveFormation,
    cancelShapePreview,
  ]);

  const persistDancersForShape = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
  const depthSwapInspect = useMemo(
    () => inspectFormationDepthSwap(persistDancersForShape, selectedDancerIds),
    [persistDancersForShape, selectedDancerIds],
  );
  const depthGroupMarks = useMemo(() => {
    if (!depthGuidesVisible) return [];
    if (stageEditMode !== "formation") return [];
    const marks = mapDancerDepthGroupMarks(
      persistDancersForShape,
      selectedDancerIds
    );
    const pos = new Map(
      dancersForStageMarkers.map((d) => [
        d.id,
        { xPct: d.xPct, yPct: d.yPct },
      ])
    );
    return layoutDepthGroupMarksOnStage(marks, pos);
  }, [
    depthGuidesVisible,
    stageEditMode,
    persistDancersForShape,
    selectedDancerIds,
    dancersForStageMarkers,
  ]);
  const handleDepthGuidesVisibleChange = useCallback((visible: boolean) => {
    setDepthGuidesVisible(visible);
  }, []);

  const beginDepthPreview = useCallback(
    (colA: number, colB: number) => {
      if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
        return;
      if (dancerQuickEditId) return;
      const persistDancers =
        writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      const byId = generateDepthSwapPreview(
        persistDancers,
        selectedDancerIds,
        colA,
        colB,
      );
      if (byId.size === 0) return;
      setShapePreviewById(null);
      setShapePreviewMeta(null);
      setRotationPreviewById(null);
      setRotationPreviewDir(null);
      setTidyPreviewById(null);
      setTidyPreviewActionId(null);
      setDepthPreviewById(byId);
      setDepthPreviewPair({ colA, colB });
      shapePreviewKeyRef.current = selectedDancerIds.join("\0");
    },
    [
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
      dancerQuickEditId,
      writeFormation,
      activeFormation,
      selectedDancerIds,
    ],
  );

  const beginRotationPreview = useCallback(
    (direction: "cw" | "ccw") => {
      if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
        return;
      if (dancerQuickEditId) return;
      const persistDancers =
        writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      const next = draftPositionRotation(
        persistDancers,
        selectedDancerIds,
        direction
      );
      if (!next) return;
      setShapePreviewById(null);
      setShapePreviewMeta(null);
      setDepthPreviewById(null);
      setDepthPreviewPair(null);
      setTidyPreviewById(null);
      setTidyPreviewActionId(null);
      setRotationPreviewById(next.positions);
      setRotationPreviewDir(next.direction);
      shapePreviewKeyRef.current = selectedDancerIds.join("\0");
    },
    [
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
      dancerQuickEditId,
      writeFormation,
      activeFormation,
      selectedDancerIds,
    ],
  );

  const beginTidyPreview = useCallback(
    (actionId: StageTidyAction["id"]) => {
      if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
        return;
      if (dancerQuickEditId) return;
      if (selectedDancerIds.length < 2) return;
      const persistDancers =
        writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      const draft = draftTidyPreview(
        persistDancers,
        selectedDancerIds,
        actionId
      );
      if (!draft) {
        showShapePreviewToast({
          kind: "info",
          title: "すでに整っています",
          description: "この操作では立ち位置は変わりません。",
        });
        return;
      }
      setShapePreviewById(null);
      setShapePreviewMeta(null);
      setDepthPreviewById(null);
      setDepthPreviewPair(null);
      setRotationPreviewById(null);
      setRotationPreviewDir(null);
      setTidyPreviewById(draft.positions);
      setTidyPreviewActionId(draft.actionId);
      shapePreviewKeyRef.current = selectedDancerIds.join("\0");
    },
    [
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
      dancerQuickEditId,
      writeFormation,
      activeFormation,
      selectedDancerIds,
      showShapePreviewToast,
    ],
  );

  useEffect(() => {
    const key = selectedDancerIds.join("\0");
    const hasPreview = Boolean(
      (shapePreviewById && shapePreviewById.size > 0) ||
        (depthPreviewById && depthPreviewById.size > 0) ||
        (rotationPreviewById && rotationPreviewById.size > 0) ||
        (tidyPreviewById && tidyPreviewById.size > 0)
    );
    if (hasPreview && shapePreviewKeyRef.current && key !== shapePreviewKeyRef.current) {
      cancelShapePreview();
    }
  }, [selectedDancerIds, shapePreviewById, depthPreviewById, rotationPreviewById, tidyPreviewById, cancelShapePreview]);

  const applySelectedTransform = useCallback(
    (fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]) => {
      if (selectedDancerIds.length < 2) return;
      if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
        return;
      cancelShapePreview();
      // 反転: 1操作 = updateActiveFormation 1回 = Undo 1手
      updateActiveFormation((f) => ({
        ...f,
        dancers: fn(f.dancers, selectedDancerIds),
      }));
    },
    [
      selectedDancerIds,
      updateActiveFormation,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
      cancelShapePreview,
    ],
  );

  const applySelectedNameBelowFontPx = useCallback(
    (px: number) => {
      if (selectedDancerIds.length === 0) return;
      if (viewMode === "view" || !stageInteractionsEnabled || playbackOrPreview)
        return;
      const next = clampNameBelowFontPx(px);
      const idSet = new Set(selectedDancerIds);
      updateActiveFormation((f) => ({
        ...f,
        dancers: f.dancers.map((d) =>
          idSet.has(d.id) ? { ...d, nameBelowFontPx: next } : d
        ),
      }));
    },
    [
      selectedDancerIds,
      updateActiveFormation,
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

  const arrangeAnchorDancerId =
    stageContextMenu?.kind === "dancer"
      ? stageContextMenu.dancerId
      : dancerSelectionSheetOpen && primarySelectedDancer
        ? primarySelectedDancer.id
        : null;

  const applyDancerArrange = useCallback(
    (fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false ||
        playbackOrPreview
      )
        return;
      if (!arrangeAnchorDancerId) return;
      const targetIds = resolveArrangeTargetIds(
        arrangeAnchorDancerId,
        selectedDancerIds,
      );
      updateActiveFormation((f) => ({
        ...f,
        dancers: fn(f.dancers, targetIds),
      }));
      setStageContextMenu(null);
      setDancerSelectionSheetOpen(false);
    },
    [
      writeFormation,
      viewMode,
      stageInteractionsEnabled,
      playbackOrPreview,
      arrangeAnchorDancerId,
      selectedDancerIds,
      updateActiveFormation,
    ],
  );

  /** 位置の形を保った入れ替え（2人以上必須） */
  const applyPermuteArrange = useCallback(
    (fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]) => {
      if (!arrangeAnchorDancerId) return;
      const targetIds = resolveArrangeTargetIds(
        arrangeAnchorDancerId,
        selectedDancerIds,
      );
      if (targetIds.length < 2) {
        window.alert(
          "いまの立ち位置のままの並び替えは、対象を 2 人以上選んでください。",
        );
        setStageContextMenu(null);
        setDancerSelectionSheetOpen(false);
        return;
      }
      applyDancerArrange(fn);
    },
    [arrangeAnchorDancerId, selectedDancerIds, applyDancerArrange],
  );

  const contextMenuStyle: CSSProperties | null = stageContextMenu
    ? computeStageContextMenuStyle(stageContextMenu)
    : null;

  const dancerMenuInteractionDisabled =
    viewMode === "view" ||
    !stageInteractionsEnabled ||
    Boolean(playbackDancers) ||
    Boolean(previewDancers);

  const dancerContextMenuShared = useMemo(
    () => ({
      selectedDancerIds,
      formationDancers: stageDancersForLookup,
      menuInteractionDisabled: dancerMenuInteractionDisabled,
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
    }),
    [
      selectedDancerIds,
      stageDancersForLookup,
      dancerMenuInteractionDisabled,
      project.dancerLabelPosition,
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
    ],
  );

  const handleOpenSelectionMenu = useCallback(() => {
    if (dancerMenuInteractionDisabled) return;
    if (selectedDancerIds.length < 2) return;
    setShowStageDancerColorToolbar(true);
    setStageContextMenu(null);
    setDancerSelectionSheetOpen(true);
  }, [dancerMenuInteractionDisabled, selectedDancerIds.length]);

  /** 1人選択ツールバーの「⋯」：既存の右クリック小窓を開く */
  const handleOpenToolbarMore = useCallback(() => {
    if (dancerMenuInteractionDisabled) return;
    if (selectedDancerIds.length >= 2) {
      handleOpenSelectionMenu();
      return;
    }
    const d = primarySelectedDancer;
    const el = stageMainFloorRef.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    setShowStageDancerColorToolbar(true);
    setDancerSelectionSheetOpen(false);
    setStageContextMenu({
      kind: "dancer",
      clientX: r.left + (d.xPct / 100) * r.width,
      clientY: r.top + (d.yPct / 100) * r.height,
      dancerId: d.id,
    });
  }, [
    dancerMenuInteractionDisabled,
    selectedDancerIds.length,
    handleOpenSelectionMenu,
    primarySelectedDancer,
    stageMainFloorRef,
  ]);

  useEffect(() => {
    if (selectedDancerIds.length < 2) {
      setDancerSelectionSheetOpen(false);
    }
  }, [selectedDancerIds.length]);

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
    [],
  );

  const handleSetPieceToggleInterpolate = useCallback(
    (p: SetPiece) => {
      updateActiveFormation((f) => ({
        ...f,
        setPieces: (f.setPieces ?? []).map((x) =>
          x.id === p.id ? { ...x, interpolateInGaps: !x.interpolateInGaps } : x,
        ),
      }));
    },
    [updateActiveFormation],
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
    resolveNameBelowFontPx,
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
        rotationDeg: rot,
        labelScreenKeepUpright,
      },
      stageMainFloorRef,
      isPlaying,
      trimStartSec: project.trimStartSec,
      stopPlaybackOnFloorTap:
        viewMode !== "view" && !enablePinchViewport,
      onPointerDownFloor: handlePointerDownFloor,
      mainFloorStyle,
      setPiecesEditable,
      /* 床マークアップ浮遊ツール（setPiecesEditable 時のみ有効） */
      floorMarkupToolbarWhenEditable: {
        hideFloorMarkupFloatingToolbars,
        textPanelPortalTarget,
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
        onAddTemplateText: handleAddTemplateText,
        floorTextEditIsGlobal: floorTextEditId != null
          ? (globalFloorMarkup ?? []).some((x) => x.id === floorTextEditId)
          : floorTextDraft.scope === "global",
        onUpdateGlobalMarkup: onUpdateGlobalFloorMarkup,
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
        globalFloorMarkup: globalFloorMarkup ?? undefined,
        onRemoveGlobalFloorMarkupById: removeGlobalFloorMarkupById,
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
        floorTextDraftGhost: floorMarkupTool === "text" ? floorTextDraft : null,
        floorTextGhostPos: floorGhostPos,
        hideFloorText: hideStageFloorTextMarkup,
      },
      showStageFloorMarkup:
        displayFloorMarkup.some((m) => m.kind === "line") ||
        !!floorLineDraft ||
        (!hideStageFloorTextMarkup &&
          (displayFloorMarkup.some((m) => m.kind === "text") ||
            (globalFloorMarkup ?? []).some((m) => m.kind === "text") ||
            floorMarkupTool === "text")),
      /* 大道具：最背面レイヤーとして StageShellWithMainFloor に直接渡す */
      setPieceElements: stageSetPieceElements,
      /* 操作層（ダンサー印・マーキー等） */
      interaction: {
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
        onOpenSelectionMenuClick: handleOpenSelectionMenu,
        selectedDancerIds,
        onGroupRotatePointerDown: handlePointerDownMarkerRotate,
        dragGhostById,
        stageDancerById,
        bulkHideDancerGlyphs,
        dancerLabelBelow,
        stageDancerIndexById,
        effStageWidthMm: effStageWidthMm ?? 0,
        nameBelowClearanceExtraPx,
        resolveNameBelowFontPx,
        rot,
        dancerMarkerElements: stageDancerMarkerElements,
        onMarkerResizePointerDown: handlePointerDownMarkerResize,
        onNameBelowFontResizePointerDown: handlePointerDownNameBelowFontResize,
        onDeleteSelectedDancers: handleDeleteSelectedDancers,
        tapStageToEditLayout,
        onTapEditOverlayPointerDown: handleTapOverlayPointerDown,
        depthGroupMarks,
      },
    } satisfies BuildStageBoardExportColumnInput);

  // 動線矢印オーバーレイ
  if (showMotionArrows) {
    const highlightId =
      studentViewerFocus?.kind === "one"
        ? studentViewerFocus.crewMemberId
        : null;
    stageBoardExportColumn.mainFloor.motionArrowsOverlay = (
      <StageMotionArrowsOverlay
        formations={project.formations}
        activeFormationId={activeFormationId}
        highlightCrewMemberId={highlightId}
      />
    );
  }
  if (prevCueCompareMarks.length > 0) {
    const existing = stageBoardExportColumn.mainFloor.motionArrowsOverlay;
    stageBoardExportColumn.mainFloor.motionArrowsOverlay = (
      <>
        <StagePrevCueCompareOverlay
          marks={prevCueCompareMarks}
          showMotionArrows={prevCueMotionViewOn}
        />
        {existing}
      </>
    );
  }

  const showStageEditDock =
    canStageBulkTools &&
    Boolean(primarySelectedDancer) &&
    selectedDancerIds.length >= 1 &&
    !marquee;
  const stageEditDock = showStageEditDock && primarySelectedDancer ? (
    <StageDancerContextToolbar
      placement={stageEditDockHost ? "side" : "floor"}
      dancerLabel={primarySelectedDancer.label || "立ち位置"}
      selectedCount={selectedDancerIds.length}
      editMode={stageEditMode}
      cueOrdinal={editCueOrdinal}
      markerPx={effectiveMarkerPx(primarySelectedDancer)}
      colorIndex={primarySelectedDancer.colorIndex}
      nameFontPx={resolveNameBelowFontPx(
        primarySelectedDancer,
        effectiveMarkerPx(primarySelectedDancer)
      )}
      dancerLabelBelow={dancerLabelBelow}
      onNameFontChange={applySelectedNameBelowFontPx}
      onMarkerSizeChange={applySelectedMarkerSizePx}
      onColorChange={(i) =>
        applyBulkColorToDancerIds(selectedDancerIds, i)
      }
      onOpenMore={handleOpenToolbarMore}
      onCreateNextCue={
        stageEditMode === "formation" ? handleCreateNextCue : undefined
      }
      onSizeGestureBegin={onGestureHistoryBegin}
      onSizeGestureEnd={onGestureHistoryEnd}
      onAlign={(edge) =>
        applySelectedTransform((dancers, ids) =>
          alignSelectedDancers(dancers, ids, edge)
        )
      }
      onDistribute={(axis) =>
        applySelectedTransform((dancers, ids) =>
          distributeSelectedDancers(dancers, ids, axis)
        )
      }
      onFlip={(axis) =>
        applySelectedTransform((dancers, ids) =>
          flipSelectedDancers(dancers, ids, axis)
        )
      }
      shapePreviewActive={Boolean(
        shapePreviewById && shapePreviewById.size > 0
      )}
      shapePreviewPresetId={shapePreviewMeta?.presetId ?? null}
      shapePreviewMovementCostPct={
        shapePreviewMeta?.movementCostPct ?? 0
      }
      depthPreviewActive={Boolean(
        depthPreviewById && depthPreviewById.size > 0
      )}
      rotationPreviewActive={Boolean(
        rotationPreviewById && rotationPreviewById.size > 0
      )}
      rotationPreviewDir={rotationPreviewDir}
      tidyPreviewActive={Boolean(tidyPreviewById && tidyPreviewById.size > 0)}
      tidyPreviewActionId={tidyPreviewActionId}
      depthSwapInspect={depthSwapInspect}
      onBeginShapePreview={beginShapePreview}
      onBeginLayoutPresetPreview={beginLayoutPresetPreview}
      onBeginDepthPreview={beginDepthPreview}
      onBeginRotationPreview={beginRotationPreview}
      onBeginTidyPreview={beginTidyPreview}
      onCancelShapePreview={cancelShapePreview}
      onApplyShapePreview={applyShapePreview}
      onDepthGuidesVisibleChange={handleDepthGuidesVisibleChange}
      prevCueCompareAvailable={prevCueCompareAvailable}
      prevCueCompareOn={prevCueOverlayOn}
      prevCueCompareSummary={prevCueCompareSummary}
      onTogglePrevCueCompare={
        prevCueCompareAvailable
          ? () => {
              if (prevCueCompareOn || prevCueMotionViewOn) {
                setPrevCueCompareOn(false);
                setPrevCueMotionViewOn(false);
              } else {
                setPrevCueCompareOn(true);
              }
            }
          : undefined
      }
      prevCueMotionViewOn={prevCueMotionViewOn}
      prevCueFromOrdinal={prevCueFromOrdinal}
      prevCueToOrdinal={editCueOrdinal}
      onTogglePrevCueMotionView={
        prevCueCompareAvailable
          ? () => {
              if (prevCueMotionViewOn) {
                setPrevCueMotionViewOn(false);
              } else {
                setPrevCueCompareOn(true);
                setPrevCueMotionViewOn(true);
              }
            }
          : undefined
      }
    />
  ) : null;

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
        floorMarkupTool={floorMarkupTool}
        floorTextDraftGhost={floorMarkupTool === "text" ? floorTextDraft : null}
        floorTextGhostPos={floorGhostPos}
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
        editModeHeader={
          canStageBulkTools ? (
            <StageEditModeHeader
              mode={stageEditMode}
              cueOrdinal={editCueOrdinal}
            />
          ) : null
        }
        stageFrame={
          <StageBoardStageFrame
            compactViewportChrome={compactViewportChrome}
            compactLandscapeViewport={compactLandscapeViewport}
            enablePinchViewport={enablePinchViewport}
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
            resizeDraftActive={resizeDraftActive}
            onResizePointerDown={onStageCornerResizeDown}
            onHandlePointerEnter={setHoveredStageHandle}
            onHandlePointerLeave={(h) =>
              setHoveredStageHandle((cur) => (cur === h ? null : cur))
            }
            exportColumn={stageBoardExportColumn}
          />
        }
        editDock={
          !stageEditDockHost && stageEditDock ? (
            <div
              style={{
                flexShrink: 0,
                width: "100%",
                display: "flex",
                justifyContent: "center",
                padding: "4px 0 8px",
              }}
            >
              {stageEditDock}
            </div>
          ) : null
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
    stageContextMenu: (
      <>
        {stageContextMenu?.kind === "dancer" && contextMenuStyle ? (
          <div
            role="presentation"
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(2, 6, 23, 0.58)",
            }}
            onClick={() => setStageContextMenu(null)}
          />
        ) : null}
        {stageContextMenu && contextMenuStyle ? (
          <StageBoardContextMenuLayer
            menu={stageContextMenu}
            style={contextMenuStyle}
            containerRef={stageContextMenuRef}
            onCloseMenu={() => setStageContextMenu(null)}
            dancerMenu={dancerContextMenuShared}
            onOpenDancerPathEditor={onOpenDancerPathEditor}
            viewMode={viewMode}
            setPiecesEditable={setPiecesEditable}
            playbackDancers={playbackDancers}
            previewDancers={previewDancers}
            removeFloorMarkupById={removeFloorMarkupById}
            writeFormationSetPieces={writeFormation?.setPieces}
            updateActiveFormation={updateActiveFormation}
            removeSetPieceById={removeSetPieceById}
          />
        ) : null}
        {dancerSelectionSheetOpen && primarySelectedDancer ? (
          <StageDancerContextMenuSheet
            open
            onClose={() => setDancerSelectionSheetOpen(false)}
            anchorDancerId={primarySelectedDancer.id}
            {...dancerContextMenuShared}
            onOpenPathEditor={
              onOpenDancerPathEditor
                ? () => {
                    setDancerSelectionSheetOpen(false);
                    onOpenDancerPathEditor();
                  }
                : undefined
            }
          />
        ) : null}
      </>
    ),
  } satisfies StageBoardLayoutSlots;

  const handleFloorTextInlineRequestClose = useCallback(() => {
    setFloorTextInlineRect(null);
    setFloorTextEditId(null);
    setFloorMarkupTool(null);
  }, [setFloorMarkupTool]);

  const stageBoardOverlaysProps = useMemo(
    (): StageBoardBodyOverlaysProps => ({
      floorTextInlineRect,
      floorTextEditId,
      floorTextDraft,
      setFloorTextDraft,
      floorTextInlineMarkupScale,
      updateActiveFormation,
      floorTextEditIsGlobal: floorTextEditId != null
        ? (globalFloorMarkup ?? []).some((x) => x.id === floorTextEditId)
        : floorTextDraft.scope === "global",
      onUpdateGlobalMarkup: onUpdateGlobalFloorMarkup,
      onFloorTextInlineRequestClose: handleFloorTextInlineRequestClose,
      showTrashDrop,
      trashHot,
      trashDockViewportRef,
      trashDropEdge,
      onTrashTapDelete:
        selectedDancerIds.length >= 1 ? handleDeleteSelectedDancers : undefined,
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
      globalFloorMarkup,
      handleDeleteSelectedDancers,
      handleFloorTextInlineRequestClose,
      onUpdateGlobalFloorMarkup,
      quickEditDancerForDialog,
      selectedDancerIds,
      setDancerQuickEditId,
      setFloorTextDraft,
      setFloorMarkupTool,
      showTrashDrop,
      trashDockViewportRef,
      trashDropEdge,
      trashHot,
      updateActiveFormation,
      viewMode,
    ],
  );

  return (
    <StageBoardShell
      main={<StageBoardLayout {...stageBoardLayoutSlots} />}
      overlays={
        <>
          {stageEditDockHost && stageEditDock
            ? createPortal(stageEditDock, stageEditDockHost)
            : null}
          <StageBoardBodyOverlays {...stageBoardOverlaysProps} />
          <ExportToast
            toast={shapePreviewToast}
            onDismiss={dismissShapePreviewToast}
          />
          {sizeApplyPending ? (
            <StageSizeApplyScopeDialog
              kind={sizeApplyPending.kind}
              onChoose={commitSizeApplyPending}
              onCancel={cancelSizeApplyPending}
            />
          ) : null}
        </>
      }
    />
  );
}

StageBoardBody.displayName = "StageBoard";
