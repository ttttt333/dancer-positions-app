import type {
  CSSProperties,
  Dispatch,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  SetStateAction,
} from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  SetPiece,
  StageFloorMarkup,
} from "../types/choreography";
import {
  audienceRotationDeg,
  clampStageGridAxisMm,
  DEFAULT_DANCER_MARKER_DIAMETER_PX,
  MARKER_DIAMETER_PX_MAX as MARKER_PX_MAX,
  MARKER_DIAMETER_PX_MIN as MARKER_PX_MIN,
} from "../lib/projectDefaults";
import {
  formatMeterCmLabel,
  formatStageMmSummary,
  mmToMeterCm,
  STAGE_MAIN_FLOOR_MM_MAX,
  STAGE_MAIN_FLOOR_MM_MIN,
} from "../lib/stageDimensions";
import {
  dancerConventionGuideDotsPct,
  isDancerSpacingActive,
  snapXPctToConvention,
} from "../lib/dancerSpacing";
import {
  lineUpByGradeAsc,
  lineUpByGradeDesc,
  lineUpByHeightAsc,
  lineUpByHeightDesc,
  lineUpBySkillLargeToBack,
  lineUpBySkillSmallToBack,
  permuteSlotsByGradeAsc,
  permuteSlotsByGradeDesc,
  permuteSlotsByHeightAsc,
  permuteSlotsByHeightDesc,
  permuteSlotsBySkillAsc,
  permuteSlotsBySkillDesc,
  resolveArrangeTargetIds,
  rotateDancerRingOneStep,
} from "../lib/stageSelectionArrange";
import {
  DancerQuickEditDialog,
  type DancerQuickEditApply,
} from "./DancerQuickEditDialog";
import { btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
  normalizeDancerFacingDeg,
} from "../lib/dancerColorPalette";

/** ドラッグ中、この y% 以上で下端ゴミ箱 UI を出す（客席＝下が大きい y） */
const TRASH_REVEAL_Y_PCT = 88;
/** 床テキスト: これ未満の移動は「タップして編集」、超えたらドラッグ移動 */
const FLOOR_TEXT_TAP_DRAG_THRESHOLD_PX = 6;

/** ヘッダ「テキスト」から床へ置く前のプレビュー（親が状態を持つ） */
export type FloorTextPlaceSession = {
  body: string;
  fontSizePx: number;
  fontWeight: number;
  xPct: number;
  yPct: number;
};

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  playbackDancers: DancerSpot[] | null;
  /**
   * 一時停止時など、再生補間より優先して見せるフォーメーション（ページめくり閲覧用）。
   * 再生中は親が null にする想定。
   */
  browseFormationDancers?: DancerSpot[] | null;
  /** キュー追加ウィザード等のプレビュー（最優先で表示・ドラッグ不可） */
  previewDancers?: DancerSpot[] | null;
  /**
   * 再生補間表示中はダンサーがクリック不可のため、ステージ（客席帯以外）をクリックしたときに
   * 親で「選択中フォーメーションのドラッグ調整」へ切り替える。
   */
  onRequestLayoutEditFromStage?: () => void;
  /** 立ち位置の書き込み先。未指定なら project.activeFormationId */
  editFormationId?: string | null;
  /** false のときダンサー操作不可（キュー未選択など） */
  stageInteractionsEnabled?: boolean;
  /** 再生中の補間済み大道具（親が計算） */
  playbackSetPieces?: SetPiece[] | null;
  /** 一時停止時の大道具（親が計算） */
  browseSetPieces?: SetPiece[] | null;
  /** 再生中の床マーク（親が計算） */
  playbackFloorMarkup?: StageFloorMarkup[] | null;
  /** 閲覧時の床マーク（親が計算） */
  browseFloorMarkup?: StageFloorMarkup[] | null;
  /** 再生中にステージ床（ダンサー以外）を押したら停止（§5） */
  isPlaying?: boolean;
  onStopPlaybackRequest?: () => void;
  /** 床テキストを置くウィザード中（プレビュー座標・本文は親が保持） */
  floorTextPlaceSession?: FloorTextPlaceSession | null;
  onFloorTextPlaceSessionChange?: (next: FloorTextPlaceSession) => void;
  /** 親と共有する床マークアップツール（未指定なら内部 state） */
  floorMarkupTool?: null | "text" | "line" | "erase";
  onFloorMarkupToolChange?: Dispatch<
    SetStateAction<null | "text" | "line" | "erase">
  >;
  /** true のときステージ左上のテキスト／線トグル帯を出さず、編集 UI のみ出す */
  hideFloorMarkupFloatingToolbars?: boolean;
  /** 立ち位置ドラッグ中は履歴に積まず、離したとき 1 手にまとめる（親の undo 用） */
  onGestureHistoryBegin?: () => void;
  onGestureHistoryEnd?: () => void;
  /** フォーメーション切替などドラッグ中断時に深度だけリセット */
  onGestureHistoryCancel?: () => void;
  /** ゴミ箱ドロップ直後の 1 回だけ、次の setProject で undo に積まない */
  markHistorySkipNextPush?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function resolveSetPieceFill(p: SetPiece): string {
  const c = p.fillColor?.trim();
  if (c && /^#[0-9a-fA-F]{6}$/i.test(c)) return c.toLowerCase();
  return "#475569";
}

function setPieceKindJa(kind: SetPiece["kind"]): string {
  if (kind === "ellipse") return "円・楕円";
  if (kind === "triangle") return "三角";
  return "矩形";
}

/** §10 大道具矩形のリサイズ（ハンドル別） */
type SetPieceResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
/** 複数選択されたダンサー群を囲む枠のリサイズハンドル */
type GroupBoxHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_SET_PIECE_W_PCT = 2.5;
const MIN_SET_PIECE_H_PCT = 2.5;

/** ○内ラベル用フォント（px）。印が大きいほど比例して大きく */
function markerCircleLabelFontPx(markerPx: number): number {
  return Math.max(
    11,
    Math.min(26, Math.round(16 * (markerPx / DEFAULT_DANCER_MARKER_DIAMETER_PX)))
  );
}

/** ○の下に出す名前用（○内よりやや小さめ） */
function markerBelowLabelFontPx(circleLabelPx: number): number {
  return Math.max(11, Math.min(19, circleLabelPx - 1));
}

/** ○下端と名前のあいだを、舞台横幅に対してこの mm ぶん広げる */
const DANCER_NAME_BELOW_EXTRA_GAP_MM = 3;

function dancerNameBelowClearanceExtraPx(
  stageWidthMm: number | null | undefined,
  mainFloorPxWidth: number
): number {
  if (
    typeof stageWidthMm === "number" &&
    stageWidthMm > 0 &&
    mainFloorPxWidth > 0
  ) {
    return Math.max(
      1,
      Math.round((DANCER_NAME_BELOW_EXTRA_GAP_MM * mainFloorPxWidth) / stageWidthMm)
    );
  }
  /** ステージ幅未設定時は CSS 96dpi 相当で約 3mm の px */
  return Math.max(8, Math.round((DANCER_NAME_BELOW_EXTRA_GAP_MM * 96) / 25.4));
}

/**
 * 「名前は○の下」モードの○内表示。
 * `markerBadge === ""` は意図的な空欄（並び順による連番フォールバックなし）。
 */
function dancerCircleInnerBelowLabel(d: DancerSpot, formationIndex: number): string {
  if (d.markerBadge === "") return "";
  const t = d.markerBadge?.trim();
  if (t) return t.slice(0, 3);
  return String(formationIndex + 1);
}

const GROUP_BOX_HANDLES: readonly {
  h: GroupBoxHandle;
  cursor: string;
  pos: CSSProperties;
}[] = [
  { h: "nw", cursor: "nwse-resize", pos: { left: 0, top: 0, transform: "translate(-50%, -50%)" } },
  { h: "n", cursor: "ns-resize", pos: { left: "50%", top: 0, transform: "translate(-50%, -50%)" } },
  { h: "ne", cursor: "nesw-resize", pos: { right: 0, top: 0, transform: "translate(50%, -50%)" } },
  { h: "e", cursor: "ew-resize", pos: { right: 0, top: "50%", transform: "translate(50%, -50%)" } },
  { h: "se", cursor: "nwse-resize", pos: { right: 0, bottom: 0, transform: "translate(50%, 50%)" } },
  { h: "s", cursor: "ns-resize", pos: { left: "50%", bottom: 0, transform: "translate(-50%, 50%)" } },
  { h: "sw", cursor: "nesw-resize", pos: { left: 0, bottom: 0, transform: "translate(-50%, 50%)" } },
  { h: "w", cursor: "ew-resize", pos: { left: 0, top: "50%", transform: "translate(-50%, -50%)" } },
];

/** 回転ハンドル内の白い矢印アイコン（参照アプリの円形リフレッシュに近い形） */
function RotateHandleGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M12 4.5v3m0 9v3M4.5 12H2m20 0h-2.5"
        stroke="#ffffff"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M7 7.5c1.6-1.85 3.95-3 6.5-3a8 8 0 0 1 8 8"
        stroke="#ffffff"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M17 16.5c-1.6 1.85-3.95 3-6.5 3a8 8 0 0 1-8-8"
        stroke="#ffffff"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 群リサイズのハンドルからスケール係数と不動点（アンカー）を求める。
 * アンカーは常に選択ボックスの中心。ドラッグした辺／角が動く分だけ
 * センターからの距離比で拡大縮小する（センター基準の間隔調整に向く）。
 */
function groupScaleForHandle(
  handle: GroupBoxHandle,
  startBox: { x0: number; y0: number; x1: number; y1: number },
  newX: number,
  newY: number,
  keepAspect: boolean
): { sx: number; sy: number; ax: number; ay: number } {
  const cx = (startBox.x0 + startBox.x1) / 2;
  const cy = (startBox.y0 + startBox.y1) / 2;

  let sx = 1;
  let sy = 1;
  const touchesN = handle.includes("n");
  const touchesS = handle.includes("s");
  const touchesW = handle.includes("w");
  const touchesE = handle.includes("e");

  const isCorner =
    handle === "ne" ||
    handle === "nw" ||
    handle === "se" ||
    handle === "sw";

  /** 中心から当該辺までの距離（0 除算回避） */
  const eastDen = Math.max(0.001, startBox.x1 - cx);
  const westDen = Math.max(0.001, cx - startBox.x0);
  const southDen = Math.max(0.001, startBox.y1 - cy);
  const northDen = Math.max(0.001, cy - startBox.y0);

  if (touchesE) {
    sx = Math.max(0.05, (newX - cx) / eastDen);
  } else if (touchesW) {
    sx = Math.max(0.05, (cx - newX) / westDen);
  }
  if (touchesS) {
    sy = Math.max(0.05, (newY - cy) / southDen);
  } else if (touchesN) {
    sy = Math.max(0.05, (cy - newY) / northDen);
  }

  if (!touchesE && !touchesW) sx = keepAspect ? sy : 1;
  if (!touchesN && !touchesS) sy = keepAspect ? sx : 1;
  if (keepAspect && isCorner) {
    const s = Math.max(sx, sy);
    sx = s;
    sy = s;
  }
  return { sx, sy, ax: cx, ay: cy };
}

function applySetPieceResizePct(
  handle: SetPieceResizeHandle,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  dxPct: number,
  dyPct: number
): { xPct: number; yPct: number; wPct: number; hPct: number } {
  let nx = xPct;
  let ny = yPct;
  let nw = wPct;
  let nh = hPct;
  if (handle.includes("n")) {
    const nya = clamp(ny + dyPct, 0, ny + nh - MIN_SET_PIECE_H_PCT);
    nh = ny + nh - nya;
    ny = nya;
  }
  if (handle.includes("s")) {
    nh = clamp(nh + dyPct, MIN_SET_PIECE_H_PCT, 100 - ny);
  }
  if (handle.includes("w")) {
    const nxa = clamp(nx + dxPct, 0, nx + nw - MIN_SET_PIECE_W_PCT);
    nw = nx + nw - nxa;
    nx = nxa;
  }
  if (handle.includes("e")) {
    nw = clamp(nw + dxPct, MIN_SET_PIECE_W_PCT, 100 - nx);
  }
  return { xPct: nx, yPct: ny, wPct: nw, hPct: nh };
}

type SnapMode = "free" | "grid" | "fine";

export function StageBoard({
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
  isPlaying = false,
  onStopPlaybackRequest,
  floorTextPlaceSession = null,
  onFloorTextPlaceSessionChange,
  floorMarkupTool: floorMarkupToolProp,
  onFloorMarkupToolChange,
  hideFloorMarkupFloatingToolbars = false,
  onGestureHistoryBegin,
  onGestureHistoryEnd,
  onGestureHistoryCancel,
  markHistorySkipNextPush,
}: Props) {
  const {
    formations,
    activeFormationId,
    snapGrid,
    gridStep: rawGridStep,
    gridSpacingMm,
    audienceEdge,
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
    centerFieldGuideIntervalMm,
    dancerSpacingMm,
    viewMode,
    dancerMarkerDiameterPx,
    dancerMarkerDiameterMm,
    dancerLabelPosition: rawDancerLabelPosition,
    hanamichiEnabled: hanamichiEnabledRaw,
    hanamichiDepthPct: hanamichiDepthRaw,
  } = project;
  /**
   * 立ち位置の名前を○の中に出すか、○の下に出すか。
   * 既定は "inside"（従来動作）。プロジェクト未指定でも安全に動く。
   */
  const dancerLabelBelow = rawDancerLabelPosition === "below";
  /**
   * 場ミリ連動のグリッド間隔。
   * `gridSpacingMm` がセットされ `stageWidthMm` もあれば、mm ベースで実効％を計算。
   * 無ければ保存済みの %（rawGridStep）をそのまま使う。
   */
  const gridStep = useMemo(() => {
    if (
      typeof gridSpacingMm === "number" &&
      gridSpacingMm > 0 &&
      typeof stageWidthMm === "number" &&
      stageWidthMm > 0
    ) {
      const pct = (gridSpacingMm / stageWidthMm) * 100;
      return Math.max(0.05, Math.min(50, pct));
    }
    return rawGridStep;
  }, [gridSpacingMm, stageWidthMm, rawGridStep]);
  const hanamichiEnabled = hanamichiEnabledRaw ?? false;
  const hanamichiDepthPct = Math.min(36, Math.max(8, hanamichiDepthRaw ?? 14));
  /**
   * 変形舞台（カスタム舞台形状）。設定されているときは舞台外を暗く表示し、
   * 旧来の花道帯は隠す。
   */
  const stageShape = project.stageShape;
  const stageShapeActive = stageShape != null && stageShape.presetId !== "rectangle";
  const stageShapeSvgPoints = useMemo(
    () =>
      stageShapeActive
        ? stageShape!.polygonPct
            .map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)
            .join(" ")
        : "",
    [stageShapeActive, stageShape]
  );
  /**
   * 舞台外の暗幕: 外枠 (0,0 100,100) を時計回り、内側の多角形を（そのまま）
   * 続けて描画して evenodd でくり抜く。くり抜かれた内側は何も塗られず、
   * 外側だけ半透明の暗色で塗りつぶされるため舞台外が自然に暗く見える。
   */
  const stageShapeMaskPath = useMemo(() => {
    if (!stageShapeActive || !stageShape) return "";
    const outer = "M 0 0 L 100 0 L 100 100 L 0 100 Z";
    const pts = stageShape.polygonPct;
    if (pts.length < 3) return "";
    const inner = pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(3)} ${y.toFixed(3)}`)
      .join(" ");
    return `${outer} ${inner} Z`;
  }, [stageShapeActive, stageShape]);

  /** メイン床（%座標・PNG のダンサー領域）。サイド/バック分割時は中央セルのみ */
  const stageMainFloorRef = useRef<HTMLDivElement>(null);
  /**
   * メイン床の実際の描画幅（px）。ResizeObserver で追跡し、
   * 実寸指定の印サイズ計算に使う。舞台が回転しているときも正しく取得できる。
   */
  const [mainFloorPxWidth, setMainFloorPxWidth] = useState<number>(0);
  useEffect(() => {
    const el = stageMainFloorRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setMainFloorPxWidth(Math.max(0, Math.round(r.width)));
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  /**
   * ダンサー印の基準ピクセル径。
   *
   * 優先順位:
   * 1. `dancerMarkerDiameterMm` が明示されていればそれを実寸から px に換算。
   * 2. そうでなくステージ幅（`stageWidthMm`）があれば、ステージ幅の一定割合
   *    （≒ 4%）を自動の実寸として扱い、ステージサイズに連動して○を伸縮させる。
   *    px の既定値（`DEFAULT_DANCER_MARKER_DIAMETER_PX`）のままならユーザーが
   *    動かしていないと見なし自動連動を優先する。動かしている（＝明示指定）なら
   *    スライダーの px を尊重する。
   * 3. 上記いずれも当てはまらなければ保存済みの px をそのまま使う。
   */
  const baseMarkerPx = useMemo(() => {
    if (
      typeof dancerMarkerDiameterMm === "number" &&
      dancerMarkerDiameterMm > 0 &&
      typeof stageWidthMm === "number" &&
      stageWidthMm > 0 &&
      mainFloorPxWidth > 0
    ) {
      const px = Math.round(
        (dancerMarkerDiameterMm * mainFloorPxWidth) / stageWidthMm
      );
      return Math.max(MARKER_PX_MIN, Math.min(MARKER_PX_MAX, px));
    }
    const pxRaw = Math.round(dancerMarkerDiameterPx ?? DEFAULT_DANCER_MARKER_DIAMETER_PX);
    /**
     * 既定 px のままならユーザーは px を明示していないと見なし、
     * ステージ幅に連動する自動サイズを採用する（写真のような按配になる目安）。
     */
    const isDefaultPx = pxRaw === DEFAULT_DANCER_MARKER_DIAMETER_PX;
    if (
      isDefaultPx &&
      typeof stageWidthMm === "number" &&
      stageWidthMm > 0 &&
      mainFloorPxWidth > 0
    ) {
      /** ステージ幅の約 5.5%。min 32cm / max 130cm で常識的な範囲にクランプ。 */
      const implicitMm = Math.max(320, Math.min(1300, stageWidthMm * 0.055));
      const px = Math.round((implicitMm * mainFloorPxWidth) / stageWidthMm);
      return Math.max(MARKER_PX_MIN, Math.min(MARKER_PX_MAX, px));
    }
    return Math.max(MARKER_PX_MIN, Math.min(MARKER_PX_MAX, pxRaw));
  }, [
    dancerMarkerDiameterMm,
    stageWidthMm,
    mainFloorPxWidth,
    dancerMarkerDiameterPx,
  ]);
  const nameBelowClearanceExtraPx = useMemo(
    () => dancerNameBelowClearanceExtraPx(stageWidthMm, mainFloorPxWidth),
    [stageWidthMm, mainFloorPxWidth]
  );
  /** サイズドラッグ中は draft 値を即時反映して手応えを出す（ドラッグ終了時に確定） */
  const trashDockRef = useRef<HTMLDivElement>(null);
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
  /** 床にコメント／線を追加するときのツール（Esc で解除）。親指定時は制御モード */
  const [floorMarkupToolUncontrolled, setFloorMarkupToolUncontrolled] = useState<
    null | "text" | "line" | "erase"
  >(null);
  const markupControlled = typeof onFloorMarkupToolChange === "function";
  const floorMarkupTool = markupControlled
    ? (floorMarkupToolProp as null | "text" | "line" | "erase")
    : floorMarkupToolUncontrolled;
  const setFloorMarkupTool = markupControlled
    ? onFloorMarkupToolChange!
    : setFloorMarkupToolUncontrolled;
  /** 線ツール：ドラッグ中の頂点列プレビュー */
  const [floorLineDraft, setFloorLineDraft] = useState<[number, number][] | null>(
    null
  );
  const floorLineSessionRef = useRef<{
    points: [number, number][];
    lastClientX: number;
    lastClientY: number;
  } | null>(null);
  /** 設置済み床テキストのドラッグ移動 */
  const floorMarkupTextDragRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
  } | null>(null);
  /**
   * ツール未選択時: テキスト上でポインタダウンした直後はここに保持し、
   * 微小移動ならタップ（編集モードへ）、それ以上ならドラッグ移動に切り替える。
   */
  const floorTextTapOrDragRef = useRef<{
    id: string;
    text: string;
    fontSizePx: number;
    fontWeight: number;
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    pointerId: number;
  } | null>(null);
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
    body: "",
    fontSizePx: 18,
    fontWeight: 600,
  });
  /** 選択中の床テキスト id（スライダー・本文はこの項目を更新、空床クリックで移動） */
  const [floorTextEditId, setFloorTextEditId] = useState<string | null>(null);
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
  /** ステージ枠ドラッグ中のライブプレビュー値（コミット前の W/D）。 */
  const [stageResizeDraft, setStageResizeDraft] = useState<
    | { stageWidthMm: number; stageDepthMm: number }
    | null
  >(null);
  /**
   * 幅・奥行（mm）がそろっているとき、縦線＝幅方向・横線＝奥行方向の実寸間隔から
   * スナップ刻み（幅・奥行 mm ごとの %）を算出。ドラフト中の寸法も反映。
   */
  const mmSnapGrid = useMemo(() => {
    const W = (stageResizeDraft?.stageWidthMm ?? stageWidthMm) ?? null;
    const D = (stageResizeDraft?.stageDepthMm ?? stageDepthMm) ?? null;
    if (W == null || D == null || W <= 0 || D <= 0) return null;
    const legacy =
      typeof project.stageGridLineSpacingMm === "number" &&
      Number.isFinite(project.stageGridLineSpacingMm)
        ? project.stageGridLineSpacingMm
        : 10;
    const spacingW = clampStageGridAxisMm(project.stageGridSpacingWidthMm, legacy);
    const spacingD = clampStageGridAxisMm(project.stageGridSpacingDepthMm, legacy);
    return {
      stepXPct: (spacingW / W) * 100,
      stepYPct: (spacingD / D) * 100,
      spacingWidthMm: spacingW,
      spacingDepthMm: spacingD,
    };
  }, [
    stageResizeDraft?.stageWidthMm,
    stageResizeDraft?.stageDepthMm,
    stageWidthMm,
    stageDepthMm,
    project.stageGridLineSpacingMm,
    project.stageGridSpacingWidthMm,
    project.stageGridSpacingDepthMm,
  ]);
  /** 現在カーソルが乗っているステージリサイズハンドル。ホバー時だけ少し大きくする。 */
  const [hoveredStageHandle, setHoveredStageHandle] = useState<string | null>(
    null
  );

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

  /** 回転ドラフト中はドラフト、それ以外は `facingDeg`（未設定は 0）。 */
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
  /** マルを下端付近まで下げたときだけゴミ箱 UI を出す */
  const [trashUiVisible, setTrashUiVisible] = useState(false);
  const trashRevealActiveRef = useRef(false);
  /**
   * ドラッグ開始時点の座標を薄く重ね表示（ポインタアップで消える）。
   */
  const [dragGhostById, setDragGhostById] = useState<
    Map<string, { xPct: number; yPct: number }> | null
  >(null);
  /** ステージ上の右クリックメニュー（ダンサー / 大道具） */
  const [stageContextMenu, setStageContextMenu] = useState<
    | { kind: "dancer"; clientX: number; clientY: number; dancerId: string }
    | { kind: "setPiece"; clientX: number; clientY: number; pieceId: string }
    | { kind: "floorText"; clientX: number; clientY: number; markupId: string }
    | null
  >(null);
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
    setMarkerDiamDraft(null);
    setMarkerFacingDraft(null);
    setMarkerGroupPosDraft(null);
    setDragGhostById(null);
    setFloorMarkupTool(null);
    floorLineSessionRef.current = null;
    setFloorLineDraft(null);
    setFloorTextDraft({ body: "", fontSizePx: 18, fontWeight: 600 });
    setFloorTextEditId(null);
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

  const playbackOrPreview = Boolean(playbackDancers || previewDancers);

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
    if (floorMarkupTool !== "text") setFloorTextEditId(null);
  }, [floorMarkupTool]);

  /** ヘッダからの床テキスト配置中はステージ内の旧テキストツールと競合しないよう解除 */
  useEffect(() => {
    if (!floorTextPlaceSession) return;
    setFloorMarkupTool(null);
    setFloorTextEditId(null);
    floorTextTapOrDragRef.current = null;
  }, [floorTextPlaceSession]);

  /** 床テキストが削除されたあと、編集中 id が残らないようにする */
  useEffect(() => {
    if (!floorTextEditId || !writeFormation) return;
    const fm = writeFormation.floorMarkup ?? [];
    if (!fm.some((x) => x.id === floorTextEditId && x.kind === "text")) {
      setFloorTextEditId(null);
      setFloorTextDraft({ body: "", fontSizePx: 18, fontWeight: 600 });
    }
  }, [writeFormation, floorTextEditId]);

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
      updateActiveFormation((f) => ({
        ...f,
        dancers: f.dancers.filter((x) => x.id !== dancerId),
      }));
      setSelectedDancerIds((ids) => ids.filter((id) => id !== dancerId));
      setDancerQuickEditId((id) => (id === dancerId ? null : id));
      setStageContextMenu(null);
    },
    [writeFormation, updateActiveFormation, viewMode, stageInteractionsEnabled]
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
          xPct: round2(clamp(d.xPct + 2.5, 2, 98)),
          yPct: round2(clamp(d.yPct + 2.5, 2, 98)),
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
      setStageResizeDraft((prev) =>
        prev &&
        prev.stageWidthMm === newW &&
        prev.stageDepthMm === newD
          ? prev
          : { stageWidthMm: newW, stageDepthMm: newD }
      );
    };
    const onUp = () => {
      const s = stageResizeRef.current;
      if (!s) return;
      stageResizeRef.current = null;
      setStageResizeDraft((d) => {
        if (d) {
          const nextW = d.stageWidthMm;
          const nextD = d.stageDepthMm;
          setProject((p) => {
            if (p.stageWidthMm === nextW && p.stageDepthMm === nextD) return p;
            return { ...p, stageWidthMm: nextW, stageDepthMm: nextD };
          });
        }
        return null;
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
      updateActiveFormation((f) => ({
        ...f,
        dancers: f.dancers.filter((x) => !removeSet.has(x.id)),
      }));
      setSelectedDancerIds((ids) => ids.filter((id) => !removeSet.has(id)));
      setDancerQuickEditId((id) => (id != null && removeSet.has(id) ? null : id));
      setStageContextMenu(null);
    },
    [writeFormation, updateActiveFormation, viewMode, stageInteractionsEnabled]
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

  const handlePointerDownSetPiece = (
    e: ReactPointerEvent,
    piece: SetPiece
  ) => {
    if (e.button !== 0) return;
    if (!setPiecesEditable) return;
    setSelectedSetPieceId(piece.id);
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const el = stageMainFloorRef.current;
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
  };

  const handlePointerDownSetPieceResize = (
    e: ReactPointerEvent,
    piece: SetPiece,
    handle: SetPieceResizeHandle
  ) => {
    if (e.button !== 0) return;
    if (!setPiecesEditable) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedSetPieceId(piece.id);
    const el = stageMainFloorRef.current;
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
  };

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
    const dock = trashDockRef.current;
    if (dock) {
      const r = dock.getBoundingClientRect();
      return (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      );
    }
    const floor = stageMainFloorRef.current;
    if (!floor) return false;
    const r = floor.getBoundingClientRect();
    const boxW = Math.min(118, Math.max(92, r.width * 0.34));
    const boxH = 76;
    const left = r.left + (r.width - boxW) / 2;
    const top = r.bottom - boxH - 10;
    return (
      clientX >= left &&
      clientX <= left + boxW &&
      clientY >= top &&
      clientY <= r.bottom - 4
    );
  }, []);

  const quantizeCoord = useCallback(
    (v: number, axis: "x" | "y", mode: SnapMode) => {
      const c = clamp(v, 2, 98);
      if (mode === "free" || !snapGrid) return round2(c);
      if (mmSnapGrid) {
        const base =
          axis === "x" ? mmSnapGrid.stepXPct : mmSnapGrid.stepYPct;
        const useStep =
          mode === "fine" ? Math.max(0.05, base / 4) : base;
        return round2(clamp(Math.round(c / useStep) * useStep, 2, 98));
      }
      const step =
        mode === "fine" ? Math.max(0.25, gridStep / 4) : gridStep;
      return round2(clamp(Math.round(c / step) * step, 2, 98));
    },
    [snapGrid, gridStep, mmSnapGrid]
  );

  const pxToPct = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      const el = stageMainFloorRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const xPct = ((clientX - r.left) / r.width) * 100;
      const yPct = ((clientY - r.top) / r.height) * 100;
      const mode: SnapMode = snapGrid ? (shiftKey ? "fine" : "grid") : "free";
      let snappedX = quantizeCoord(xPct, "x", mode);
      const snappedY = quantizeCoord(yPct, "y", mode);
      /**
       * 場ミリ規格が有効なときは「割センター / センター乗せ」のスロットに
       * x を吸い付かせる（流派の 75 cm / 225 cm / 375 cm... 並びを再現）。
       * 微調整したい時は Shift で抑止できる（fine モード）。
       */
      if (mode !== "fine" && isDancerSpacingActive(dancerSpacingMm, stageWidthMm)) {
        const conv = snapXPctToConvention(snappedX, dancerSpacingMm, stageWidthMm);
        if (conv != null) snappedX = round2(conv);
      }
      return { xPct: snappedX, yPct: snappedY };
    },
    [snapGrid, quantizeCoord, dancerSpacingMm, stageWidthMm, mmSnapGrid]
  );

  /**
   * ドラッグ中の立ち位置を、他のダンサーや中央線に揃えて「ピタッ」と吸着させる。
   * 表示用のガイド線（揃った x / y の値）も合わせて返す。
   *
   * @param xPct         現在の x（％）
   * @param yPct         現在の y（％）
   * @param excludeIds   スナップ対象から除外するダンサー ID（自分 or 群ドラッグ中の選択者）
   * @param strong       Shift 等で一時的にスナップを無効化したい場合は false
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
      /** 吸着する距離しきい値（％）。ステージの 1% 程度 */
      const THRESHOLD = 0.9;
      const dancers =
        writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      /** 候補 x: 中央（50）＋他ダンサーの x */
      const xCandidates: number[] = [50];
      const yCandidates: number[] = [50];
      for (const d of dancers) {
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
    [writeFormation, activeFormation]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = setPieceDragRef.current;
      if (!d) return;
      if (d.mode === "move") {
        const next = pxToPct(
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
  }, [pxToPct, snapGrid, gridStep, updateActiveFormation, mmSnapGrid]);

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
    /** ダンサー／大道具／ハンドル／ゴミ箱以外の床面のときだけ反応 */
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
      onFloorTextPlaceSessionChange({
        ...floorTextPlaceSession,
        xPct: round2(xPct),
        yPct: round2(yPct),
      });
      return;
    }

    if (setPiecesEditable && writeFormation && floorMarkupTool === "text") {
      if (target.closest("[data-floor-markup]")) return;
      e.preventDefault();
      e.stopPropagation();
      const fs = Math.round(clamp(floorTextDraft.fontSizePx, 8, 56));
      const fw = Math.round(clamp(floorTextDraft.fontWeight, 300, 900) / 50) * 50;
      if (floorTextEditId) {
        updateActiveFormation((f) => ({
          ...f,
          floorMarkup: (f.floorMarkup ?? []).map((m) =>
            m.id === floorTextEditId && m.kind === "text"
              ? { ...m, xPct: round2(xPct), yPct: round2(yPct), fontSizePx: fs, fontWeight: fw }
              : m
          ),
        }));
        return;
      }
      const t = floorTextDraft.body.trim();
      if (!t) return;
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: [
          ...(f.floorMarkup ?? []),
          {
            kind: "text",
            id: crypto.randomUUID(),
            xPct: round2(xPct),
            yPct: round2(yPct),
            text: t.slice(0, 400),
            color: "#fef08a",
            fontSizePx: fs,
            fontWeight: fw,
          },
        ],
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
    const onMove = (e: PointerEvent) => {
      /** 1: 単一ダンサーのドラッグ（ゴミ箱削除付き） */
      const d = dragRef.current;
      if (d) {
        const next = pxToPct(
          e.clientX - d.offsetXPx,
          e.clientY - d.offsetYPx,
          e.shiftKey
        );
        if (!next) return;
        const reveal = next.yPct >= TRASH_REVEAL_Y_PCT;
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
        updateActiveFormation((f) => ({
          ...f,
          dancers: f.dancers.map((x) =>
            x.id === d.dancerId
              ? { ...x, xPct: snapped.xPct, yPct: snapped.yPct }
              : x
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
          };
          floorTextTapOrDragRef.current = null;
          const floor = stageMainFloorRef.current;
          if (floor) {
            const rr = floor.getBoundingClientRect();
            const dxPct = ((e.clientX - tapOr.startClientX) / rr.width) * 100;
            const dyPct = ((e.clientY - tapOr.startClientY) / rr.height) * 100;
            const nx = round2(clamp(tapOr.startXPct + dxPct, 0, 100));
            const ny = round2(clamp(tapOr.startYPct + dyPct, 0, 100));
            const tid = tapOr.id;
            updateActiveFormation((f) => ({
              ...f,
              floorMarkup: (f.floorMarkup ?? []).map((x) =>
                x.id === tid && x.kind === "text" ? { ...x, xPct: nx, yPct: ny } : x
              ),
            }));
          }
        }
        return;
      }
      /** 1b: 床に置いたテキストの移動（下端でゴミ箱表示・ドロップで削除） */
      const fmd = floorMarkupTextDragRef.current;
      if (fmd) {
        const floor = stageMainFloorRef.current;
        if (!floor) return;
        const rr = floor.getBoundingClientRect();
        const dxPct = ((e.clientX - fmd.startClientX) / rr.width) * 100;
        const dyPct = ((e.clientY - fmd.startClientY) / rr.height) * 100;
        const nx = round2(clamp(fmd.startXPct + dxPct, 0, 100));
        const ny = round2(clamp(fmd.startYPct + dyPct, 0, 100));
        const pointerYPct = ((e.clientY - rr.top) / rr.height) * 100;
        const reveal = ny >= TRASH_REVEAL_Y_PCT || pointerYPct >= TRASH_REVEAL_Y_PCT;
        if (reveal !== trashRevealActiveRef.current) {
          trashRevealActiveRef.current = reveal;
          setTrashUiVisible(reveal);
        }
        const overTrash = hitTrashDropZone(e.clientX, e.clientY);
        setTrashHotIfChanged(overTrash);
        if (overTrash) {
          return;
        }
        updateActiveFormation((f) => ({
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
        const floor = stageMainFloorRef.current;
        if (!floor) return;
        const rr = floor.getBoundingClientRect();
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
        /**
         * 群移動中も「下端付近までドラッグしたらゴミ箱出現」を有効化する。
         * 判定は群内ダンサー（移動後位置）のうち最も客席側（y が大きい）が
         * 閾値を超えたとき、または単体ドラッグと挙動を揃えるためポインタの
         * y が下端付近でも発火させる。
         */
        const floor = stageMainFloorRef.current;
        let pointerYPct = 0;
        if (floor) {
          const rr = floor.getBoundingClientRect();
          pointerYPct = ((e.clientY - rr.top) / rr.height) * 100;
        }
        let maxMovedYPct = 0;
        for (const id of g.ids) {
          const s = g.startPositions.get(id);
          if (!s) continue;
          const ny = clamp(s.yPct + dyPct, 2, 98);
          if (ny > maxMovedYPct) maxMovedYPct = ny;
        }
        const reveal =
          maxMovedYPct >= TRASH_REVEAL_Y_PCT ||
          pointerYPct >= TRASH_REVEAL_Y_PCT;
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
         * 群移動では、選択範囲のアンカー（一人目）を代表として中央線や
         * 他（選択外）ダンサーに吸着させ、群全体を同じデルタだけ動かす。
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
        if (guideX !== alignGuides.x || guideY !== alignGuides.y) {
          setAlignGuides({ x: guideX, y: guideY });
        }
        updateActiveFormation((f) => ({
          ...f,
          dancers: f.dancers.map((x) => {
            if (!idSet.has(x.id)) return x;
            const s = g.startPositions.get(x.id);
            if (!s) return x;
            const nx = clamp(s.xPct + dxPct, 2, 98);
            const ny = clamp(s.yPct + dyPct, 2, 98);
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
        updateActiveFormation((f) => ({
          ...f,
          dancers: f.dancers.map((x) => {
            if (!idSet.has(x.id)) return x;
            const s = g.startPositions.get(x.id);
            if (!s) return x;
            const nx = clamp(ax + (s.xPct - ax) * sx, 2, 98);
            const ny = clamp(ay + (s.yPct - ay) * sy, 2, 98);
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
                const nxPct = clamp(((px1 - r.left) / w) * 100, 2, 98);
                const nyPct = clamp(((py1 - r.top) / h) * 100, 2, 98);
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
        /**
         * ... rest of file (omitted here for brevity in this message) ...
         */
    );
  }
}
