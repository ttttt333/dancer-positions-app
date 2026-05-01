import type { CSSProperties } from "react";
import type { DancerSpot, SetPiece, StageFloorTextMarkup } from "../types/choreography";
import { DEFAULT_DANCER_MARKER_DIAMETER_PX } from "./projectDefaults";
import {
  formatCenterDistanceCmFine,
  rawHorizontalDistanceFromStageCenterMm,
} from "./dancerSpacing";
import { sliceMarkerBadgeForStorage } from "./markerBadge";

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function round2(v: number) {
  return Math.round(v * 100) / 100;
}

export function floorTextLayer(m: StageFloorTextMarkup): "stage" | "screen" {
  return m.layer === "screen" ? "screen" : "stage";
}

export function resolveSetPieceFill(p: SetPiece): string {
  const c = p.fillColor?.trim();
  if (c && /^#[0-9a-fA-F]{6}$/i.test(c)) return c.toLowerCase();
  return "#475569";
}

export function setPieceKindJa(kind: SetPiece["kind"]): string {
  if (kind === "ellipse") return "円・楕円";
  if (kind === "triangle") return "三角";
  return "矩形";
}

export function setPieceLayer(p: SetPiece): "stage" | "screen" {
  return p.layer === "screen" ? "screen" : "stage";
}

export function setPieceRotationDegDisplay(p: SetPiece): number {
  const r = p.rotationDeg;
  return typeof r === "number" && Number.isFinite(r) ? r : 0;
}

export function getSetPieceCoordRoot(
  p: SetPiece,
  stageMainFloor: HTMLElement | null,
  viewportOverlay: HTMLElement | null
): HTMLElement | null {
  if (setPieceLayer(p) === "screen") {
    return viewportOverlay ?? stageMainFloor;
  }
  return stageMainFloor;
}

/** §10 大道具矩形のリサイズ（ハンドル別） */
export type SetPieceResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
/** 複数選択されたダンサー群を囲む枠のリサイズハンドル */
export type GroupBoxHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const MIN_SET_PIECE_W_PCT = 2.5;
export const MIN_SET_PIECE_H_PCT = 2.5;

export type FloorTextCornerHandle = "nw" | "ne" | "sw" | "se";

export const FLOOR_TEXT_DEFAULT_COLOR = "#fef08a";
export const FLOOR_TEXT_DEFAULT_FONT =
  "system-ui, -apple-system, 'Segoe UI', sans-serif";

export const FLOOR_TEXT_FONT_OPTIONS: readonly { id: string; label: string; value: string }[] =
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
    {
      id: "rounded",
      label: "丸ゴシック",
      value:
        "'Hiragino Maru Gothic ProN', 'Yu Marui Gothic', 'Hiragino Sans', sans-serif",
    },
    {
      id: "yugothic",
      label: "游ゴシック",
      value: "'Yu Gothic UI', 'Yu Gothic', 'Meiryo UI', Meiryo, sans-serif",
    },
    {
      id: "meiryo",
      label: "Meiryo",
      value: "Meiryo, 'Yu Gothic UI', 'Hiragino Sans', sans-serif",
    },
    {
      id: "bizud",
      label: "BIZ UD",
      value: "'BIZ UDGothic', 'BIZ UDPGothic', 'Noto Sans JP', Meiryo, sans-serif",
    },
    {
      id: "impact",
      label: "英字・太字",
      value: "Impact, 'Arial Black', 'Helvetica Neue', sans-serif",
    },
    {
      id: "serif_en",
      label: "英字セリフ",
      value: "Georgia, 'Times New Roman', 'Noto Serif JP', serif",
    },
    {
      id: "script",
      label: "筆記体風",
      value:
        "'Brush Script MT', 'Segoe Script', 'Snell Roundhand', 'Hannotate SC', cursive",
    },
  ];

export const EMPTY_FLOOR_TEXT_DRAFT = {
  body: "",
  fontSizePx: 18,
  fontWeight: 600,
  color: FLOOR_TEXT_DEFAULT_COLOR,
  fontFamily: FLOOR_TEXT_DEFAULT_FONT,
};

export function floorTextMarkupScale(m: StageFloorTextMarkup): number {
  const s = m.scale;
  if (typeof s === "number" && Number.isFinite(s) && s > 0) {
    return Math.min(8, Math.max(0.2, s));
  }
  return 1;
}

export function floorTextFontCss(m: StageFloorTextMarkup): string {
  const t = m.fontFamily?.trim();
  return t && t.length > 0 ? t : FLOOR_TEXT_DEFAULT_FONT;
}

export function floorTextColorHex(m: StageFloorTextMarkup): string {
  const c = m.color?.trim();
  if (c && /^#[0-9a-fA-F]{6}$/i.test(c)) return c.toLowerCase();
  return FLOOR_TEXT_DEFAULT_COLOR;
}

export function floorTextDraftColorHex(color: string | undefined): string {
  const c = color?.trim();
  if (c && /^#[0-9a-fA-F]{6}$/i.test(c)) return c.toLowerCase();
  return FLOOR_TEXT_DEFAULT_COLOR;
}

/** ○内ラベル用フォント（px）。印が大きいほど比例して大きく */
export function markerCircleLabelFontPx(markerPx: number): number {
  return Math.max(
    14,
    Math.min(34, Math.round(19 * (markerPx / DEFAULT_DANCER_MARKER_DIAMETER_PX)))
  );
}

/** ○の下に出す名前用（○内よりやや小さめ） */
export function markerBelowLabelFontPx(circleLabelPx: number): number {
  return Math.max(12, Math.min(24, circleLabelPx));
}

/** ○下端と名前のあいだを、舞台横幅に対してこの mm ぶん広げる */
const DANCER_NAME_BELOW_EXTRA_GAP_MM = 3.5;

export function dancerNameBelowClearanceExtraPx(
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

type CircleInnerLabelOpts = {
  /** 印の中心の横幅％（ドラフト中は仮位置） */
  effXPct: number;
  stageWidthMm: number;
};

/**
 * 「名前は○の下」モードの○内表示。
 * `markerBadge === ""` は意図的な空欄（並び順による連番フォールバックなし）。
 * `markerBadgeSource === "centerDistance"` のときは毎回、印の中心からセンターまでを 5cm 刻みの整数（cm）で表示。
 */
export function dancerCircleInnerBelowLabel(
  d: DancerSpot,
  formationIndex: number,
  opts?: CircleInnerLabelOpts | null
): string {
  if (
    d.markerBadgeSource === "centerDistance" &&
    opts &&
    opts.stageWidthMm > 0
  ) {
    const mm = rawHorizontalDistanceFromStageCenterMm(
      opts.effXPct,
      opts.stageWidthMm
    );
    return formatCenterDistanceCmFine(mm);
  }
  if (d.markerBadge === "") return "";
  const stored = sliceMarkerBadgeForStorage(d.markerBadge);
  if (stored) return stored;
  return String(formationIndex + 1);
}

export const GROUP_BOX_HANDLES: readonly {
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

/**
 * 群リサイズのハンドルからスケール係数と不動点（アンカー）を求める。
 * アンカーは常に選択ボックスの中心。ドラッグした辺／角が動く分だけ
 * センターからの距離比で拡大縮小する（センター基準の間隔調整に向く）。
 */
export function groupScaleForHandle(
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

export function applySetPieceResizePct(
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
