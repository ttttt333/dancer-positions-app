import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  SetPiece,
} from "../types/choreography";
import { audienceRotationDeg } from "../lib/projectDefaults";
import {
  formatMeterCmLabel,
  formatStageMmSummary,
  mmToMeterCm,
} from "../lib/stageDimensions";

const DANCER_LABEL_MAX = 8;
/** ドラッグ中、この y% 以上で下端ゴミ箱 UI を出す（客席＝下が大きい y） */
const TRASH_REVEAL_Y_PCT = 88;

const DANCER_PALETTE = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#2dd4bf",
  "#e879f9",
  /** 写真の既定マルに近い白 */
  "#f8fafc",
] as const;

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
  /** 再生中にステージ床（ダンサー以外）を押したら停止（§5） */
  isPlaying?: boolean;
  onStopPlaybackRequest?: () => void;
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

const MARKER_PX_MIN = 20;
const MARKER_PX_MAX = 120;

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

/** 群リサイズのハンドル方向からスケーリング係数と不動点（アンカー）を求める */
function groupScaleForHandle(
  handle: GroupBoxHandle,
  startBox: { x0: number; y0: number; x1: number; y1: number },
  newX: number,
  newY: number,
  keepAspect: boolean
): { sx: number; sy: number; ax: number; ay: number } {
  const wx = Math.max(0.01, startBox.x1 - startBox.x0);
  const wy = Math.max(0.01, startBox.y1 - startBox.y0);
  /** 画面上の端 → スケール対象の辺を動かす。反対辺はアンカー（固定） */
  let ax = (startBox.x0 + startBox.x1) / 2;
  let ay = (startBox.y0 + startBox.y1) / 2;
  let sx = 1;
  let sy = 1;
  const touchesN = handle.includes("n");
  const touchesS = handle.includes("s");
  const touchesW = handle.includes("w");
  const touchesE = handle.includes("e");
  if (touchesE) {
    ax = startBox.x0;
    sx = Math.max(0.05, (newX - startBox.x0) / wx);
  } else if (touchesW) {
    ax = startBox.x1;
    sx = Math.max(0.05, (startBox.x1 - newX) / wx);
  }
  if (touchesS) {
    ay = startBox.y0;
    sy = Math.max(0.05, (newY - startBox.y0) / wy);
  } else if (touchesN) {
    ay = startBox.y1;
    sy = Math.max(0.05, (startBox.y1 - newY) / wy);
  }
  if (!touchesE && !touchesW) sx = keepAspect ? sy : 1;
  if (!touchesN && !touchesS) sy = keepAspect ? sx : 1;
  if (keepAspect && (touchesE || touchesW) && (touchesN || touchesS)) {
    const s = Math.max(sx, sy);
    sx = s;
    sy = s;
  }
  return { sx, sy, ax, ay };
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
  isPlaying = false,
  onStopPlaybackRequest,
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
    viewMode,
    dancerMarkerDiameterPx,
    dancerMarkerDiameterMm,
    hanamichiEnabled: hanamichiEnabledRaw,
    hanamichiDepthPct: hanamichiDepthRaw,
  } = project;
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
   *    px スライダーの既定値（`DEFAULT_MARKER_DIAMETER_PX = 44`）からユーザーが
   *    動かしていない場合のみ自動連動を優先する。動かしている（＝明示指定）なら
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
    const pxRaw = Math.round(dancerMarkerDiameterPx ?? 44);
    /**
     * スライダーの既定値 44 のままならユーザーは px を明示していないと見なし、
     * ステージ幅に連動する自動サイズを採用する（写真のような按配になる目安）。
     */
    const isDefaultPx = pxRaw === 44;
    if (
      isDefaultPx &&
      typeof stageWidthMm === "number" &&
      stageWidthMm > 0 &&
      mainFloorPxWidth > 0
    ) {
      /** ステージ幅の 4%。min 25cm / max 120cm で常識的な範囲にクランプ。 */
      const implicitMm = Math.max(250, Math.min(1200, stageWidthMm * 0.04));
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
  /** サイズドラッグ中は draft 値を即時反映して手応えを出す（ドラッグ終了時に確定） */
  const trashDockRef = useRef<HTMLDivElement>(null);
  const stageContextMenuRef = useRef<HTMLDivElement>(null);
  const trashHotRef = useRef(false);
  const dragRef = useRef<{
    dancerId: string;
    offsetXPx: number;
    offsetYPx: number;
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

  const [editingDancerId, setEditingDancerId] = useState<string | null>(null);
  /**
   * ステージ上で選択中のダンサー ID（複数可）。
   * - 1 件なら Alt+矢印で微移動できる（従来の microNudgeDancerId の役割）。
   * - 2 件以上ならステージに枠が出て、8 ハンドルで群全体を比率スケールできる。
   * - 1 件以上なら代表ダンサーの右下に小さなハンドルが出て、○の直径を変更できる。
   */
  const [selectedDancerIds, setSelectedDancerIds] = useState<string[]>([]);
  const [selectedSetPieceId, setSelectedSetPieceId] = useState<string | null>(null);
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

  /** ゴミ箱ドロップゾーン上でダンサーをドラッグ中 */
  const [trashHot, setTrashHot] = useState(false);
  /** マルを下端付近まで下げたときだけゴミ箱 UI を出す */
  const [trashUiVisible, setTrashUiVisible] = useState(false);
  const trashRevealActiveRef = useRef(false);
  /** ステージ上の右クリックメニュー（ダンサー / 大道具） */
  const [stageContextMenu, setStageContextMenu] = useState<
    | { kind: "dancer"; clientX: number; clientY: number; dancerId: string }
    | { kind: "setPiece"; clientX: number; clientY: number; pieceId: string }
    | null
  >(null);
  const [editingLabelDraft, setEditingLabelDraft] = useState("");
  const skipLabelCommitRef = useRef(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const formationIdForWrites =
    editFormationId != null && formations.some((f) => f.id === editFormationId)
      ? editFormationId
      : activeFormationId;

  useEffect(() => {
    setEditingDancerId(null);
    setSelectedDancerIds([]);
    setStageContextMenu(null);
    setSelectedSetPieceId(null);
    setMarquee(null);
    marqueeSessionRef.current = null;
    groupDragRef.current = null;
    markerResizeRef.current = null;
    setMarkerDiamDraft(null);
  }, [formationIdForWrites]);

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

  useLayoutEffect(() => {
    if (!editingDancerId) return;
    const el = labelInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingDancerId]);

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

  const displaySetPieces: SetPiece[] =
    previewDancers != null && previewDancers.length > 0
      ? writeFormation?.setPieces ?? []
      : playbackSetPieces ??
        browseSetPieces ??
        writeFormation?.setPieces ??
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
      setEditingDancerId((id) => (id === dancerId ? null : id));
      setStageContextMenu(null);
    },
    [writeFormation, updateActiveFormation, viewMode, stageInteractionsEnabled]
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
      const newOuterWmm = (s.outerWmm0 * newCssW) / Math.max(1, s.W0css);
      const newOuterDmm = (s.outerDmm0 * newCssH) / Math.max(1, s.H0css);
      let newW = Math.round(newOuterWmm - 2 * s.Smm);
      let newD = Math.round(newOuterDmm - s.Bmm);
      newW = Math.min(60000, Math.max(2000, newW));
      newD = Math.min(60000, Math.max(2000, newD));
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
      setEditingDancerId((id) => (id != null && removeSet.has(id) ? null : id));
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
    (v: number, mode: SnapMode) => {
      const c = clamp(v, 2, 98);
      if (mode === "free" || !snapGrid) return round2(c);
      const step =
        mode === "fine" ? Math.max(0.25, gridStep / 4) : gridStep;
      return round2(clamp(Math.round(c / step) * step, 2, 98));
    },
    [snapGrid, gridStep]
  );

  const pxToPct = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      const el = stageMainFloorRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const xPct = ((clientX - r.left) / r.width) * 100;
      const yPct = ((clientY - r.top) / r.height) * 100;
      const mode: SnapMode = snapGrid ? (shiftKey ? "fine" : "grid") : "free";
      return {
        xPct: quantizeCoord(xPct, mode),
        yPct: quantizeCoord(yPct, mode),
      };
    },
    [snapGrid, quantizeCoord]
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
      const snapDim = (v: number) => {
        let c = clamp(v, 0, 100);
        if (snapGrid) {
          const step = e.shiftKey
            ? Math.max(0.25, gridStep / 4)
            : gridStep;
          c = clamp(Math.round(c / step) * step, 0, 100);
        }
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
      let xPct = snapDim(raw.xPct);
      let yPct = snapDim(raw.yPct);
      let wPct = snapDim(raw.wPct);
      let hPct = snapDim(raw.hPct);
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
  }, [pxToPct, snapGrid, gridStep, updateActiveFormation]);

  const handlePointerDownDancer = (
    e: ReactPointerEvent,
    dancerId: string,
    xPct: number,
    yPct: number
  ) => {
    if (e.button !== 0) return;
    if (editingDancerId) return;
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
      };
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
    if (target.closest("[data-marker-resize-handle]")) return;
    const el = stageMainFloorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const xPct = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
    const yPct = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
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
      /** 4: 代表ダンサー右下の○サイズハンドル（選択中の全員に同じ差分を適用） */
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
      /** 5: マーキー（範囲選択） */
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
      const d = dragRef.current;
      if (d && hitTrashDropZone(e.clientX, e.clientY)) {
        removeDancerById(d.dancerId);
      }
      dragRef.current = null;
      /** 群ドラッグ終了。move モードで最後にゴミ箱へドロップされていたら一括削除 */
      const gUp = groupDragRef.current;
      if (
        gUp &&
        gUp.mode === "move" &&
        hitTrashDropZone(e.clientX, e.clientY)
      ) {
        removeDancersByIds(gUp.ids);
      }
      groupDragRef.current = null;
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
    setTrashHotIfChanged,
    markerDiamDraft,
    setProject,
    writeFormation,
    activeFormation,
    computeAlignmentSnap,
    alignGuides.x,
    alignGuides.y,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (viewMode === "view") return;
      if (playbackDancers || previewDancers) return;
      if (editingDancerId) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        setSelectedDancerIds([]);
        setMarquee(null);
        marqueeSessionRef.current = null;
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
          xPct: quantizeCoord(nx, mode),
          yPct: quantizeCoord(ny, mode),
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
    editingDancerId,
    selectedDancerIds,
    snapGrid,
    quantizeCoord,
    updateActiveFormation,
  ]);

  /** 客席の辺に応じた向きに、さらに 180° 回して「舞台の正面」を反対側から見る */
  const rot = (audienceRotationDeg(audienceEdge) + 180) % 360;

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

  const stripShellStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    fontSize: "10px",
    lineHeight: 1.35,
    color: "#64748b",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #0f172a 100%)",
    border: "1px solid rgba(71,85,105,0.35)",
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
    background:
      "linear-gradient(180deg, #1e293b 0%, #0f172a 55%, #020617 100%)",
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
      if (d.xPct < x0) x0 = d.xPct;
      if (d.yPct < y0) y0 = d.yPct;
      if (d.xPct > x1) x1 = d.xPct;
      if (d.yPct > y1) y1 = d.yPct;
    }
    if (
      !Number.isFinite(x0) ||
      !Number.isFinite(y0) ||
      !Number.isFinite(x1) ||
      !Number.isFinite(y1)
    )
      return null;
    return { x0, y0, x1, y1 };
  }, [selectedDancerIds, writeFormation, activeFormation, playbackOrPreview, viewMode]);

  /** 選択中の代表ダンサー（先頭）の座標。○サイズハンドルをその右下に置く。 */
  const primarySelectedDancer = useMemo(() => {
    if (playbackOrPreview) return null;
    if (viewMode === "view") return null;
    if (!stageInteractionsEnabled) return null;
    if (selectedDancerIds.length < 1) return null;
    const ds = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
    const id = selectedDancerIds[0]!;
    return ds.find((x) => x.id === id) ?? null;
  }, [
    selectedDancerIds,
    writeFormation,
    activeFormation,
    playbackOrPreview,
    viewMode,
    stageInteractionsEnabled,
  ]);

  let contextMenuStyle: CSSProperties | null = null;
  if (stageContextMenu) {
    const pad = 8;
    const mw = 132;
    const mh = 52;
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
      padding: "6px",
      borderRadius: "10px",
      border: "1px solid #475569",
      background: "#0f172a",
      boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    };
  }

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}>
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
            fontSize: "10px",
            color: stageResizeDraft ? "#fbbf24" : "#94a3b8",
            textAlign: "center",
            lineHeight: 1.45,
          }}
        >
          {formatStageMmSummary(effStageWidthMm, effStageDepthMm)}
          {(Smm > 0 || Bmm > 0 || (centerFieldGuideIntervalMm != null && centerFieldGuideIntervalMm > 0)) && (
            <div style={{ marginTop: "4px", fontSize: "9px", color: "#64748b" }}>
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
          minHeight: "280px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          /**
           * ステージ枠のリサイズハンドル（左右・上下）が枠より外に
           * わずかに飛び出して配置されるため、padding で隠れないよう
           * 少しだけ外側に余白を確保する。
           */
          padding: "12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "640px",
            aspectRatio: stageAspectRatio,
            transform: `rotate(${rot}deg)`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease, aspect-ratio 0.2s ease",
          }}
        >
          <div
            id="stage-export-root"
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              borderRadius: "12px",
              border: "1px solid #334155",
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
                      background: "#020617",
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
                  borderBottom: "1px solid #334155",
                }}
              >
                バックステージ
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
                  borderRight: "1px solid #334155",
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
            {snapGrid && (
              <svg
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  opacity: 0.35,
                }}
                preserveAspectRatio="none"
              >
                {Array.from(
                  { length: Math.floor(100 / gridStep) + 1 },
                  (_, i) => i * gridStep
                ).map((g) => (
                  <g key={g}>
                    <line
                      x1={`${g}%`}
                      y1="0%"
                      x2={`${g}%`}
                      y2="100%"
                      stroke="#475569"
                      strokeWidth="0.5"
                    />
                    <line
                      x1="0%"
                      y1={`${g}%`}
                      x2="100%"
                      y2={`${g}%`}
                      stroke="#475569"
                      strokeWidth="0.5"
                    />
                  </g>
                ))}
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
              <line
                x1="50"
                y1="0"
                x2="50"
                y2="100"
                stroke="rgba(248, 250, 252, 0.28)"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                stroke="rgba(248, 250, 252, 0.28)"
                strokeWidth="0.35"
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
                background: "#ef4444",
                boxShadow: "0 0 0 1px rgba(15,23,42,0.75)",
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
                  "linear-gradient(180deg, transparent, rgba(15,23,42,0.85))",
                borderTop: "1px solid rgba(71,85,105,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                color: "#64748b",
                pointerEvents: "none",
                zIndex: 3,
              }}
            >
              観客席
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
                  border: "1px dashed rgba(167, 139, 250, 0.9)",
                  borderRadius: 4,
                  background: "rgba(99, 102, 241, 0.07)",
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
                      width: 11,
                      height: 11,
                      borderRadius: 2,
                      background: "rgba(167, 139, 250, 0.95)",
                      border: "1px solid #0f172a",
                      zIndex: 7,
                      boxSizing: "border-box",
                      touchAction: "none",
                      pointerEvents: "auto",
                      cursor,
                      ...pos,
                    }}
                  />
                ))}
              </div>
            )}
            {displayDancers.map((d) => {
              const dMarkerPx = effectiveMarkerPx(d);
              const dLabelFontPx = Math.max(
                10,
                Math.min(22, Math.round(14 * (dMarkerPx / 44)))
              );
              return (
              <button
                key={d.id}
                type="button"
                data-dancer-id={d.id}
                title={
                  !playbackOrPreview
                    ? [
                        mmLabel(d.xPct, d.yPct),
                        "ダブルクリックで名前編集",
                        "右クリックで削除メニュー",
                        "下端へ寄せるとゴミ箱が出ます。そこへドロップで削除",
                        "Shift / Cmd / Ctrl+クリックで複数選択に追加",
                        "空のステージをドラッグで範囲選択",
                        snapGrid ? "Shift+ドラッグで細かいグリッドにスナップ" : null,
                        "Alt+矢印で微移動（Shift+Altでさらに細かく）",
                        "Alt+クリックで重なった印の背面へ切替（§10）",
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
                  setEditingLabelDraft(
                    (d.label?.trim() ? d.label : "?").slice(0, DANCER_LABEL_MAX)
                  );
                  setEditingDancerId(d.id);
                }}
                style={{
                  position: "absolute",
                  left: `${d.xPct}%`,
                  top: `${d.yPct}%`,
                  transform: playbackOrPreview
                    ? "translate3d(-50%, -50%, 0)"
                    : "translate(-50%, -50%)",
                  willChange: playbackOrPreview ? "transform" : undefined,
                  width: `${dMarkerPx}px`,
                  height: `${dMarkerPx}px`,
                  borderRadius: "50%",
                  border:
                    editingDancerId === d.id
                      ? "2px solid rgba(99,102,241,0.95)"
                      : selectedDancerIds.includes(d.id)
                        ? selectedDancerIds.length >= 2
                          ? "2px solid rgba(167,139,250,0.95)"
                          : "2px solid rgba(251,191,36,0.92)"
                        : "2px solid rgba(255,255,255,0.35)",
                  backgroundColor:
                    DANCER_PALETTE[d.colorIndex % DANCER_PALETTE.length],
                  color: "#0f172a",
                  fontWeight: 700,
                  fontSize: `${dLabelFontPx}px`,
                  cursor:
                    editingDancerId === d.id
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
                  zIndex: 4,
                  pointerEvents:
                    viewMode === "view" ||
                    playbackDancers ||
                    previewDancers ||
                    !stageInteractionsEnabled
                      ? "none"
                      : "auto",
                }}
              >
                {editingDancerId === d.id ? (
                  <input
                    ref={labelInputRef}
                    type="text"
                    value={editingLabelDraft}
                    maxLength={DANCER_LABEL_MAX}
                    aria-label="ダンサー名"
                    onChange={(e) =>
                      setEditingLabelDraft(e.target.value.slice(0, DANCER_LABEL_MAX))
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => {
                      if (skipLabelCommitRef.current) {
                        skipLabelCommitRef.current = false;
                        setEditingDancerId(null);
                        return;
                      }
                      if (viewMode === "view") {
                        setEditingDancerId(null);
                        return;
                      }
                      const label =
                        editingLabelDraft.trim().slice(0, DANCER_LABEL_MAX) || "?";
                      const dancerId = d.id;
                      setProject((p) => {
                        const fid = formationIdForWrites;
                        const form = p.formations.find((f) => f.id === fid);
                        const spot = form?.dancers.find((x) => x.id === dancerId);
                        if (!form || !spot) return p;
                        const cmid = spot.crewMemberId;
                        let crews = p.crews;
                        if (cmid) {
                          crews = p.crews.map((crew) => ({
                            ...crew,
                            members: crew.members.map((m) =>
                              m.id === cmid ? { ...m, label } : m
                            ),
                          }));
                        }
                        return {
                          ...p,
                          crews,
                          formations: p.formations.map((f) =>
                            f.id === fid
                              ? {
                                  ...f,
                                  dancers: f.dancers.map((x) =>
                                    x.id === dancerId ? { ...x, label } : x
                                  ),
                                }
                              : f
                          ),
                        };
                      });
                      setEditingDancerId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") {
                        skipLabelCommitRef.current = true;
                        setEditingDancerId(null);
                      }
                    }}
                    style={{
                      width: `${Math.max(28, Math.round(dMarkerPx * 0.82))}px`,
                      padding: "0 2px",
                      margin: 0,
                      border: "none",
                      borderRadius: "4px",
                      background: "rgba(255,255,255,0.92)",
                      color: "#0f172a",
                      fontSize: `${Math.max(9, Math.min(14, dLabelFontPx - 2))}px`,
                      fontWeight: 700,
                      textAlign: "center",
                      lineHeight: 1.1,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                ) : (
                  d.label || "?"
                )}
              </button>
              );
            })}
            {primarySelectedDancer && !marquee && (() => {
              const pMarkerPx = effectiveMarkerPx(primarySelectedDancer);
              const tip =
                selectedDancerIds.length >= 2
                  ? `選択中の ${selectedDancerIds.length} 人の ○ サイズを一括変更（現 ${pMarkerPx}px・ドラッグで変更）`
                  : `○のサイズ（${pMarkerPx}px）・ドラッグで変更`;
              return (
              <div
                data-marker-resize-handle
                role="presentation"
                aria-hidden
                title={tip}
                onPointerDown={handlePointerDownMarkerResize}
                style={{
                  position: "absolute",
                  left: `${primarySelectedDancer.xPct}%`,
                  top: `${primarySelectedDancer.yPct}%`,
                  /** ○の右下 45° 外側にオフセット（pMarkerPx/2 + ちょい余白） */
                  transform: `translate(calc(${pMarkerPx * 0.35}px), calc(${
                    pMarkerPx * 0.35
                  }px))`,
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: "#fbbf24",
                  border: "1px solid #0f172a",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                  cursor: "nwse-resize",
                  touchAction: "none",
                  zIndex: 9,
                  pointerEvents: "auto",
                  boxSizing: "border-box",
                }}
              />
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
                  borderLeft: "1px solid #334155",
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
                aria-label="ダンサーの印をここにドラッグして離すと削除されます"
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
                <span>ドラッグ＆ドロップで削除</span>
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
                ? "ステージサイズ変更"
                : h === "n" || h === "s"
                ? "ステージ奥行きを変更"
                : "ステージ横幅を変更";
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
                      ? "ドラッグでステージ全体のサイズを変更"
                      : h === "n" || h === "s"
                      ? "ドラッグで奥行き（前後）だけを変更"
                      : "ドラッグで横幅（左右）だけを変更"
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
    </div>
    {stageContextMenu && contextMenuStyle && (
      <div ref={stageContextMenuRef} style={contextMenuStyle}>
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
            if (stageContextMenu.kind === "dancer") {
              removeDancerById(stageContextMenu.dancerId);
            } else {
              removeSetPieceById(stageContextMenu.pieceId);
            }
          }}
        >
          削除
        </button>
      </div>
    )}
    </>
  );
}

export const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #4f46e5, #ec4899)",
  color: "white",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #475569",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  fontSize: "13px",
  cursor: "pointer",
};
