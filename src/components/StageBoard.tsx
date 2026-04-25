import type {
  CSSProperties,
  Dispatch,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  SetStateAction,
} from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  SetPiece,
  StageFloorMarkup,
  StageFloorTextMarkup,
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
  color?: string;
  fontFamily?: string;
  /** 設置後の床テキスト scale（既定 1） */
  scale?: number;
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

type FloorTextCornerHandle = "nw" | "ne" | "sw" | "se";

const FLOOR_TEXT_DEFAULT_COLOR = "#fef08a";
const FLOOR_TEXT_DEFAULT_FONT =
  "system-ui, -apple-system, 'Segoe UI', sans-serif";

const FLOOR_TEXT_FONT_OPTIONS: readonly { id: string; label: string; value: string }[] =
  [
    { id: "sys", label: "システム", value: FLOOR_TEXT_DEFAULT_FONT },
    {
      id: "gothic",
      label: "ゴシック",
      value:
        "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', Meiryo, sans-serif",
    },
    {
      id: "mincho",
      label: "明朝",
      value: "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif",
    },
    {
      id: "mono",
      label: "等幅",
      value: "ui-monospace, SFMono-Regular, Menlo, monospace",
    },
  ];

const EMPTY_FLOOR_TEXT_DRAFT = {
  body: "",
  fontSizePx: 18,
  fontWeight: 600,
  color: FLOOR_TEXT_DEFAULT_COLOR,
  fontFamily: FLOOR_TEXT_DEFAULT_FONT,
};

function floorTextMarkupScale(m: StageFloorTextMarkup): number {
  const s = m.scale;
  if (typeof s === "number" && Number.isFinite(s) && s > 0) {
    return Math.min(8, Math.max(0.2, s));
  }
  return 1;
}

function floorTextFontCss(m: StageFloorTextMarkup): string {
  const t = m.fontFamily?.trim();
  return t && t.length > 0 ? t : FLOOR_TEXT_DEFAULT_FONT;
}

function floorTextColorHex(m: StageFloorTextMarkup): string {
  const c = m.color?.trim();
  if (c && /^#[0-9a-fA-F]{6}$/i.test(c)) return c.toLowerCase();
  return FLOOR_TEXT_DEFAULT_COLOR;
}

function floorTextDraftColorHex(
  color: string | undefined
): string {
  const c = color?.trim();
  if (c && /^#[0-9a-fA-F]{6}$/i.test(c)) return c.toLowerCase();
  return FLOOR_TEXT_DEFAULT_COLOR;
}

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
const DANCER_NAME_BELOW_EXTRA_GAP_MM = 1.5;

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
  /** ステージ幅未設定時は CSS 96dpi 相当で約 1.5mm の px */
  return Math.max(1, Math.round((DANCER_NAME_BELOW_EXTRA_GAP_MM * 96) / 25.4));
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
    color: string;
    fontFamily: string;
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    pointerId: number;
  } | null>(null);
  /** 床テキスト枠の角ドラッグで scale を変える */
  const floorTextResizeDragRef = useRef<{
    id: string;
    anchorX: number;
    anchorY: number;
    startDist: number;
    startScale: number;
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
        const col = floorTextDraftColorHex(floorTextDraft.color);
        const fam =
          (floorTextDraft.fontFamily ?? "").trim() || FLOOR_TEXT_DEFAULT_FONT;
        updateActiveFormation((f) => ({
          ...f,
          floorMarkup: (f.floorMarkup ?? []).map((m) =>
            m.id === floorTextEditId && m.kind === "text"
              ? {
                  ...m,
                  xPct: round2(xPct),
                  yPct: round2(yPct),
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
            color: col,
            fontFamily: fam,
            scale: 1,
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
      /** 1b0: 床テキストの角スケール */
      const fr = floorTextResizeDragRef.current;
      if (fr && e.pointerId === fr.pointerId) {
        const nd = Math.max(
          12,
          Math.hypot(e.clientX - fr.anchorX, e.clientY - fr.anchorY)
        );
        const ratio = clamp(nd / fr.startDist, 0.12, 14);
        const nextScale = clamp(fr.startScale * ratio, 0.2, 8);
        updateActiveFormation((f) => ({
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
      const afterSnap = (nx: number, ny: number) => {
        const mode: SnapMode = snapGrid ? "fine" : "free";
        return {
          xPct: quantizeCoord(nx, "x", mode),
          yPct: quantizeCoord(ny, "y", mode),
        };
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
  ]);

  /** 客席の辺に応じた向きに、さらに 180° 回して「舞台の正面」を反対側から見る */
  const rot = (audienceRotationDeg(audienceEdge) + 180) % 360;

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
   * ドラッグ中はライブプレビュー用の draft を優先。確定するまで project は変えない。
   */
  const effStageWidthMm = stageResizeDraft?.stageWidthMm ?? stageWidthMm;
  const effStageDepthMm = stageResizeDraft?.stageDepthMm ?? stageDepthMm;
  const Wmm = effStageWidthMm != null && effStageWidthMm > 0 ? effStageWidthMm : 0;
  const Dmm = effStageDepthMm != null && effStageDepthMm > 0 ? effStageDepthMm : 0;
  const Smm = sideStageMm != null && sideStageMm > 0 ? sideStageMm : 0;
  const Bmm = backStageMm != null && backStageMm > 0 ? backStageMm : 0;
  const hasStageDims = Wmm > 0 && Dmm > 0;
  const outerWmm = Wmm + 2 * Smm;
  const outerDmm = Dmm + Bmm;
  const stageAspectRatio = hasStageDims ? `${outerWmm} / ${outerDmm}` : "4 / 3";
  const showShell = hasStageDims && (Smm > 0 || Bmm > 0);

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

  /**
   * 場ミリ規格スロット（割センター / センター乗せ）の薄いドット列。
   * 客席帯のすぐ上に横一列で並べ、流派の立ち位置基準を視覚化する。
   */
  const conventionGuideDots = useMemo(
    () => dancerConventionGuideDotsPct(dancerSpacingMm, Wmm > 0 ? Wmm : null),
    [dancerSpacingMm, Wmm]
  );

  const stripShellStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    fontSize: "10px",
    lineHeight: 1.35,
    color: shell.textMuted,
    background: `linear-gradient(135deg, ${shell.surfaceRaised} 0%, ${shell.surface} 45%, ${shell.surfaceRaised} 100%)`,
    border: `1px solid ${shell.border}`,
    minWidth: 0,
    minHeight: 0,
    padding: "4px",
  };

  const mainFloorStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
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
              return {
                ...x,
                label: patch.label.slice(0, 120),
                colorIndex: modDancerColorIndex(patch.colorIndex),
                note: patch.note,
                heightCm: patch.heightCm,
                gradeLabel: patch.gradeLabel,
                genderLabel: patch.genderLabel,
                skillRankLabel: patch.skillRankLabel,
                markerBadge: patch.markerBadge?.trim()
                  ? patch.markerBadge.trim().slice(0, 3)
                  : undefined,
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
                return { ...d, markerBadge: b };
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
      const badge = badgeRaw.trim().slice(0, 3);
      if (!badge) return;
      const idSet = new Set(targetIds);
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) => {
          if (f.id !== formationIdForWrites) return f;
          return {
            ...f,
            dancers: f.dancers.map((d) =>
              idSet.has(d.id) ? { ...d, markerBadge: badge } : d
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
              idSet.has(d.id) ? { ...d, markerBadge: "" } : d
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

  let contextMenuStyle: CSSProperties | null = null;
  if (stageContextMenu) {
    const pad = 8;
    const mw =
      stageContextMenu.kind === "dancer"
        ? 252
        : stageContextMenu.kind === "floorText"
          ? 168
          : 132;
    const mh =
      stageContextMenu.kind === "dancer"
        ? 380
        : stageContextMenu.kind === "floorText"
          ? 88
          : 52;
    const maxL =
      typeof window !== "undefined" ? window.innerWidth - mw - pad : stageContextMenu.clientX;
    const maxT =
      typeof window !== "undefined" ? window.innerHeight - mh - pad : stageContextMenu.clientY;
    contextMenuStyle = {
      position: "fixed",
      left: Math.max(pad, Math.min(stageContextMenu.clientX, maxL)),
      top: Math.max(pad, Math.min(stageContextMenu.clientY, maxT)),
      zIndex: 10000,
      minWidth: `${mw}px`,
      maxHeight:
        stageContextMenu.kind === "dancer" ? "min(72vh, 520px)" : undefined,
      overflowY: stageContextMenu.kind === "dancer" ? "auto" : undefined,
      padding: "5px",
      borderRadius: "8px",
      border: "1px solid #475569",
      background: "#0f172a",
      boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    };
  }

  return (
    <>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minHeight: 0,
        flex: 1,
        width: "100%",
      }}
    >
      {previewDancers && previewDancers.length > 0 && (
        <div
          style={{
            fontSize: "11px",
            color: "#64748b",
            textAlign: "center",
            letterSpacing: "0.05em",
          }}
        >
          <div
            style={{
              color: "#c4b5fd",
              fontWeight: 600,
            }}
          >
            フォーメーション案プレビュー
          </div>
        </div>
      )}
      {effStageWidthMm != null && effStageDepthMm != null && (
        <div
          style={{
            fontSize: "9px",
            color: stageResizeDraft ? "#fbbf24" : "#94a3b8",
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          {formatStageMmSummary(effStageWidthMm, effStageDepthMm)}
          {(Smm > 0 || Bmm > 0 || (centerFieldGuideIntervalMm != null && centerFieldGuideIntervalMm > 0)) && (
            <div style={{ marginTop: "2px", fontSize: "8px", color: "#64748b" }}>
              {Smm > 0 && <>サイド各 {formatMeterCmLabel(Smm)} · </>}
              {Bmm > 0 && <>バック {formatMeterCmLabel(Bmm)} · </>}
              {centerFieldGuideIntervalMm != null && centerFieldGuideIntervalMm > 0 && (() => {
                const u = mmToMeterCm(centerFieldGuideIntervalMm);
                return (
                  <>
                    センターからの場ミリ {u.m} m {u.cm} cm（{centerFieldGuideIntervalMm} mm）
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: "4px",
          /**
           * ステージ枠のリサイズハンドル（左右・上下）が枠より外に
           * わずかに飛び出して配置されるため、padding で隠れないよう
           * 少しだけ外側に余白を確保する。
           */
          padding: "5px",
          overflow: "hidden",
        }}
      >
        {/*
          コンテナクエリは「舞台ブロック」だけにかける。
          下の一括ツールバーを同じ CQ 親に置くと、選択の有無で cqb が変わり
          範囲選択直後に舞台がわずらかに動いて見える。
        */}
        <div
          style={{
            flex: "1 1 0%",
            minHeight: 0,
            minWidth: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            containerType: "size",
            containerName: "stage-board-fit",
          }}
        >
        <div
          style={{
            position: "relative",
            width: hasStageDims
              ? `min(100cqi, calc(100cqb * (${outerWmm}) / (${outerDmm})))`
              : "min(100cqi, calc(100cqb * 4 / 3))",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: stageAspectRatio,
            transform: `rotate(${rot}deg)`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease",
          }}
        >
          <div
            id="stage-export-root"
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              borderRadius: "16px",
              border: `1.5px solid ${shell.ruby}`,
              overflow: "hidden",
              touchAction: "none",
              boxShadow: previewDancers?.length
                ? "0 0 0 2px rgba(167,139,250,0.65), 0 12px 40px rgba(0,0,0,0.35)"
                : undefined,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              aria-live="polite"
              aria-label={`ステージ上 ${displayDancers.length} 人`}
              title="いまステージに表示している人数"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 35,
                pointerEvents: "none",
                transform: `rotate(${-rot}deg)`,
                transformOrigin: "top right",
                padding: "4px 9px",
                borderRadius: "8px",
                border: "1px solid rgba(51, 65, 85, 0.95)",
                background: "rgba(15, 23, 42, 0.88)",
                color: "#e2e8f0",
                fontSize: "12px",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.2,
                boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
              }}
            >
              {displayDancers.length}人
            </div>
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                position: "relative",
                overflow: "hidden",
                display: showShell ? "grid" : "block",
                ...(showShell
                  ? {
                      gridTemplateRows: Bmm > 0 ? `${Bmm}fr ${Dmm}fr` : `${Dmm}fr`,
                      gridTemplateColumns: Smm > 0 ? `${Smm}fr ${Wmm}fr ${Smm}fr` : `${Wmm}fr`,
                      background: shell.bgDeep,
                    }
                  : {
                      background:
                        "linear-gradient(180deg, #1e293b 0%, #0f172a 55%, #020617 100%)",
                    }),
              }}
            >
            {showShell && Bmm > 0 && (
              <div
                style={{
                  ...stripShellStyle,
                  gridColumn: "1 / -1",
                  gridRow: 1,
                  borderBottom: `1px solid ${shell.border}`,
                }}
              >
                舞台裏
                <br />
                {formatMeterCmLabel(Bmm)}
              </div>
            )}
            {showShell && Smm > 0 && (
              <div
                style={{
                  ...stripShellStyle,
                  gridColumn: 1,
                  gridRow: Bmm > 0 ? 2 : 1,
                  borderRight: `1px solid ${shell.border}`,
                }}
              >
                サイド
                <br />
                {formatMeterCmLabel(Smm)}
              </div>
            )}
            <div
              ref={stageMainFloorRef}
              onPointerDownCapture={(e) => {
                if (!isPlaying || !onStopPlaybackRequest || e.button !== 0) return;
                const el = e.target as HTMLElement;
                if (el.closest("button")) return;
                e.preventDefault();
                onStopPlaybackRequest();
              }}
              onPointerDown={handlePointerDownFloor}
              style={{
                ...mainFloorStyle,
                background: showShell
                  ? (mainFloorStyle.background as string)
                  : "transparent",
                ...(showShell
                  ? {
                      gridColumn: Smm > 0 ? 2 : 1,
                      gridRow: Bmm > 0 ? 2 : 1,
                      ...(Smm === 0 && Bmm > 0 ? { gridColumn: "1 / -1" } : {}),
                    }
                  : { position: "relative", width: "100%", height: "100%" }),
              }}
            >
            {setPiecesEditable && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  right: 6,
                  zIndex: 37,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxWidth: "calc(100% - 12px)",
                }}
              >
                {!hideFloorMarkupFloatingToolbars ? (
                <>
                <div
                  role="toolbar"
                  aria-label="ステージ床テキスト"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                    background: "rgba(15, 23, 42, 0.95)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#94a3b8",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      テキスト
                    </span>
                    <button
                      type="button"
                      title="文面とサイズを指定し、床をクリックして配置（Esc で終了）"
                      onClick={() => {
                        setFloorMarkupTool((t) => {
                          if (t === "text") {
                            setFloorTextEditId(null);
                            return null;
                          }
                          return "text";
                        });
                      }}
                      style={{
                        ...btnSecondary,
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: 600,
                        borderColor:
                          floorMarkupTool === "text"
                            ? "rgba(99,102,241,0.9)"
                            : undefined,
                        color: floorMarkupTool === "text" ? "#e0e7ff" : undefined,
                      }}
                    >
                      書き込み
                    </button>
                    {floorMarkupTool === "text" && floorTextEditId ? (
                      <button
                        type="button"
                        title="選択を解除し、新しいテキストを置けるようにします"
                        onClick={() => setFloorTextEditId(null)}
                        style={{
                          ...btnSecondary,
                          padding: "4px 8px",
                          fontSize: "11px",
                        }}
                      >
                        新規へ
                      </button>
                    ) : null}
                  </div>
                  {floorMarkupTool === "text" ? (
                    <>
                      <textarea
                        value={floorTextDraft.body}
                        onChange={(e) => {
                          const body = e.target.value;
                          setFloorTextDraft((d) => ({ ...d, body }));
                          if (floorTextEditId) {
                            updateActiveFormation((f) => ({
                              ...f,
                              floorMarkup: (f.floorMarkup ?? []).map((m) =>
                                m.id === floorTextEditId && m.kind === "text"
                                  ? { ...m, text: body.slice(0, 400) }
                                  : m
                              ),
                            }));
                          }
                        }}
                        rows={2}
                        placeholder="ステージに表示する文言…"
                        style={{
                          width: "100%",
                          resize: "vertical",
                          minHeight: 44,
                          boxSizing: "border-box",
                          borderRadius: 6,
                          border: "1px solid #475569",
                          background: "#0f172a",
                          color: "#e2e8f0",
                          fontSize: 13,
                          padding: "6px 8px",
                          fontFamily: "system-ui, sans-serif",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "12px 16px",
                          fontSize: "11px",
                          color: "#cbd5e1",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          サイズ {floorTextDraft.fontSizePx}px
                          <input
                            type="range"
                            min={8}
                            max={56}
                            value={floorTextDraft.fontSizePx}
                            onChange={(e) => {
                              const fontSizePx = Number(e.target.value);
                              setFloorTextDraft((d) => ({ ...d, fontSizePx }));
                              if (floorTextEditId) {
                                updateActiveFormation((f) => ({
                                  ...f,
                                  floorMarkup: (f.floorMarkup ?? []).map((m) =>
                                    m.id === floorTextEditId && m.kind === "text"
                                      ? {
                                          ...m,
                                          fontSizePx: Math.round(
                                            clamp(fontSizePx, 8, 56)
                                          ),
                                        }
                                      : m
                                  ),
                                }));
                              }
                            }}
                          />
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          太さ {floorTextDraft.fontWeight}
                          <input
                            type="range"
                            min={300}
                            max={900}
                            step={50}
                            value={floorTextDraft.fontWeight}
                            onChange={(e) => {
                              const fontWeight = Number(e.target.value);
                              setFloorTextDraft((d) => ({ ...d, fontWeight }));
                              if (floorTextEditId) {
                                const fw =
                                  Math.round(clamp(fontWeight, 300, 900) / 50) *
                                  50;
                                updateActiveFormation((f) => ({
                                  ...f,
                                  floorMarkup: (f.floorMarkup ?? []).map((m) =>
                                    m.id === floorTextEditId && m.kind === "text"
                                      ? { ...m, fontWeight: fw }
                                      : m
                                  ),
                                }));
                              }
                            }}
                          />
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ whiteSpace: "nowrap" }}>色</span>
                          <input
                            type="color"
                            aria-label="文字色"
                            title="文字色"
                            value={floorTextDraftColorHex(floorTextDraft.color)}
                            onChange={(ev) => {
                              const v = ev.target.value;
                              setFloorTextDraft((d) => ({ ...d, color: v }));
                              if (floorTextEditId) {
                                updateActiveFormation((f) => ({
                                  ...f,
                                  floorMarkup: (f.floorMarkup ?? []).map((m) =>
                                    m.id === floorTextEditId && m.kind === "text"
                                      ? { ...m, color: v }
                                      : m
                                  ),
                                }));
                              }
                            }}
                            style={{
                              width: 28,
                              height: 22,
                              padding: 0,
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                            }}
                          />
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ whiteSpace: "nowrap" }}>フォント</span>
                          <select
                            aria-label="フォント"
                            title="フォント"
                            value={
                              FLOOR_TEXT_FONT_OPTIONS.some(
                                (o) => o.value === floorTextDraft.fontFamily
                              )
                                ? floorTextDraft.fontFamily
                                : FLOOR_TEXT_FONT_OPTIONS[0]!.value
                            }
                            onChange={(ev) => {
                              const v = ev.target.value;
                              setFloorTextDraft((d) => ({ ...d, fontFamily: v }));
                              if (floorTextEditId) {
                                updateActiveFormation((f) => ({
                                  ...f,
                                  floorMarkup: (f.floorMarkup ?? []).map((m) =>
                                    m.id === floorTextEditId && m.kind === "text"
                                      ? { ...m, fontFamily: v }
                                      : m
                                  ),
                                }));
                              }
                            }}
                            style={{
                              fontSize: 11,
                              maxWidth: 160,
                              borderRadius: 4,
                              border: "1px solid #334155",
                              background: "#020617",
                              color: "#e2e8f0",
                            }}
                          >
                            {FLOOR_TEXT_FONT_OPTIONS.map((o) => (
                              <option key={o.id} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          lineHeight: 1.4,
                          color: "#64748b",
                        }}
                      >
                        {floorTextEditId
                          ? "空の床をクリックで位置を移動。サイズ・太さ・色・フォントはここまたはステージ上のツールバーで変更できます。"
                          : "本文を入力してから床をクリックで配置。既存の床テキストをクリックすると編集できます。"}
                      </div>
                    </>
                  ) : null}
                </div>
                <div
                  role="toolbar"
                  aria-label="床に線を引く・消す"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                    padding: "4px 8px",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                    background: "rgba(15, 23, 42, 0.92)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "9px",
                      color: "#64748b",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                    }}
                  >
                    床
                  </span>
                  <button
                    type="button"
                    title="ドラッグで線（手描きの折れ線・Esc で終了）"
                    onClick={() =>
                      setFloorMarkupTool((t) => (t === "line" ? null : "line"))
                    }
                    style={{
                      ...btnSecondary,
                      padding: "4px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderColor:
                        floorMarkupTool === "line"
                          ? "rgba(99,102,241,0.9)"
                          : undefined,
                      color: floorMarkupTool === "line" ? "#e0e7ff" : undefined,
                    }}
                  >
                    線
                  </button>
                  <button
                    type="button"
                    title="コメントや線をタップして削除"
                    onClick={() =>
                      setFloorMarkupTool((t) => (t === "erase" ? null : "erase"))
                    }
                    style={{
                      ...btnSecondary,
                      padding: "4px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderColor:
                        floorMarkupTool === "erase"
                          ? "rgba(248,113,113,0.85)"
                          : undefined,
                      color: floorMarkupTool === "erase" ? "#fecaca" : undefined,
                    }}
                  >
                    消す
                  </button>
                  {floorMarkupTool ? (
                    <button
                      type="button"
                      title="ツールを終了（Esc でも可）"
                      onClick={() => {
                        setFloorMarkupTool(null);
                        floorLineSessionRef.current = null;
                        setFloorLineDraft(null);
                        setFloorTextEditId(null);
                        setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
                        setFloorTextInlineRect(null);
                      }}
                      style={{
                        ...btnSecondary,
                        padding: "4px 8px",
                        fontSize: "11px",
                      }}
                    >
                      完了
                    </button>
                  ) : null}
                </div>
                {floorMarkupTool === "line" || floorMarkupTool === "erase" ? (
                  <div
                    style={{
                      fontSize: "10px",
                      lineHeight: 1.35,
                      color: "#94a3b8",
                    }}
                  >
                    {floorMarkupTool === "line" &&
                      "床で押したまま動かして線を描きます"}
                    {floorMarkupTool === "erase" &&
                      "削除したいメモや線をタップ"}
                  </div>
                ) : null}
                </>
                ) : null}
                {hideFloorMarkupFloatingToolbars && floorMarkupTool === "text" ? (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 8,
                      right: 8,
                      zIndex: 37,
                      maxHeight: "42%",
                      overflow: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #334155",
                      background: "rgba(15, 23, 42, 0.96)",
                      boxShadow: "0 -4px 18px rgba(0,0,0,0.35)",
                    }}
                  >
                    {floorTextEditId ? (
                      <button
                        type="button"
                        title="選択を解除し、新しいテキストを置けるようにします"
                        onClick={() => setFloorTextEditId(null)}
                        style={{
                          ...btnSecondary,
                          padding: "4px 10px",
                          fontSize: "11px",
                          alignSelf: "flex-start",
                        }}
                      >
                        新規へ
                      </button>
                    ) : null}
                    <textarea
                      value={floorTextDraft.body}
                      onChange={(e) => {
                        const body = e.target.value;
                        setFloorTextDraft((d) => ({ ...d, body }));
                        if (floorTextEditId) {
                          updateActiveFormation((f) => ({
                            ...f,
                            floorMarkup: (f.floorMarkup ?? []).map((m) =>
                              m.id === floorTextEditId && m.kind === "text"
                                ? { ...m, text: body.slice(0, 400) }
                                : m
                            ),
                          }));
                        }
                      }}
                      rows={2}
                      placeholder="ステージに表示する文言…"
                      style={{
                        width: "100%",
                        resize: "vertical",
                        minHeight: 44,
                        boxSizing: "border-box",
                        borderRadius: 6,
                        border: "1px solid #475569",
                        background: "#0f172a",
                        color: "#e2e8f0",
                        fontSize: 13,
                        padding: "6px 8px",
                        fontFamily: "system-ui, sans-serif",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "12px 16px",
                        fontSize: "11px",
                        color: "#cbd5e1",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        サイズ {floorTextDraft.fontSizePx}px
                        <input
                          type="range"
                          min={8}
                          max={56}
                          value={floorTextDraft.fontSizePx}
                          onChange={(e) => {
                            const fontSizePx = Number(e.target.value);
                            setFloorTextDraft((d) => ({ ...d, fontSizePx }));
                            if (floorTextEditId) {
                              updateActiveFormation((f) => ({
                                ...f,
                                floorMarkup: (f.floorMarkup ?? []).map((m) =>
                                  m.id === floorTextEditId && m.kind === "text"
                                    ? {
                                        ...m,
                                        fontSizePx: Math.round(
                                          clamp(fontSizePx, 8, 56)
                                        ),
                                      }
                                    : m
                                ),
                              }));
                            }
                          }}
                        />
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        太さ {floorTextDraft.fontWeight}
                        <input
                          type="range"
                          min={300}
                          max={900}
                          step={50}
                          value={floorTextDraft.fontWeight}
                          onChange={(e) => {
                            const fontWeight = Number(e.target.value);
                            setFloorTextDraft((d) => ({ ...d, fontWeight }));
                            if (floorTextEditId) {
                              const fw =
                                Math.round(clamp(fontWeight, 300, 900) / 50) * 50;
                              updateActiveFormation((f) => ({
                                ...f,
                                floorMarkup: (f.floorMarkup ?? []).map((m) =>
                                  m.id === floorTextEditId && m.kind === "text"
                                    ? { ...m, fontWeight: fw }
                                    : m
                                ),
                              }));
                            }
                          }}
                        />
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ whiteSpace: "nowrap" }}>色</span>
                        <input
                          type="color"
                          aria-label="文字色"
                          title="文字色"
                          value={floorTextDraftColorHex(floorTextDraft.color)}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            setFloorTextDraft((d) => ({ ...d, color: v }));
                            if (floorTextEditId) {
                              updateActiveFormation((f) => ({
                                ...f,
                                floorMarkup: (f.floorMarkup ?? []).map((m) =>
                                  m.id === floorTextEditId && m.kind === "text"
                                    ? { ...m, color: v }
                                    : m
                                ),
                              }));
                            }
                          }}
                          style={{
                            width: 28,
                            height: 22,
                            padding: 0,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                        />
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ whiteSpace: "nowrap" }}>フォント</span>
                        <select
                          aria-label="フォント"
                          title="フォント"
                          value={
                            FLOOR_TEXT_FONT_OPTIONS.some(
                              (o) => o.value === floorTextDraft.fontFamily
                            )
                              ? floorTextDraft.fontFamily
                              : FLOOR_TEXT_FONT_OPTIONS[0]!.value
                          }
                          onChange={(ev) => {
                            const v = ev.target.value;
                            setFloorTextDraft((d) => ({ ...d, fontFamily: v }));
                            if (floorTextEditId) {
                              updateActiveFormation((f) => ({
                                ...f,
                                floorMarkup: (f.floorMarkup ?? []).map((m) =>
                                  m.id === floorTextEditId && m.kind === "text"
                                    ? { ...m, fontFamily: v }
                                    : m
                                ),
                              }));
                            }
                          }}
                          style={{
                            fontSize: 11,
                            maxWidth: 160,
                            borderRadius: 4,
                            border: "1px solid #334155",
                            background: "#020617",
                            color: "#e2e8f0",
                          }}
                        >
                          {FLOOR_TEXT_FONT_OPTIONS.map((o) => (
                            <option key={o.id} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      title="ツールを終了（Esc でも可）"
                      onClick={() => {
                        setFloorMarkupTool(null);
                        setFloorTextEditId(null);
                        setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
                        setFloorTextInlineRect(null);
                      }}
                      style={{
                        ...btnSecondary,
                        padding: "6px 12px",
                        fontSize: "12px",
                        alignSelf: "flex-end",
                      }}
                    >
                      完了
                    </button>
                  </div>
                ) : null}
                {hideFloorMarkupFloatingToolbars &&
                (floorMarkupTool === "line" || floorMarkupTool === "erase") ? (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 8,
                      right: 8,
                      zIndex: 37,
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #334155",
                      background: "rgba(15, 23, 42, 0.94)",
                      boxShadow: "0 -4px 18px rgba(0,0,0,0.35)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        flex: "1 1 180px",
                        lineHeight: 1.35,
                      }}
                    >
                      {floorMarkupTool === "line" &&
                        "床で押したまま動かして線を描きます"}
                      {floorMarkupTool === "erase" &&
                        "削除したいメモや線をタップ"}
                    </span>
                    <button
                      type="button"
                      title="ツールを終了（Esc でも可）"
                      onClick={() => {
                        setFloorMarkupTool(null);
                        floorLineSessionRef.current = null;
                        setFloorLineDraft(null);
                        setFloorTextEditId(null);
                        setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
                        setFloorTextInlineRect(null);
                      }}
                      style={{
                        ...btnSecondary,
                        padding: "6px 12px",
                        fontSize: "12px",
                      }}
                    >
                      完了
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            {stageShapeActive && stageShapeMaskPath && (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              >
                {/* 舞台外を暗くする（evenodd くり抜き） */}
                <path
                  d={stageShapeMaskPath}
                  fill="rgba(2, 6, 23, 0.55)"
                  fillRule="evenodd"
                />
                {/* 舞台エリアの輪郭線 */}
                <polygon
                  points={stageShapeSvgPoints}
                  fill="none"
                  stroke="rgba(94, 234, 212, 0.85)"
                  strokeWidth="0.45"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {(project.stageGridLinesEnabled ?? false) &&
              mmSnapGrid != null && (
                <svg
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    opacity: 0.36,
                  }}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  {(() => {
                    const MAX = 120;
                    const { stepXPct, stepYPct } = mmSnapGrid;
                    let sx = 1;
                    while (Math.ceil(100 / (stepXPct * sx)) > MAX) sx++;
                    let sy = 1;
                    while (Math.ceil(100 / (stepYPct * sy)) > MAX) sy++;
                    const nodes: ReactElement[] = [];
                    for (let i = 0; i * stepXPct * sx <= 100 + 1e-9; i++) {
                      const g = round2(Math.min(100, i * stepXPct * sx));
                      nodes.push(
                        <line
                          key={`v-${i}-${sx}`}
                          x1={`${g}%`}
                          y1="0%"
                          x2={`${g}%`}
                          y2="100%"
                          stroke="#64748b"
                          strokeWidth="0.35"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    }
                    for (let j = 0; j * stepYPct * sy <= 100 + 1e-9; j++) {
                      const g = round2(Math.min(100, j * stepYPct * sy));
                      nodes.push(
                        <line
                          key={`h-${j}-${sy}`}
                          x1="0%"
                          y1={`${g}%`}
                          x2="100%"
                          y2={`${g}%`}
                          stroke="#64748b"
                          strokeWidth="0.35"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    }
                    return nodes;
                  })()}
                </svg>
              )}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 2,
              }}
              aria-hidden
            >
              {(() => {
                const lines: ReactElement[] = [];
                for (let i = 1; i < 10; i++) {
                  const g = i * 10;
                  lines.push(
                    <line
                      key={`bg-v-${i}`}
                      x1={g}
                      y1="0"
                      x2={g}
                      y2="100"
                      stroke="rgba(228, 228, 231, 0.12)"
                      strokeWidth="0.28"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                  lines.push(
                    <line
                      key={`bg-h-${i}`}
                      x1="0"
                      y1={g}
                      x2="100"
                      y2={g}
                      stroke="rgba(228, 228, 231, 0.1)"
                      strokeWidth="0.28"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                }
                return lines;
              })()}
              <line
                x1="50"
                y1="0"
                x2="50"
                y2="100"
                stroke={shell.ruby}
                strokeWidth="0.55"
                vectorEffect="non-scaling-stroke"
                opacity={0.92}
              />
              <line
                x1="48.2"
                y1="0.6"
                x2="51.8"
                y2="0.6"
                stroke={shell.ruby}
                strokeWidth="0.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="48.2"
                y1="99.4"
                x2="51.8"
                y2="99.4"
                stroke={shell.ruby}
                strokeWidth="0.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                stroke="rgba(248, 250, 252, 0.18)"
                strokeWidth="0.32"
                vectorEffect="non-scaling-stroke"
              />
              {guideLineDrawMarks.map(({ xp, k }, i) => (
                <line
                  key={`gm-${i}-${k}-${xp}`}
                  x1={xp}
                  y1="0"
                  x2={xp}
                  y2="100"
                  stroke="rgba(251, 191, 36, 0.72)"
                  strokeWidth="0.4"
                  strokeDasharray="1.6 1.6"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/**
               * 場ミリ規格スロットのドット（割 = 小さい点、乗せ = 少し大きい点）。
               * 客席帯のすぐ上の細い帯に並べ、ステージ全体を汚さない。
               */}
              {conventionGuideDots.map(({ xPct, isMain }, i) => (
                <circle
                  key={`cdot-${i}-${xPct}`}
                  cx={xPct}
                  cy={84}
                  r={isMain ? 0.55 : 0.4}
                  fill={
                    isMain ? "rgba(56, 189, 248, 0.78)" : "rgba(56, 189, 248, 0.5)"
                  }
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/**
               * ドラッグ中のスナップ補助線（前後・左右・センター等にピタッと揃ったとき）。
               * 通常のガイド線より目立つ色で、ドラッグ中のみ表示する。
               */}
              {alignGuides.x != null && (
                <line
                  x1={alignGuides.x}
                  y1="0"
                  x2={alignGuides.x}
                  y2="100"
                  stroke="#22d3ee"
                  strokeWidth="0.5"
                  strokeDasharray="2 1.2"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.95"
                />
              )}
              {alignGuides.y != null && (
                <line
                  x1="0"
                  y1={alignGuides.y}
                  x2="100"
                  y2={alignGuides.y}
                  stroke="#22d3ee"
                  strokeWidth="0.5"
                  strokeDasharray="2 1.2"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.95"
                />
              )}
            </svg>
            {!(showShell && Bmm > 0) ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  paddingTop: "6px",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  color: shell.textMuted,
                  pointerEvents: "none",
                  zIndex: 4,
                  textShadow: "0 1px 3px rgba(0,0,0,0.75)",
                }}
              >
                舞台裏
              </div>
            ) : null}
            <div
              aria-label="ステージ センター前"
              title="センター前（基準点）"
              style={{
                position: "absolute",
                left: "50%",
                bottom: "14%",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: shell.ruby,
                boxShadow: `0 0 0 1px ${shell.bgDeep}`,
                transform: "translate(-50%, 50%)",
                pointerEvents: "none",
                zIndex: 4,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "14%",
                background:
                  "linear-gradient(180deg, transparent, rgba(9,9,11,0.9))",
                borderTop: `1px solid ${shell.border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                justifyContent: "flex-end",
                paddingBottom: "5px",
                pointerEvents: "none",
                zIndex: 3,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "relative",
                  width: "100%",
                  height: "16px",
                  marginBottom: "2px",
                }}
              >
                {Array.from({ length: 19 }, (_, i) => {
                  const n = Math.abs(i - 9);
                  const leftPct = (i / 18) * 100;
                  let transform = "translateX(-50%)";
                  if (i === 0) transform = "translateX(0)";
                  if (i === 18) transform = "translateX(-100%)";
                  return (
                    <span
                      key={`stage-scale-${i}`}
                      style={{
                        position: "absolute",
                        left: `${leftPct}%`,
                        top: 0,
                        transform,
                        fontSize: "9px",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        color: shell.textSubtle,
                        lineHeight: 1,
                        fontFamily: "system-ui, sans-serif",
                      }}
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: shell.textMuted,
                }}
              >
                客席
              </div>
            </div>
            {guideLineDrawMarks.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: "14%",
                  pointerEvents: "none",
                  zIndex: 4,
                }}
                aria-hidden
              >
                {guideLineDrawMarks.map(({ xp, k }, i) => {
                  /**
                   * 端ギリギリ（xp≒0/100）のラベルは通常の中央寄せ（translateX(-50%)）だと
                   * 半分が親コンテナの外にはみ出して見えない/欠ける。左右対称に全て出せる
                   * よう、近い側の辺でラベルを寄せる transform に切り替える。
                   */
                  let transform = "translateX(-50%)";
                  if (xp <= 1) transform = "translateX(0)";
                  else if (xp >= 99) transform = "translateX(-100%)";
                  return (
                    <span
                      key={`glabel-${i}-${k}-${xp}`}
                      style={{
                        position: "absolute",
                        left: `${xp}%`,
                        top: "2px",
                        transform,
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#fef3c7",
                        textShadow:
                          "0 0 3px rgba(15,23,42,0.95), 0 1px 1px rgba(0,0,0,0.75)",
                        lineHeight: 1,
                        fontFamily: "system-ui, sans-serif",
                      }}
                    >
                      {k}
                    </span>
                  );
                })}
              </div>
            )}
            {(displayFloorMarkup.length > 0 || floorLineDraft) && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 5,
                  pointerEvents: "none",
                }}
              >
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                >
                  {displayFloorMarkup.map((m) => {
                    if (m.kind !== "line" || m.pointsPct.length < 2) return null;
                    const pts = m.pointsPct.map(([x, y]) => `${x},${y}`).join(" ");
                    const stroke = m.color ?? "#fbbf24";
                    const w = m.widthPx ?? 3;
                    return (
                      <g key={m.id}>
                        <polyline
                          data-floor-markup="line"
                          data-fmark-id={m.id}
                          fill="none"
                          stroke={stroke}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          strokeWidth={w}
                          points={pts}
                          style={{ pointerEvents: "none" }}
                        />
                        {floorMarkupTool === "erase" && setPiecesEditable ? (
                          <polyline
                            fill="none"
                            stroke="transparent"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            strokeWidth={22}
                            points={pts}
                            style={{ pointerEvents: "stroke", cursor: "pointer" }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeFloorMarkupById(m.id);
                            }}
                          />
                        ) : null}
                      </g>
                    );
                  })}
                  {floorLineDraft && floorLineDraft.length >= 2 ? (
                    <polyline
                      fill="none"
                      stroke="rgba(251, 191, 36, 0.75)"
                      strokeDasharray="1.2 1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={3}
                      points={floorLineDraft
                        .map(([x, y]) => `${x},${y}`)
                        .join(" ")}
                    />
                  ) : null}
                </svg>
                {displayFloorMarkup.map((m) => {
                  if (m.kind !== "text") return null;
                  const fs = Math.max(8, Math.min(56, m.fontSizePx ?? 18));
                  const fw = Math.round(
                    clamp(m.fontWeight ?? 600, 300, 900) / 50
                  ) * 50;
                  const textHit =
                    setPiecesEditable &&
                    !playbackOrPreview &&
                    !floorTextPlaceSession &&
                    (floorMarkupTool === "text" ||
                      floorMarkupTool === "erase" ||
                      floorMarkupTool === null);
                  const textMoveGrab =
                    setPiecesEditable &&
                    !playbackOrPreview &&
                    !floorTextPlaceSession &&
                    floorMarkupTool === null;
                  const sc = floorTextMarkupScale(m);
                  const selected = selectedFloorTextId === m.id;
                  const showChrome =
                    selected &&
                    textHit &&
                    floorMarkupTool !== "erase" &&
                    setPiecesEditable;
                  const fontCss = floorTextFontCss(m);
                  const colorHex = floorTextColorHex(m);
                  const beginFloorTextResize = (
                    ev: React.PointerEvent<HTMLDivElement>,
                    handle: FloorTextCornerHandle,
                    boxEl: HTMLDivElement | null
                  ) => {
                    if (!setPiecesEditable || !boxEl) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    const rect = boxEl.getBoundingClientRect();
                    let ax: number;
                    let ay: number;
                    if (handle === "se") {
                      ax = rect.left;
                      ay = rect.top;
                    } else if (handle === "nw") {
                      ax = rect.right;
                      ay = rect.bottom;
                    } else if (handle === "ne") {
                      ax = rect.left;
                      ay = rect.bottom;
                    } else {
                      ax = rect.right;
                      ay = rect.top;
                    }
                    const d0 = Math.max(
                      14,
                      Math.hypot(ev.clientX - ax, ev.clientY - ay)
                    );
                    floorTextResizeDragRef.current = {
                      id: m.id,
                      anchorX: ax,
                      anchorY: ay,
                      startDist: d0,
                      startScale: floorTextMarkupScale(m),
                      pointerId: ev.pointerId,
                    };
                    try {
                      (ev.currentTarget as HTMLElement).setPointerCapture(
                        ev.pointerId
                      );
                    } catch {
                      /* noop */
                    }
                  };
                  const handleCursor = (h: FloorTextCornerHandle) =>
                    h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize";
                  return (
                    <div
                      key={m.id}
                      data-floor-text-box
                      data-floor-markup="text"
                      data-fmark-id={m.id}
                      title={
                        textMoveGrab
                          ? "タップで選択（枠と色・フォント）。ダブルクリックでその場に編集。長くドラッグで移動。右クリックで削除"
                          : floorMarkupTool === "text"
                            ? "タップで選択。ダブルクリックでその場に編集。右クリックで削除"
                            : floorMarkupTool === "erase"
                              ? "タップで削除"
                              : undefined
                      }
                      onContextMenu={(e) => {
                        if (
                          viewMode === "view" ||
                          !setPiecesEditable ||
                          playbackOrPreview ||
                          previewDancers ||
                          !textHit
                        ) {
                          return;
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        setStageContextMenu({
                          kind: "floorText",
                          clientX: e.clientX,
                          clientY: e.clientY,
                          markupId: m.id,
                        });
                      }}
                      onDoubleClick={(e) => {
                        if (
                          viewMode === "view" ||
                          !setPiecesEditable ||
                          playbackOrPreview ||
                          previewDancers ||
                          !textHit ||
                          floorMarkupTool === "erase"
                        ) {
                          return;
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        setFloorTextInlineRect({
                          id: m.id,
                          left: r.left,
                          top: r.top,
                          width: Math.max(140, r.width),
                          height: Math.max(40, r.height),
                        });
                        setFloorMarkupTool("text");
                        setFloorTextEditId(m.id);
                        setSelectedFloorTextId(m.id);
                        setFloorTextDraft({
                          body: m.text,
                          fontSizePx: Math.round(clamp(m.fontSizePx ?? 18, 8, 56)),
                          fontWeight: fw,
                          color: colorHex,
                          fontFamily: fontCss,
                        });
                      }}
                      onPointerDown={(e) => {
                        if ((e.target as HTMLElement).closest("[data-floor-text-resize-handle]")) {
                          return;
                        }
                        if (floorMarkupTool === "erase" && setPiecesEditable) {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFloorMarkupById(m.id);
                          return;
                        }
                        if (floorMarkupTool === "text" && setPiecesEditable) {
                          e.preventDefault();
                          e.stopPropagation();
                          setFloorTextEditId(m.id);
                          setSelectedFloorTextId(m.id);
                          setFloorTextDraft({
                            body: m.text,
                            fontSizePx: Math.round(clamp(m.fontSizePx ?? 18, 8, 56)),
                            fontWeight: fw,
                            color: colorHex,
                            fontFamily: fontCss,
                          });
                          return;
                        }
                        if (textMoveGrab) {
                          e.preventDefault();
                          e.stopPropagation();
                          (e.currentTarget as HTMLElement).setPointerCapture(
                            e.pointerId
                          );
                          floorTextTapOrDragRef.current = {
                            id: m.id,
                            text: m.text,
                            fontSizePx: Math.round(clamp(m.fontSizePx ?? 18, 8, 56)),
                            fontWeight: fw,
                            color: colorHex,
                            fontFamily: fontCss,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            startXPct: m.xPct,
                            startYPct: m.yPct,
                            pointerId: e.pointerId,
                          };
                        }
                      }}
                      style={{
                        position: "absolute",
                        left: `${m.xPct}%`,
                        top: `${m.yPct}%`,
                        transform: `translate(-50%, -100%) scale(${sc})`,
                        transformOrigin: "50% 100%",
                        maxWidth: "42%",
                        padding: "2px 6px",
                        borderRadius: "6px",
                        fontSize: fs,
                        lineHeight: 1.25,
                        fontWeight: fw,
                        fontFamily: fontCss,
                        color: m.color ?? "#fef3c7",
                        textShadow:
                          "0 0 2px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.65)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        outline:
                          floorMarkupTool === "text" && floorTextEditId === m.id
                            ? "2px solid rgba(129, 140, 248, 0.95)"
                            : undefined,
                        outlineOffset: 2,
                        pointerEvents: textHit ? "auto" : "none",
                        cursor:
                          floorMarkupTool === "erase" && setPiecesEditable
                            ? "pointer"
                            : floorMarkupTool === "text" && setPiecesEditable
                              ? "pointer"
                              : textMoveGrab
                                ? "grab"
                                : "default",
                        boxSizing: "border-box",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          opacity:
                            floorTextInlineRect?.id === m.id ? 0 : 1,
                        }}
                      >
                        {m.text}
                      </span>
                      {showChrome ? (
                        <>
                          <div
                            aria-hidden
                            style={{
                              position: "absolute",
                              inset: -6,
                              border: "2px solid rgba(129, 140, 248, 0.95)",
                              borderRadius: 6,
                              pointerEvents: "none",
                              zIndex: 1,
                            }}
                          />
                          {(
                            ["nw", "ne", "sw", "se"] as FloorTextCornerHandle[]
                          ).map((h) => (
                            <div
                              key={h}
                              role="presentation"
                              data-floor-text-resize-handle={h}
                              onPointerDown={(ev) =>
                                beginFloorTextResize(
                                  ev,
                                  h,
                                  ev.currentTarget.parentElement as HTMLDivElement
                                )
                              }
                              style={{
                                position: "absolute",
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: "#a5b4fc",
                                border: "1px solid #0f172a",
                                zIndex: 3,
                                pointerEvents: "auto",
                                cursor: handleCursor(h),
                                boxSizing: "border-box",
                                ...(h === "nw"
                                  ? { left: -5, top: -5 }
                                  : h === "ne"
                                    ? { right: -5, top: -5 }
                                    : h === "sw"
                                      ? { left: -5, bottom: -5 }
                                      : { right: -5, bottom: -5 }),
                              }}
                            />
                          ))}
                        </>
                      ) : null}
                      {showChrome && floorMarkupTool === null ? (
                        <div
                          role="toolbar"
                          aria-label="床テキストの色とフォント"
                          onPointerDown={(ev) => ev.stopPropagation()}
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: "100%",
                            transform: "translate(-50%, 8px)",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 6px",
                            borderRadius: 8,
                            border: "1px solid #475569",
                            background: "rgba(15, 23, 42, 0.96)",
                            zIndex: 4,
                            pointerEvents: "auto",
                            minWidth: 120,
                          }}
                        >
                          <input
                            type="color"
                            aria-label="文字色"
                            title="文字色"
                            value={colorHex}
                            onChange={(ev) => {
                              const v = ev.target.value;
                              updateActiveFormation((f) => ({
                                ...f,
                                floorMarkup: (f.floorMarkup ?? []).map((x) =>
                                  x.id === m.id && x.kind === "text"
                                    ? { ...x, color: v }
                                    : x
                                ),
                              }));
                            }}
                            style={{
                              width: 28,
                              height: 22,
                              padding: 0,
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                            }}
                          />
                          <select
                            aria-label="フォント"
                            title="フォント"
                            value={
                              FLOOR_TEXT_FONT_OPTIONS.some((o) => o.value === fontCss)
                                ? fontCss
                                : FLOOR_TEXT_FONT_OPTIONS[0]!.value
                            }
                            onChange={(ev) => {
                              const v = ev.target.value;
                              updateActiveFormation((f) => ({
                                ...f,
                                floorMarkup: (f.floorMarkup ?? []).map((x) =>
                                  x.id === m.id && x.kind === "text"
                                    ? { ...x, fontFamily: v }
                                    : x
                                ),
                              }));
                            }}
                            style={{
                              fontSize: 10,
                              maxWidth: 118,
                              borderRadius: 4,
                              border: "1px solid #334155",
                              background: "#020617",
                              color: "#e2e8f0",
                            }}
                          >
                            {FLOOR_TEXT_FONT_OPTIONS.map((o) => (
                              <option key={o.id} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {floorTextPlaceSession &&
                setPiecesEditable &&
                !playbackOrPreview &&
                onFloorTextPlaceSessionChange ? (
                  <div
                    data-floor-text-place-preview
                    role="presentation"
                    title="ドラッグで位置を調整。空いた床をクリックしても移動できます。"
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
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
                    }}
                    style={{
                      position: "absolute",
                      left: `${floorTextPlaceSession.xPct}%`,
                      top: `${floorTextPlaceSession.yPct}%`,
                      transform: `translate(-50%, -100%) scale(${(() => {
                        const s = floorTextPlaceSession.scale;
                        if (
                          typeof s === "number" &&
                          Number.isFinite(s) &&
                          s > 0
                        ) {
                          return Math.min(8, Math.max(0.2, s));
                        }
                        return 1;
                      })()})`,
                      transformOrigin: "50% 100%",
                      maxWidth: "42%",
                      padding: "4px 8px",
                      borderRadius: "8px",
                      fontSize: Math.max(
                        8,
                        Math.min(56, Math.round(floorTextPlaceSession.fontSizePx))
                      ),
                      lineHeight: 1.25,
                      fontWeight:
                        Math.round(
                          clamp(floorTextPlaceSession.fontWeight, 300, 900) / 50
                        ) * 50,
                      fontFamily:
                        (floorTextPlaceSession.fontFamily ?? "").trim() ||
                        FLOOR_TEXT_DEFAULT_FONT,
                      color: floorTextColorHex({
                        kind: "text",
                        id: "_preview",
                        xPct: 0,
                        yPct: 0,
                        text: "",
                        color: floorTextPlaceSession.color,
                      }),
                      textShadow:
                        "0 0 2px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.65)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      outline: "2px dashed rgba(56, 189, 248, 0.95)",
                      outlineOffset: 2,
                      pointerEvents: "auto",
                      cursor: "grab",
                      zIndex: 8,
                      background: "rgba(15, 23, 42, 0.35)",
                    }}
                  >
                    {floorTextPlaceSession.body.trim()
                      ? floorTextPlaceSession.body
                      : "（テキストを入力）"}
                  </div>
                ) : null}
              </div>
            )}
            {displaySetPieces.map((p) => {
              const fill = resolveSetPieceFill(p);
              const selectedSp =
                selectedSetPieceId === p.id && setPiecesEditable;
              const resizeHandles: {
                h: SetPieceResizeHandle;
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
              return (
                <div
                  key={p.id}
                  data-set-piece-id={p.id}
                  style={{
                    position: "absolute",
                    left: `${p.xPct}%`,
                    top: `${p.yPct}%`,
                    width: `${p.wPct}%`,
                    height: `${p.hPct}%`,
                    zIndex: selectedSp ? 5 : 2,
                    boxSizing: "border-box",
                    pointerEvents: setPiecesEditable ? "auto" : "none",
                  }}
                >
                  <button
                    type="button"
                    aria-label={p.label?.trim() ? p.label : "大道具"}
                    title={
                      setPiecesEditable
                        ? [
                            p.label?.trim() ||
                              `大道具（${setPieceKindJa(p.kind)}）`,
                            "ドラッグで移動",
                            "角・辺のハンドルでリサイズ（§10）",
                            snapGrid ? "Shift+ドラッグで細かいグリッド" : null,
                            "Delete / Backspace で削除",
                            "右クリックで削除メニュー",
                            "ダブルクリックでキュー間ギャップの補間 ON/OFF",
                            p.interpolateInGaps ? "（補間: ON）" : "（補間: OFF）",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : undefined
                    }
                    tabIndex={setPiecesEditable ? 0 : -1}
                    onPointerDown={(e) => handlePointerDownSetPiece(e, p)}
                    onContextMenu={(e) => {
                      if (
                        viewMode === "view" ||
                        playbackOrPreview ||
                        !setPiecesEditable
                      )
                        return;
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedSetPieceId(p.id);
                      setStageContextMenu({
                        kind: "setPiece",
                        clientX: e.clientX,
                        clientY: e.clientY,
                        pieceId: p.id,
                      });
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!setPiecesEditable) return;
                      updateActiveFormation((f) => ({
                        ...f,
                        setPieces: (f.setPieces ?? []).map((x) =>
                          x.id === p.id
                            ? { ...x, interpolateInGaps: !x.interpolateInGaps }
                            : x
                        ),
                      }));
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      border:
                        selectedSp
                          ? "2px solid rgba(251, 191, 36, 0.92)"
                          : p.interpolateInGaps
                            ? "1px solid rgba(45, 212, 191, 0.72)"
                            : "1px solid rgba(148, 163, 184, 0.55)",
                      borderRadius: p.kind === "ellipse" ? "999px" : 6,
                      background: "rgba(15, 23, 42, 0.2)",
                      boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.2)",
                      cursor: setPiecesEditable ? "grab" : "default",
                      padding: 0,
                      margin: 0,
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      justifyContent: "flex-end",
                      textAlign: "left",
                      color: "#f1f5f9",
                      fontSize: "10px",
                      lineHeight: 1.25,
                      fontWeight: 600,
                      overflow: "hidden",
                      userSelect: "none",
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 18,
                        pointerEvents: "none",
                      }}
                    >
                      {p.kind === "triangle" ? (
                        <div
                          style={{
                            position: "absolute",
                            left: "8%",
                            right: "8%",
                            top: "6%",
                            bottom: "10%",
                            clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                            WebkitClipPath:
                              "polygon(50% 0%, 0% 100%, 100% 100%)",
                            background: fill,
                            opacity: 0.92,
                          }}
                        />
                      ) : p.kind === "ellipse" ? (
                        <div
                          style={{
                            position: "absolute",
                            left: "6%",
                            right: "6%",
                            top: "6%",
                            bottom: "6%",
                            borderRadius: "50%",
                            background: fill,
                            opacity: 0.92,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            position: "absolute",
                            left: "6%",
                            right: "6%",
                            top: "6%",
                            bottom: "6%",
                            borderRadius: 5,
                            background: fill,
                            opacity: 0.92,
                          }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        position: "relative",
                        zIndex: 1,
                        padding: "2px 6px 4px",
                        textShadow:
                          "0 0 4px rgba(15,23,42,0.95), 0 1px 2px rgba(0,0,0,0.8)",
                        alignSelf: "flex-start",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.label?.trim() ? p.label : "大道具"}
                    </span>
                  </button>
                  {selectedSp
                    ? resizeHandles.map(({ h, cursor, pos }) => (
                        <div
                          key={h}
                          role="presentation"
                          aria-hidden
                          title={`リサイズ（${h}）`}
                          onPointerDown={(e) =>
                            handlePointerDownSetPieceResize(e, p, h)
                          }
                          style={{
                            position: "absolute",
                            width: 11,
                            height: 11,
                            borderRadius: 2,
                            background: "rgba(251, 191, 36, 0.95)",
                            border: "1px solid #0f172a",
                            zIndex: 6,
                            boxSizing: "border-box",
                            touchAction: "none",
                            cursor,
                            ...pos,
                          }}
                        />
                      ))
                    : null}
                </div>
              );
            })}
            {selectionBox &&
              groupRotateGuideDeltaDeg != null &&
              !playbackOrPreview &&
              viewMode !== "view" && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: `${(selectionBox.x0 + selectionBox.x1) / 2}%`,
                    top: `${(selectionBox.y0 + selectionBox.y1) / 2}%`,
                    transform: "translate(-50%, calc(-50% - 18px))",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid rgba(51, 65, 85, 0.95)",
                    background: "rgba(15, 23, 42, 0.92)",
                    color: "#e2e8f0",
                    fontSize: "11px",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    pointerEvents: "none",
                    zIndex: 9,
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                  }}
                >
                  {Math.round(groupRotateGuideDeltaDeg)}°
                </div>
              )}
            {marquee && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: `${Math.min(marquee.startXPct, marquee.curXPct)}%`,
                  top: `${Math.min(marquee.startYPct, marquee.curYPct)}%`,
                  width: `${Math.abs(marquee.curXPct - marquee.startXPct)}%`,
                  height: `${Math.abs(marquee.curYPct - marquee.startYPct)}%`,
                  border: "1px dashed rgba(129, 140, 248, 0.95)",
                  background: "rgba(99, 102, 241, 0.12)",
                  pointerEvents: "none",
                  zIndex: 7,
                  boxSizing: "border-box",
                }}
              />
            )}
            {selectionBox && (
              <div
                aria-label="選択中のダンサー"
                data-group-box
                style={{
                  position: "absolute",
                  left: `${selectionBox.x0}%`,
                  top: `${selectionBox.y0}%`,
                  width: `${Math.max(0.01, selectionBox.x1 - selectionBox.x0)}%`,
                  height: `${Math.max(0.01, selectionBox.y1 - selectionBox.y0)}%`,
                  border: `1px dashed ${shell.ruby}`,
                  borderRadius: 4,
                  background: "rgba(220, 38, 38, 0.05)",
                  pointerEvents: "none",
                  zIndex: 6,
                  boxSizing: "border-box",
                }}
              >
                {GROUP_BOX_HANDLES.map(({ h, cursor, pos }) => (
                  <div
                    key={h}
                    data-group-box-handle={h}
                    role="presentation"
                    aria-hidden
                    title={`群のリサイズ（${h}）${
                      h === "n" || h === "s" || h === "e" || h === "w"
                        ? "・Shift で比率保持"
                        : "・Shift で 1 軸のみ"
                    }`}
                    onPointerDown={(e) =>
                      handlePointerDownGroupBoxHandle(e, h, selectionBox)
                    }
                    style={{
                      position: "absolute",
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: "#f4f4f5",
                      border: "1px solid rgba(0,0,0,0.38)",
                      zIndex: 7,
                      boxSizing: "border-box",
                      touchAction: "none",
                      pointerEvents: "auto",
                      cursor,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                      ...pos,
                    }}
                  />
                ))}
              </div>
            )}
            {selectionBox &&
              selectedDancerIds.length >= 2 &&
              !playbackOrPreview &&
              viewMode !== "view" &&
              stageInteractionsEnabled && (
                <button
                  type="button"
                  data-group-rotate-handle
                  aria-label="選択メンバーを枠の中心まわりに回転（立ち位置と向き）"
                  title={`選択中の ${selectedDancerIds.length} 人を、枠の中心を軸に図形ごと回転（立ち位置と向きが一緒にまわります）`}
                  onPointerDown={handlePointerDownMarkerRotate}
                  style={{
                    position: "absolute",
                    left: `${(selectionBox.x0 + selectionBox.x1) / 2}%`,
                    top: `calc(${selectionBox.y1}% + 12px)`,
                    transform: "translateX(-50%)",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: `2px solid ${shell.bgDeep}`,
                    background: shell.ruby,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
                    cursor: "grab",
                    touchAction: "none",
                    pointerEvents: "auto",
                    zIndex: 12,
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxSizing: "border-box",
                  }}
                >
                  <RotateHandleGlyph size={14} />
                </button>
              )}
            {dragGhostById &&
              dragGhostById.size > 0 &&
              !playbackOrPreview &&
              viewMode !== "view" &&
              [...dragGhostById.entries()].map(([ghostId, pos]) => {
                const d =
                  (writeFormation?.dancers ?? activeFormation?.dancers ?? []).find(
                    (x) => x.id === ghostId
                  ) ?? null;
                if (!d) return null;
                const hideGlyph =
                  bulkHideDancerGlyphs &&
                  !playbackOrPreview &&
                  selectedDancerIds.length >= 2 &&
                  selectedDancerIds.includes(ghostId);
                const dMarkerPx = effectiveMarkerPx(d);
                const dLabelFontPx = markerCircleLabelFontPx(dMarkerPx);
                const list = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
                const diRaw = list.findIndex((x) => x.id === ghostId);
                const di = diRaw >= 0 ? diRaw : 0;
                const circleLabel = dancerLabelBelow
                  ? dancerCircleInnerBelowLabel(d, di)
                  : d.label || "?";
                const facing = normalizeDancerFacingDeg(effectiveFacingDeg(d));
                const labelOffsetPx =
                  Math.round(dMarkerPx / 2) + 4 + nameBelowClearanceExtraPx;
                const pivotTransform = `translate(-50%, -50%) rotate(${facing}deg)`;
                const halfMarker = dMarkerPx / 2;
                /** 舞台の客席向き回転＋印の向きを打ち消し、画面に対して水平に */
                const screenUnrotateDeg = -(rot + facing);
                const belowNameFontPx = markerBelowLabelFontPx(dLabelFontPx);
                const belowLabelOriginYpx =
                  -labelOffsetPx + Math.round((belowNameFontPx * 1.12) / 2);
                return (
                  <Fragment key={`drag-ghost-${ghostId}`}>
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: `${pos.xPct}%`,
                        top: `${pos.yPct}%`,
                        transform: pivotTransform,
                        transformOrigin: "center center",
                        width: 0,
                        height: 0,
                        zIndex: 3,
                        pointerEvents: "none",
                        opacity: 0.38,
                        filter: "grayscale(0.15)",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          marginLeft: -halfMarker,
                          marginTop: -halfMarker,
                          width: `${dMarkerPx}px`,
                          height: `${dMarkerPx}px`,
                          borderRadius: "50%",
                          border: "2px dashed rgba(255,255,255,0.45)",
                          backgroundColor:
                            DANCER_PALETTE[modDancerColorIndex(d.colorIndex)],
                          color: "#0f172a",
                          fontWeight: 700,
                          fontSize: `${dLabelFontPx}px`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxSizing: "border-box",
                          userSelect: "none",
                        }}
                      >
                        {!hideGlyph ? (
                          <span
                            style={{
                              position: "relative",
                              zIndex: 1,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transform: `rotate(${screenUnrotateDeg}deg)`,
                              transformOrigin: "center center",
                            }}
                          >
                            {circleLabel}
                          </span>
                        ) : null}
                      </div>
                      {dancerLabelBelow && !hideGlyph && (
                        <div
                          aria-hidden
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: `translate(-50%, calc(-50% + ${labelOffsetPx}px)) rotate(${screenUnrotateDeg}deg)`,
                            transformOrigin: `50% ${belowLabelOriginYpx}px`,
                            color: "#f8fafc",
                            fontSize: `${belowNameFontPx}px`,
                            fontWeight: 700,
                            lineHeight: 1.1,
                            whiteSpace: "nowrap",
                            pointerEvents: "none",
                            textShadow:
                              "0 1px 2px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)",
                            userSelect: "none",
                            maxWidth: "120px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {d.label || "?"}
                        </div>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            {dancersForStageMarkers.map((d, di) => {
              const dMarkerPx = effectiveMarkerPx(d);
              const dLabelFontPx = markerCircleLabelFontPx(dMarkerPx);
              const hideGlyph =
                bulkHideDancerGlyphs &&
                !playbackOrPreview &&
                selectedDancerIds.length >= 2 &&
                selectedDancerIds.includes(d.id);
              const circleLabel = dancerLabelBelow
                ? dancerCircleInnerBelowLabel(d, di)
                : d.label || "?";
              const facing = normalizeDancerFacingDeg(effectiveFacingDeg(d));
              const labelOffsetPx =
                Math.round(dMarkerPx / 2) + 4 + nameBelowClearanceExtraPx;
              const pivotTransform = playbackOrPreview
                ? `translate3d(-50%, -50%, 0) rotate(${facing}deg)`
                : `translate(-50%, -50%) rotate(${facing}deg)`;
              const halfMarker = dMarkerPx / 2;
              /** 舞台の客席向き回転＋印の向きを打ち消し、画面に対して水平に */
              const screenUnrotateDeg = -(rot + facing);
              const belowNameFontPx = markerBelowLabelFontPx(dLabelFontPx);
              const belowLabelOriginYpx =
                -labelOffsetPx + Math.round((belowNameFontPx * 1.12) / 2);
              return (
                <Fragment key={d.id}>
                  <div
                    style={{
                      position: "absolute",
                      left: `${d.xPct}%`,
                      top: `${d.yPct}%`,
                      transform: pivotTransform,
                      transformOrigin: "center center",
                      width: 0,
                      height: 0,
                      zIndex: 4,
                      pointerEvents: "none",
                      willChange: playbackOrPreview ? "transform" : undefined,
                    }}
                  >
                    <button
                      type="button"
                      data-dancer-id={d.id}
                      title={
                        !playbackOrPreview
                          ? [
                              mmLabel(d.xPct, d.yPct),
                              "ダブルクリックで名前・身長・学年・性別・スキル・備考",
                              "右クリックで削除・並べ替えメニュー",
                              "下端へ寄せるとゴミ箱が出ます。そこへドロップで削除",
                              "Shift / Cmd / Ctrl+クリックで複数選択に追加",
                              "空のステージをドラッグで範囲選択",
                              snapGrid
                                ? "Shift+ドラッグで細かいグリッドにスナップ"
                                : null,
                              "Alt+矢印で微移動（Shift+Altでさらに細かく）",
                              "⌘D / Ctrl+D で選択メンバーを複製",
                              "Alt+クリックで重なった印の背面へ切替（§10）",
                              facing !== 0
                                ? `向き ${facing}°（印の下の丸ハンドルをドラッグで変更）`
                                : "印の下の丸いハンドルで向きを変更",
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : mmLabel(d.xPct, d.yPct) || undefined
                      }
                      onPointerDown={(e) =>
                        handlePointerDownDancer(e, d.id, d.xPct, d.yPct)
                      }
                      onContextMenu={(e) => {
                        if (
                          viewMode === "view" ||
                          playbackDancers ||
                          previewDancers ||
                          !stageInteractionsEnabled
                        )
                          return;
                        e.preventDefault();
                        e.stopPropagation();
                        setShowStageDancerColorToolbar(true);
                        setStageContextMenu({
                          kind: "dancer",
                          clientX: e.clientX,
                          clientY: e.clientY,
                          dancerId: d.id,
                        });
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (
                          viewMode === "view" ||
                          playbackDancers ||
                          previewDancers ||
                          !stageInteractionsEnabled
                        )
                          return;
                        setDancerQuickEditId(d.id);
                      }}
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        marginLeft: -halfMarker,
                        marginTop: -halfMarker,
                        width: `${dMarkerPx}px`,
                        height: `${dMarkerPx}px`,
                        borderRadius: "50%",
                        border:
                          dancerQuickEditId === d.id
                            ? "2px solid rgba(99,102,241,0.95)"
                            : selectedDancerIds.includes(d.id)
                              ? selectedDancerIds.length >= 2
                                ? `2px solid ${shell.ruby}`
                                : "2px solid rgba(251,191,36,0.92)"
                              : "2px solid rgba(255,255,255,0.35)",
                        backgroundColor:
                          DANCER_PALETTE[modDancerColorIndex(d.colorIndex)],
                        color: "#0f172a",
                        fontWeight: 700,
                        fontSize: `${dLabelFontPx}px`,
                        cursor:
                          dancerQuickEditId === d.id
                            ? "default"
                            : viewMode === "view" ||
                                playbackDancers ||
                                previewDancers ||
                                !stageInteractionsEnabled
                              ? "default"
                              : "grab",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                        padding: 0,
                        userSelect: "none",
                        pointerEvents:
                          viewMode === "view" ||
                          playbackDancers ||
                          previewDancers ||
                          !stageInteractionsEnabled
                            ? "none"
                            : "auto",
                      }}
                    >
                      {!hideGlyph ? (
                        <span
                          style={{
                            position: "relative",
                            zIndex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transform: `rotate(${screenUnrotateDeg}deg)`,
                            transformOrigin: "center center",
                          }}
                        >
                          {circleLabel}
                        </span>
                      ) : null}
                    </button>
                    {dancerLabelBelow && !hideGlyph && (
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          transform: `translate(-50%, calc(-50% + ${labelOffsetPx}px)) rotate(${screenUnrotateDeg}deg)`,
                          transformOrigin: `50% ${belowLabelOriginYpx}px`,
                          color: "#f8fafc",
                          fontSize: `${belowNameFontPx}px`,
                          fontWeight: 700,
                          lineHeight: 1.1,
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                          textShadow:
                            "0 1px 2px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)",
                          userSelect: "none",
                          maxWidth: "120px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {d.label || "?"}
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })}
            {primarySelectedDancer && !marquee && (() => {
              const pMarkerPx = effectiveMarkerPx(primarySelectedDancer);
              const pFacing = normalizeDancerFacingDeg(
                effectiveFacingDeg(primarySelectedDancer)
              );
              const resizeTip =
                selectedDancerIds.length >= 2
                  ? `選択中の ${selectedDancerIds.length} 人の ○ サイズを一括変更（現 ${pMarkerPx}px・ドラッグで変更）`
                  : `○のサイズ（${pMarkerPx}px）・ドラッグで変更`;
              const rotateTip = `向きをドラッグで変更（現在 ${pFacing}°）`;
              const rim = Math.round(pMarkerPx / 2 + 6);
              return (
                <div
                  role="presentation"
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: `${primarySelectedDancer.xPct}%`,
                    top: `${primarySelectedDancer.yPct}%`,
                    transform: `translate(-50%, -50%) rotate(${pFacing}deg)`,
                    width: 0,
                    height: 0,
                    zIndex: 14,
                    pointerEvents: "none",
                  }}
                >
                  {selectedDancerIds.length < 2 ? (
                    <div
                      data-marker-rotate-handle
                      title={rotateTip}
                      onPointerDown={handlePointerDownMarkerRotate}
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: `calc(50% + ${rim}px)`,
                        transform: "translate(-50%, -50%)",
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: shell.ruby,
                        border: `2px solid ${shell.bgDeep}`,
                        boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
                        cursor: "grab",
                        touchAction: "none",
                        pointerEvents: "auto",
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        userSelect: "none",
                      }}
                    >
                      <RotateHandleGlyph size={13} />
                    </div>
                  ) : null}
                  <div
                    data-marker-resize-handle
                    title={resizeTip}
                    onPointerDown={handlePointerDownMarkerResize}
                    style={{
                      position: "absolute",
                      left: `calc(50% + ${Math.round(pMarkerPx * 0.35)}px)`,
                      top: `calc(50% + ${Math.round(pMarkerPx * 0.35)}px)`,
                      transform: "translate(-50%, -50%)",
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: "#fbbf24",
                      border: "1px solid #0f172a",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                      cursor: "nwse-resize",
                      touchAction: "none",
                      pointerEvents: "auto",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              );
            })()}
            {tapStageToEditLayout && (
              <div
                role="presentation"
                title="クリックすると選択中のフォーメーションをドラッグで調整できます"
                onPointerDown={handleTapOverlayPointerDown}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 8,
                  cursor: "pointer",
                  background: "transparent",
                }}
              />
            )}
            </div>
            {showShell && Smm > 0 && (
              <div
                style={{
                  ...stripShellStyle,
                  gridColumn: 3,
                  gridRow: Bmm > 0 ? 2 : 1,
                  borderLeft: `1px solid ${shell.border}`,
                }}
              >
                サイド
                <br />
                {formatMeterCmLabel(Smm)}
              </div>
            )}
            {showTrashDrop && (
              <div
                ref={trashDockRef}
                role="region"
                aria-label="ダンサーの印や床のテキストをここにドラッグして離すと削除されます"
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: "10px",
                  transform: "translateX(-50%)",
                  zIndex: 30,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  width: "min(118px, 34%)",
                  minHeight: "64px",
                  padding: "8px 6px",
                  borderRadius: "10px",
                  border: `2px dashed ${
                    trashHot ? "rgba(248,113,113,0.95)" : "rgba(100,116,139,0.8)"
                  }`,
                  background: trashHot
                    ? "rgba(127,29,29,0.62)"
                    : "rgba(15,23,42,0.88)",
                  color: "#e2e8f0",
                  fontSize: "9px",
                  lineHeight: 1.3,
                  textAlign: "center",
                  pointerEvents: "none",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.4)",
                  userSelect: "none",
                }}
              >
                <span style={{ fontSize: "22px", lineHeight: 1 }} aria-hidden>
                  🗑
                </span>
                <span>印・床テキストをドロップで削除</span>
              </div>
            )}
            </div>
            {hanamichiEnabled && !stageShapeActive ? (
              <div
                style={{
                  flex: "0 0 auto",
                  height: `${hanamichiDepthPct}%`,
                  minHeight: 28,
                  maxHeight: "42%",
                  borderTop: "1px solid rgba(71, 85, 105, 0.55)",
                  background: "linear-gradient(180deg, #0f172a, #020617)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  color: "#64748b",
                  letterSpacing: "0.14em",
                  userSelect: "none",
                }}
              >
                花道
              </div>
            ) : null}
          </div>
          {/*
            ステージ枠のリサイズハンドル。
            四隅（nw/ne/se/sw）は両軸を同時に、
            辺（n/s/e/w）は担当軸だけを伸縮させる。
          */}
          {viewMode !== "view" &&
            stageInteractionsEnabled &&
            !playbackDancers &&
            !previewDancers &&
            (
              [
                "nw",
                "ne",
                "se",
                "sw",
                "n",
                "s",
                "e",
                "w",
              ] as const
            ).map((h) => {
              const isCorner =
                h === "nw" || h === "ne" || h === "se" || h === "sw";
              const cursor =
                h === "nw" || h === "se"
                  ? "nwse-resize"
                  : h === "ne" || h === "sw"
                  ? "nesw-resize"
                  : h === "n" || h === "s"
                  ? "ns-resize"
                  : "ew-resize";
              const isHover = hoveredStageHandle === h;
              const isActive = Boolean(stageResizeDraft);
              /**
               * 当たり判定（hit area）。見た目は小さく保ちつつ、
               * ここだけ大きめにしてドラッグできる範囲を広げる。
               */
              const hitSize: CSSProperties = isCorner
                ? { width: 22, height: 22 }
                : h === "n" || h === "s"
                ? { width: 44, height: 18 }
                : { width: 18, height: 44 };
              /** 当たり判定を「辺 / 角」の中心に合わせる位置決め。 */
              const hitPos: CSSProperties = (() => {
                if (isCorner) {
                  const isTop = h === "nw" || h === "ne";
                  const isLeft = h === "nw" || h === "sw";
                  return {
                    ...(isTop ? { top: -11 } : { bottom: -11 }),
                    ...(isLeft ? { left: -11 } : { right: -11 }),
                  };
                }
                if (h === "n")
                  return {
                    top: -9,
                    left: "50%",
                    transform: "translateX(-50%)",
                  };
                if (h === "s")
                  return {
                    bottom: -9,
                    left: "50%",
                    transform: "translateX(-50%)",
                  };
                if (h === "w")
                  return {
                    left: -9,
                    top: "50%",
                    transform: "translateY(-50%)",
                  };
                return {
                  right: -9,
                  top: "50%",
                  transform: "translateY(-50%)",
                };
              })();
              /** 見た目（視覚インジケータ）のサイズ。 */
              const dotSize: CSSProperties = isCorner
                ? {
                    width: isHover || isActive ? 12 : 8,
                    height: isHover || isActive ? 12 : 8,
                  }
                : h === "n" || h === "s"
                ? {
                    width: isHover || isActive ? 24 : 16,
                    height: isHover || isActive ? 8 : 5,
                  }
                : {
                    width: isHover || isActive ? 8 : 5,
                    height: isHover || isActive ? 24 : 16,
                  };
              const label = isCorner
                ? "ステージサイズ変更（Shift で広範囲まで伸ばしやすく）"
                : h === "n" || h === "s"
                ? "ステージ奥行きを変更（Shift で感度アップ）"
                : "ステージ横幅を変更（Shift で感度アップ）";
              /**
               * 通常はステージ枠（#334155）と同系の slate で溶け込ませ、
               * ホバー/ドラッグ中はやや明るくして「触れる」ことをうっすら示す。
               */
              const bg = isActive
                ? "#94a3b8"
                : isHover
                ? "#64748b"
                : "#475569";
              return (
                <div
                  key={`stage-resize-${h}`}
                  role="presentation"
                  aria-label={`${label}（${h}）`}
                  title={
                    isCorner
                      ? "ドラッグでステージ全体のサイズを変更。Shift を押しながらドラッグすると、同じ動きでより大きく伸ばせます（画面外までドラッグ可）"
                      : h === "n" || h === "s"
                      ? "ドラッグで奥行き（前後）だけを変更。Shift で感度アップ"
                      : "ドラッグで横幅（左右）だけを変更。Shift で感度アップ"
                  }
                  onPointerDown={(e) => onStageCornerResizeDown(h, e)}
                  onPointerUp={(e) => {
                    try {
                      (e.currentTarget as HTMLDivElement).releasePointerCapture?.(
                        e.pointerId
                      );
                    } catch {
                      /* noop */
                    }
                  }}
                  onPointerEnter={() => setHoveredStageHandle(h)}
                  onPointerLeave={() =>
                    setHoveredStageHandle((cur) => (cur === h ? null : cur))
                  }
                  style={{
                    position: "absolute",
                    zIndex: 20,
                    ...hitSize,
                    background: "transparent",
                    cursor,
                    touchAction: "none",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...hitPos,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      ...dotSize,
                      borderRadius: 3,
                      background: bg,
                      border: "1px solid #1e293b",
                      boxShadow:
                        isHover || isActive
                          ? "0 1px 4px rgba(0,0,0,0.45)"
                          : "none",
                      opacity: isActive ? 0.95 : isHover ? 0.9 : 0.6,
                      transition:
                        "width 120ms ease, height 120ms ease, background 120ms ease, opacity 120ms ease",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              );
            })}
        </div>
        </div>
        {canStageBulkTools ? (
          <div
            style={{
              flexShrink: 0,
              width: "100%",
              maxWidth: "min(100%, 440px)",
              /** 未選択時は高さを取らずステージを広く。色一括バーがあるときだけ確保 */
              minHeight: reserveStageBulkToolbarHeight ? 88 : 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            {selectedDancerIds.length >= 1 && showStageDancerColorToolbar ? (
              <div
                role="toolbar"
                aria-label="選択した立ち位置の色を一括変更"
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  background: "rgba(15, 23, 42, 0.96)",
                  boxSizing: "border-box",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#94a3b8",
                    whiteSpace: "nowrap",
                  }}
                >
                  選択中 {selectedDancerIds.length} 人の色
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {DANCER_PALETTE.map((hex, i) => (
                    <button
                      key={i}
                      type="button"
                      title={`色を一括で ${i + 1} に変更`}
                      onClick={() =>
                        applyBulkColorToDancerIds(selectedDancerIds, i)
                      }
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        border:
                          primarySelectedDancer &&
                          modDancerColorIndex(primarySelectedDancer.colorIndex) ===
                          i
                            ? "2px solid #fbbf24"
                            : "1px solid #1e293b",
                        background: hex,
                        cursor: "pointer",
                        padding: 0,
                        boxSizing: "border-box",
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
    {stageContextMenu && contextMenuStyle && (
      <div
        ref={stageContextMenuRef}
        style={contextMenuStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {stageContextMenu.kind === "dancer" ? (
          <>
            <div
              style={{
                fontSize: "9px",
                color: "#64748b",
                marginBottom: "5px",
                lineHeight: 1.3,
              }}
            >
              Shift+クリック／範囲ドラッグで複数選択。右クリック印が選択に含まれるときは
              <strong style={{ color: "#94a3b8" }}>選択全員</strong>が対象。
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px",
                marginBottom: "6px",
              }}
            >
              <button
                type="button"
                disabled={
                  viewMode === "view" ||
                  !stageInteractionsEnabled ||
                  Boolean(playbackDancers) ||
                  Boolean(previewDancers)
                }
                title="選択中のメンバーと同じ設定で複製（少し位置をずらす）"
                onClick={() => {
                  if (stageContextMenu.kind !== "dancer") return;
                  const ids = resolveArrangeTargetIds(
                    stageContextMenu.dancerId,
                    selectedDancerIds
                  );
                  duplicateDancerIds(ids);
                }}
                style={{
                  ...btnSecondary,
                  width: "100%",
                  padding: "5px 6px",
                  fontSize: "10px",
                  fontWeight: 600,
                }}
              >
                複製（⌘D）
              </button>
              <button
                type="button"
                disabled={
                  viewMode === "view" ||
                  !stageInteractionsEnabled ||
                  Boolean(playbackDancers) ||
                  Boolean(previewDancers)
                }
                title="右クリック印が選択に含まれるときは選択全員を削除します"
                onClick={() => {
                  if (stageContextMenu.kind !== "dancer") return;
                  const ids = resolveArrangeTargetIds(
                    stageContextMenu.dancerId,
                    selectedDancerIds
                  );
                  if (ids.length === 0) return;
                  const msg =
                    ids.length === 1
                      ? "この立ち位置を削除しますか？"
                      : `選択中の ${ids.length} 人の立ち位置を削除しますか？`;
                  if (!window.confirm(msg)) return;
                  removeDancersByIds(ids);
                }}
                style={{
                  ...btnSecondary,
                  width: "100%",
                  borderColor: "#7f1d1d",
                  color: "#fecaca",
                  padding: "5px 6px",
                  fontSize: "10px",
                  fontWeight: 600,
                }}
              >
                削除
              </button>
            </div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#94a3b8",
                margin: "4px 0 2px",
              }}
            >
              名前の表示（全体）
            </div>
            <div
              style={{
                display: "flex",
                gap: "4px",
                marginBottom: "3px",
              }}
              title="ステージ上のすべての印に共通。ステージまわりの設定でも変更可。"
            >
              <button
                type="button"
                disabled={
                  viewMode === "view" ||
                  !stageInteractionsEnabled ||
                  Boolean(playbackDancers) ||
                  Boolean(previewDancers)
                }
                onClick={() => {
                  setProject((p) => ({ ...p, dancerLabelPosition: "inside" }));
                }}
                style={{
                  flex: 1,
                  padding: "4px 6px",
                  borderRadius: "6px",
                  border:
                    (rawDancerLabelPosition ?? "inside") === "inside"
                      ? "1px solid rgba(99,102,241,0.9)"
                      : "1px solid #334155",
                  background:
                    (rawDancerLabelPosition ?? "inside") === "inside"
                      ? "rgba(99,102,241,0.22)"
                      : "#020617",
                  color:
                    (rawDancerLabelPosition ?? "inside") === "inside"
                      ? "#e0e7ff"
                      : "#94a3b8",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor:
                    viewMode === "view" ||
                    !stageInteractionsEnabled ||
                    playbackDancers ||
                    previewDancers
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                丸の内
              </button>
              <button
                type="button"
                disabled={
                  viewMode === "view" ||
                  !stageInteractionsEnabled ||
                  Boolean(playbackDancers) ||
                  Boolean(previewDancers)
                }
                onClick={() => {
                  setProject((p) => ({ ...p, dancerLabelPosition: "below" }));
                }}
                style={{
                  flex: 1,
                  padding: "4px 6px",
                  borderRadius: "6px",
                  border:
                    rawDancerLabelPosition === "below"
                      ? "1px solid rgba(99,102,241,0.9)"
                      : "1px solid #334155",
                  background:
                    rawDancerLabelPosition === "below"
                      ? "rgba(99,102,241,0.22)"
                      : "#020617",
                  color:
                    rawDancerLabelPosition === "below"
                      ? "#e0e7ff"
                      : "#94a3b8",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor:
                    viewMode === "view" ||
                    !stageInteractionsEnabled ||
                    playbackDancers ||
                    previewDancers
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                丸の下
              </button>
            </div>
            <div
              style={{
                fontSize: "8px",
                color: "#64748b",
                marginBottom: "5px",
                lineHeight: 1.3,
              }}
            >
              「丸の下」時は印には番号などのみ（下の「丸の内」で指定）。
            </div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#94a3b8",
                margin: "2px 0 2px",
              }}
            >
              印の色（選択に一括）
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "3px",
                marginBottom: "5px",
              }}
            >
              {DANCER_PALETTE.map((hex, i) => (
                <button
                  key={`cm-color-${i}`}
                  type="button"
                  title={`色 ${i + 1} に一括変更`}
                  onClick={() => {
                    if (stageContextMenu.kind !== "dancer") return;
                    const ids = resolveArrangeTargetIds(
                      stageContextMenu.dancerId,
                      selectedDancerIds
                    );
                    applyBulkColorToDancerIds(ids, i);
                    setStageContextMenu(null);
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    border: "1px solid #1e293b",
                    background: hex,
                    cursor: "pointer",
                    padding: 0,
                    boxSizing: "border-box",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#94a3b8",
                margin: "2px 0 2px",
              }}
            >
              丸の内（名前を丸の下のとき）
            </div>
            {dancerLabelBelow ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "3px",
                  marginBottom: "5px",
                }}
              >
                <button
                  type="button"
                  disabled={
                    viewMode === "view" ||
                    !stageInteractionsEnabled ||
                    Boolean(playbackDancers) ||
                    Boolean(previewDancers)
                  }
                  style={{
                    ...btnSecondary,
                    width: "100%",
                    fontSize: "9px",
                    padding: "4px 4px",
                    textAlign: "center",
                  }}
                  title="丸の内を空に（連番も出しません）"
                  onClick={() => {
                    if (stageContextMenu.kind !== "dancer") return;
                    const ids = resolveArrangeTargetIds(
                      stageContextMenu.dancerId,
                      selectedDancerIds
                    );
                    if (ids.length === 0) return;
                    applyBulkMarkerClear(ids);
                    setStageContextMenu(null);
                  }}
                >
                  空白
                </button>
                <button
                  type="button"
                  disabled={
                    viewMode === "view" ||
                    !stageInteractionsEnabled ||
                    Boolean(playbackDancers) ||
                    Boolean(previewDancers)
                  }
                  style={{
                    ...btnSecondary,
                    width: "100%",
                    fontSize: "9px",
                    padding: "4px 4px",
                    textAlign: "center",
                  }}
                  title="並び順で連番を丸の内に"
                  onClick={() => {
                    if (stageContextMenu.kind !== "dancer") return;
                    const ids = resolveArrangeTargetIds(
                      stageContextMenu.dancerId,
                      selectedDancerIds
                    );
                    const raw = window.prompt(
                      "連番の開始番号（整数）。フォーメーション順で丸の内に入れます。",
                      "1"
                    );
                    if (raw == null || raw.trim() === "") return;
                    const v = Number.parseInt(raw.trim(), 10);
                    if (!Number.isFinite(v)) {
                      window.alert("整数として読めませんでした。");
                      return;
                    }
                    applyBulkMarkerSequence(ids, v);
                    setStageContextMenu(null);
                  }}
                >
                  連番…
                </button>
                <button
                  type="button"
                  disabled={
                    viewMode === "view" ||
                    !stageInteractionsEnabled ||
                    Boolean(playbackDancers) ||
                    Boolean(previewDancers)
                  }
                  style={{
                    ...btnSecondary,
                    width: "100%",
                    fontSize: "9px",
                    padding: "4px 4px",
                    textAlign: "center",
                  }}
                  title="全員同じ文字（最大3文字）"
                  onClick={() => {
                    if (stageContextMenu.kind !== "dancer") return;
                    const ids = resolveArrangeTargetIds(
                      stageContextMenu.dancerId,
                      selectedDancerIds
                    );
                    const raw = window.prompt(
                      "全員の丸の内を同じ内容に（最大3文字）。",
                      "1"
                    );
                    if (raw == null || raw.trim() === "") return;
                    applyBulkMarkerSame(ids, raw);
                    setStageContextMenu(null);
                  }}
                >
                  同じ…
                </button>
              </div>
            ) : (
              <div
                style={{
                  fontSize: "8px",
                  color: "#64748b",
                  marginBottom: "5px",
                  lineHeight: 1.3,
                }}
              >
                「丸の下」を選ぶと空白・連番・同じを指定できます。
              </div>
            )}
            <div
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#94a3b8",
                margin: "3px 0 1px",
              }}
            >
              位置のまま入替（2人以上）
            </div>
            <div
              style={{
                fontSize: "8px",
                color: "#64748b",
                marginBottom: "3px",
                lineHeight: 1.25,
              }}
            >
              印の形は変えず、身長・学年・スキル順に人だけ割当。
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "3px",
                marginBottom: "5px",
              }}
            >
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                title="身長の低い順で位置を割り当て"
                onClick={() => applyPermuteArrange(permuteSlotsByHeightAsc)}
              >
                身長 低→高
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                title="身長の高い順で位置を割り当て"
                onClick={() => applyPermuteArrange(permuteSlotsByHeightDesc)}
              >
                身長 高→低
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                title="学年が若い順で位置を割り当て"
                onClick={() => applyPermuteArrange(permuteSlotsByGradeAsc)}
              >
                学年 低→高
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                title="学年が高い順で位置を割り当て"
                onClick={() => applyPermuteArrange(permuteSlotsByGradeDesc)}
              >
                学年 高→低
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                title="スキル数字が小さい順で位置を割り当て"
                onClick={() => applyPermuteArrange(permuteSlotsBySkillAsc)}
              >
                スキル 小→大
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                title="スキル数字が大きい順で位置を割り当て"
                onClick={() => applyPermuteArrange(permuteSlotsBySkillDesc)}
              >
                スキル 大→小
              </button>
            </div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#94a3b8",
                margin: "2px 0 1px",
              }}
            >
              位置の入れ替え（2人以上）
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "3px",
                marginBottom: "5px",
              }}
            >
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                onClick={() => {
                  const ids = resolveArrangeTargetIds(
                    stageContextMenu.dancerId,
                    selectedDancerIds
                  );
                  if (ids.length < 2) {
                    window.alert("右回りの入れ替えは、対象を 2 人以上選んでください。");
                    setStageContextMenu(null);
                    return;
                  }
                  applyDancerArrange((dancers, t) =>
                    rotateDancerRingOneStep(dancers, t, "cw")
                  );
                }}
              >
                右回り 1 人
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                onClick={() => {
                  const ids = resolveArrangeTargetIds(
                    stageContextMenu.dancerId,
                    selectedDancerIds
                  );
                  if (ids.length < 2) {
                    window.alert("左回りの入れ替えは、対象を 2 人以上選んでください。");
                    setStageContextMenu(null);
                    return;
                  }
                  applyDancerArrange((dancers, t) =>
                    rotateDancerRingOneStep(dancers, t, "ccw")
                  );
                }}
              >
                左回り 1 人
              </button>
            </div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#94a3b8",
                margin: "2px 0 1px",
              }}
            >
              横一列（選択枠内）
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "3px",
                marginBottom: "5px",
              }}
            >
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                onClick={() => applyDancerArrange(lineUpByHeightAsc)}
              >
                身長 低→高
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                onClick={() => applyDancerArrange(lineUpByHeightDesc)}
              >
                身長 高→低
              </button>
            </div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#94a3b8",
                margin: "2px 0 1px",
              }}
            >
              学年（横一列）
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "3px",
                marginBottom: "5px",
              }}
            >
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                title="学年が低い順（若い順）で並べる"
                onClick={() => applyDancerArrange(lineUpByGradeAsc)}
              >
                低（若）→高
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                onClick={() => applyDancerArrange(lineUpByGradeDesc)}
              >
                高→低
              </button>
            </div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#94a3b8",
                margin: "2px 0 1px",
              }}
            >
              スキル縦一列（奥＝上・手前＝客席）
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "3px",
                marginBottom: "2px",
              }}
            >
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                title="スキル数字が小さい人を奥へ（縦一列）"
                onClick={() => applyDancerArrange(lineUpBySkillSmallToBack)}
              >
                小→奥
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  width: "100%",
                  fontSize: "9px",
                  padding: "4px 5px",
                  textAlign: "center",
                }}
                title="スキル数字が大きい人を奥へ（縦一列）"
                onClick={() => applyDancerArrange(lineUpBySkillLargeToBack)}
              >
                大→奥
              </button>
            </div>
          </>
        ) : stageContextMenu.kind === "floorText" ? (
          <>
            <div
              style={{
                fontSize: "9px",
                color: "#94a3b8",
                marginBottom: "6px",
                lineHeight: 1.35,
              }}
            >
              床に置いたテキスト
            </div>
            <button
              type="button"
              disabled={
                viewMode === "view" ||
                !setPiecesEditable ||
                Boolean(playbackDancers) ||
                Boolean(previewDancers)
              }
              style={{
                ...btnSecondary,
                width: "100%",
                borderColor: "#7f1d1d",
                color: "#fecaca",
                fontWeight: 600,
                fontSize: "11px",
                padding: "6px 8px",
              }}
              onClick={() => {
                if (stageContextMenu.kind !== "floorText") return;
                removeFloorMarkupById(stageContextMenu.markupId);
                setStageContextMenu(null);
              }}
            >
              テキストを削除
            </button>
          </>
        ) : (
          <button
            type="button"
            style={{
              ...btnSecondary,
              width: "100%",
              borderColor: "#7f1d1d",
              color: "#fecaca",
              fontWeight: 600,
            }}
            onClick={() => {
              removeSetPieceById(stageContextMenu.pieceId);
            }}
          >
            削除
          </button>
        )}
      </div>
    )}
    {floorTextInlineRect &&
    floorTextEditId === floorTextInlineRect.id &&
    typeof document !== "undefined"
      ? createPortal(
          <textarea
            autoFocus
            aria-label="床テキストをその場で編集"
            value={floorTextDraft.body}
            onChange={(e) => {
              const body = e.target.value;
              setFloorTextDraft((d) => ({ ...d, body }));
              const id = floorTextInlineRect.id;
              updateActiveFormation((f) => ({
                ...f,
                floorMarkup: (f.floorMarkup ?? []).map((x) =>
                  x.id === id && x.kind === "text"
                    ? { ...x, text: body.slice(0, 400) }
                    : x
                ),
              }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setFloorMarkupTool(null);
              }
            }}
            onBlur={() => {
              setFloorMarkupTool(null);
            }}
            style={{
              position: "fixed",
              left: floorTextInlineRect.left,
              top: floorTextInlineRect.top,
              width: floorTextInlineRect.width,
              minHeight: floorTextInlineRect.height,
              zIndex: 100000,
              boxSizing: "border-box",
              margin: 0,
              padding: "4px 8px",
              borderRadius: 6,
              border: "2px solid rgba(129, 140, 248, 0.95)",
              background: "rgba(15, 23, 42, 0.97)",
              color: floorTextDraftColorHex(floorTextDraft.color),
              fontFamily: floorTextDraft.fontFamily,
              fontSize: floorTextDraft.fontSizePx,
              fontWeight: floorTextDraft.fontWeight,
              lineHeight: 1.25,
              resize: "both",
              textShadow:
                "0 0 2px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.65)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          />,
          document.body
        )
      : null}
    <DancerQuickEditDialog
      open={Boolean(dancerQuickEditId && quickEditDancerForDialog)}
      dancer={quickEditDancerForDialog}
      viewMode={viewMode}
      onClose={() => setDancerQuickEditId(null)}
      onApply={applyDancerQuickEdit}
    />
    </>
  );
}
