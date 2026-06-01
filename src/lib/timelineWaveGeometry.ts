/**
 * 波形キャンバス上の時間↔ピクセル変換・ヒットテスト（純関数）。
 * `TimelinePanel` の描画・ポインタ処理で共有する。
 */

import type { Cue } from "../types/choreography";
import { sortCuesByStart } from "./cueInterval";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** 波形・再生バー・目盛りは同一の水平座標系（左右端までフル幅） */
const WAVE_X_INSET_FRAC = 0;

export function waveTimeToExtentX(
  tSec: number,
  viewStart: number,
  viewSpan: number,
  extentPx: number
): number {
  if (viewSpan <= 0 || extentPx <= 0) return 0;
  const pad = extentPx * WAVE_X_INSET_FRAC;
  const inner = extentPx - 2 * pad;
  const f = clamp((tSec - viewStart) / viewSpan, 0, 1);
  return pad + f * inner;
}

export function waveExtentXToTime(
  xPx: number,
  viewStart: number,
  viewSpan: number,
  extentPx: number
): number {
  if (viewSpan <= 0 || extentPx <= 0) return viewStart;
  const pad = extentPx * WAVE_X_INSET_FRAC;
  const inner = extentPx - 2 * pad;
  if (inner <= 1e-6) return viewStart;
  const f = clamp((xPx - pad) / inner, 0, 1);
  return viewStart + f * viewSpan;
}

/** 再生中の目盛り・波形ビュー窓の微振れを抑える（約 33ms グリッド） */
export function quantizePlayheadForWaveView(sec: number): number {
  if (!Number.isFinite(sec)) return 0;
  return Math.round(sec * 30) / 30;
}

/**
 * ポインタのヒット判定・座標変換用。
 * 描画と同じ `resolveWaveDrawView` をその場で求め、lastDrawRange の遅れで当たりがズレないようにする。
 */
export function resolveWaveViewForPointerHit(params: {
  durationSec: number;
  viewPortion: number;
  isPlaying: boolean;
  viewStartOverride: number | null;
  anchorTimeSec: number;
}): { viewStart: number; viewSpan: number } {
  const { durationSec, viewPortion, isPlaying, viewStartOverride, anchorTimeSec } =
    params;
  if (durationSec <= 0) {
    return { viewStart: 0, viewSpan: 1 };
  }
  const { start, span } = resolveWaveDrawView({
    durationSec,
    viewPortion,
    anchorTimeSec,
    isPlaying,
    viewStartOverride: !isPlaying ? viewStartOverride : null,
  });
  return { viewStart: start, viewSpan: span };
}

/** 波形キャンバス上のキュー区間帯をクリック判定（CSS ピクセル座標） */
export function pickCueIdAtWave(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  cueList: Cue[],
  viewStart: number,
  viewSpan: number,
  dragPreview: { cueId: string; tStart: number; tEnd: number } | null
): string | null {
  if (viewSpan <= 0) return null;
  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  const w = r.width;
  const h = r.height;
  if (w <= 0) return null;
  const inset = 0.5;
  const bandTop = inset;
  const bandBottom = Math.max(inset, h - inset);
  const mid = h / 2;
  const viewEnd = viewStart + viewSpan;
  let best: { id: string; dist: number } | null = null;
  for (const cue of cueList) {
    const ts =
      dragPreview && dragPreview.cueId === cue.id
        ? dragPreview.tStart
        : cue.tStartSec;
    const te =
      dragPreview && dragPreview.cueId === cue.id
        ? dragPreview.tEnd
        : cue.tEndSec;
    if (te < viewStart || ts > viewEnd) continue;
    const x1 = waveTimeToExtentX(Math.max(ts, viewStart), viewStart, viewSpan, w);
    const x2 = waveTimeToExtentX(Math.min(te, viewEnd), viewStart, viewSpan, w);
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    if (x < left || x > right) continue;
    if (y < bandTop || y > bandBottom) continue;
    const cx = clamp(x, left, right);
    const dist = Math.abs(x - cx) + Math.abs(y - mid) * 0.05;
    if (!best || dist < best.dist) best = { id: cue.id, dist };
  }
  return best?.id ?? null;
}

/** 枠内側の端ドラッグ判定幅（px） */
const CUE_EDGE_INNER_GRAB_PX = 10;
/** 枠外側の端ドラッグ判定幅（px）— PC で枠の外を掴んで拡大縮小 */
export const CUE_EDGE_OUTER_GRAB_PX = 18;

function cueWaveVerticalBandPx(canvasHeight: number): {
  mid: number;
  top: number;
  bottom: number;
} {
  /** 描画（strokeRect inset 0.5）と同じ縦範囲でヒット判定する */
  const inset = 0.5;
  const mid = canvasHeight / 2;
  return { mid, top: inset, bottom: Math.max(inset, canvasHeight - inset) };
}

function cueWaveHorizontalBoundsPx(
  ts: number,
  te: number,
  viewStart: number,
  viewSpan: number,
  viewEnd: number,
  canvasWidth: number
): { left: number; right: number } {
  const x1 = waveTimeToExtentX(Math.max(ts, viewStart), viewStart, viewSpan, canvasWidth);
  const x2 = waveTimeToExtentX(Math.min(te, viewEnd), viewStart, viewSpan, canvasWidth);
  return { left: Math.min(x1, x2), right: Math.max(x1, x2) };
}

export type CueDragEdgeMode = "move" | "start" | "end";

/** 確定したキュー帯上で、開始端／終了端／移動のいずれか（端は枠の外側にも判定を広げる） */
function pickCueDragModeForCueAtX(
  x: number,
  left: number,
  right: number
): CueDragEdgeMode {
  const cueWidth = right - left;
  if (cueWidth <= CUE_EDGE_INNER_GRAB_PX * 2 + 1) {
    return "move";
  }
  const inStartZone =
    x >= left - CUE_EDGE_OUTER_GRAB_PX && x <= left + CUE_EDGE_INNER_GRAB_PX;
  const inEndZone =
    x >= right - CUE_EDGE_INNER_GRAB_PX && x <= right + CUE_EDGE_OUTER_GRAB_PX;
  if (inStartZone) return "start";
  if (inEndZone) return "end";
  return "move";
}

/**
 * 帯上のポインタ操作種別。
 * キュー ID はクリック選択と同じ `pickCueIdAtWave` で決め、隣接キューの端ゾーンが奪い合わないようにする。
 */
export function pickCueDragKindAtWave(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  cueList: Cue[],
  viewStart: number,
  viewSpan: number,
  dragPreview: { cueId: string; tStart: number; tEnd: number } | null
): { cueId: string; mode: CueDragEdgeMode } | null {
  if (viewSpan <= 0 || cueList.length === 0) return null;

  const cueId = pickCueIdAtWave(
    clientX,
    clientY,
    canvas,
    cueList,
    viewStart,
    viewSpan,
    dragPreview
  );
  if (!cueId) return null;

  const cue = cueList.find((c) => c.id === cueId);
  if (!cue) return null;

  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left;
  const w = r.width;
  if (w <= 0) return null;

  const viewEnd = viewStart + viewSpan;
  const ts =
    dragPreview && dragPreview.cueId === cue.id ? dragPreview.tStart : cue.tStartSec;
  const te =
    dragPreview && dragPreview.cueId === cue.id ? dragPreview.tEnd : cue.tEndSec;
  if (te < viewStart || ts > viewEnd) return null;

  let { left, right } = cueWaveHorizontalBoundsPx(
    ts,
    te,
    viewStart,
    viewSpan,
    viewEnd,
    w
  );
  const rawWidth = right - left;
  if (rawWidth < 3) {
    const mid = (left + right) / 2;
    left = mid - 1.5;
    right = mid + 1.5;
  }
  if (right - left < 1) return null;

  return { cueId, mode: pickCueDragModeForCueAtX(x, left, right) };
}

const GAP_LINK_MIN_WIDTH_PX = 6;

export function gapConnectorPixelBounds(
  prevEndSec: number,
  nextStartSec: number,
  viewStart: number,
  viewSpan: number,
  viewEnd: number,
  w: number,
  h: number
): { left: number; width: number; top: number; height: number } | null {
  if (!(viewSpan > 0) || nextStartSec <= prevEndSec + 1e-4) return null;
  const gx0 = Math.max(prevEndSec, viewStart);
  const gx1 = Math.min(nextStartSec, viewEnd);
  if (gx1 <= gx0) return null;
  const x1 = waveTimeToExtentX(gx0, viewStart, viewSpan, w);
  const x2 = waveTimeToExtentX(gx1, viewStart, viewSpan, w);
  let gl = Math.min(x1, x2);
  let gr = Math.max(x1, x2);
  if (gr - gl < GAP_LINK_MIN_WIDTH_PX) {
    const c = (gl + gr) / 2;
    gl = c - GAP_LINK_MIN_WIDTH_PX / 2;
    gr = c + GAP_LINK_MIN_WIDTH_PX / 2;
  }
  const inset = 0.5;
  const top = inset;
  const height = h - inset * 2;
  gl = Math.max(0, gl);
  gr = Math.min(w, gr);
  const width = gr - gl;
  if (width < 1) return null;
  return { left: gl, width, top, height };
}

export function pickGapLinkAtWave(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  cueList: Cue[],
  viewStart: number,
  viewSpan: number,
  dragPreview: { cueId: string; tStart: number; tEnd: number } | null,
  touchPaddingPx = 0
): { nextCueId: string } | null {
  if (viewSpan <= 0 || cueList.length < 2) return null;
  const sortedList = sortCuesByStart(cueList);
  const r = canvas.getBoundingClientRect();
  const px = clientX - r.left;
  const py = clientY - r.top;
  const w = r.width;
  const h = r.height;
  if (w <= 0 || h <= 0) return null;
  const viewEnd = viewStart + viewSpan;
  const pad = Math.max(0, touchPaddingPx);
  const junctionHalfW = Math.max(GAP_LINK_MIN_WIDTH_PX, pad);
  const inset = 0.5;
  const barTop = inset;
  const barHeight = h - inset * 2;

  const inBarBand = (y: number) =>
    y >= barTop - pad && y <= barTop + barHeight + pad;

  for (let i = 0; i < sortedList.length - 1; i++) {
    const prev = sortedList[i]!;
    const next = sortedList[i + 1]!;
    let prevEnd = prev.tEndSec;
    let nextStart = next.tStartSec;
    if (dragPreview && dragPreview.cueId === prev.id) prevEnd = dragPreview.tEnd;
    if (dragPreview && dragPreview.cueId === next.id) nextStart = dragPreview.tStart;

    const b = gapConnectorPixelBounds(
      prevEnd,
      nextStart,
      viewStart,
      viewSpan,
      viewEnd,
      w,
      h
    );
    if (b) {
      if (
        px >= b.left - pad &&
        px <= b.left + b.width + pad &&
        py >= b.top - pad &&
        py <= b.top + b.height + pad
      ) {
        return { nextCueId: next.id };
      }
    }

    /** 時間的に隙間が無い（境界が一致）キュー同士の「間」 */
    if (nextStart <= prevEnd + 1e-4 && inBarBand(py)) {
      const xJ = waveTimeToExtentX(prevEnd, viewStart, viewSpan, w);
      if (px >= xJ - junctionHalfW && px <= xJ + junctionHalfW) {
        return { nextCueId: next.id };
      }
    }
  }
  return null;
}

const PLAYHEAD_SCRUB_HALF_WIDTH_PX = 16;
/** 縦画面: 再生位置バーのタップ・ドラッグ判定を広げる */
export const PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX = 28;

export function hitPlayheadStripForScrub(
  clientX: number,
  canvas: HTMLCanvasElement,
  viewStart: number,
  viewSpan: number,
  playheadSec: number,
  durationSec: number,
  scrubHalfWidthPx = PLAYHEAD_SCRUB_HALF_WIDTH_PX
): boolean {
  if (durationSec <= 0 || viewSpan <= 0) return false;
  const r = canvas.getBoundingClientRect();
  const w = r.width;
  if (w <= 0) return false;
  const x = clientX - r.left;
  const xPlay = waveTimeToExtentX(playheadSec, viewStart, viewSpan, w);
  return Math.abs(x - xPlay) <= scrubHalfWidthPx;
}

export function computeViewRange(
  durationSec: number,
  viewPortion: number,
  centerTime: number
): { start: number; end: number; span: number } {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { start: 0, end: 1, span: 1 };
  }
  if (viewPortion >= 1 - 1e-9) {
    return { start: 0, end: durationSec, span: durationSec };
  }
  const span = Math.max(0.08, durationSec * viewPortion);
  const start = clamp(
    centerTime - span / 2,
    0,
    Math.max(0, durationSec - span)
  );
  return { start, end: start + span, span };
}

const WAVE_PLAYHEAD_X_FRAC = 0.11;

export function getWaveViewForDraw(
  durationSec: number,
  viewPortion: number,
  anchorTimeSec: number
): { start: number; end: number; span: number } {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { start: 0, end: 1, span: 1 };
  }
  if (viewPortion >= 1 - 1e-9) {
    return computeViewRange(durationSec, viewPortion, anchorTimeSec);
  }
  const span = Math.max(0.08, durationSec * viewPortion);
  const start = clamp(
    anchorTimeSec - WAVE_PLAYHEAD_X_FRAC * span,
    0,
    Math.max(0, durationSec - span)
  );
  return { start, end: start + span, span };
}

/** 波形キャンバス描画と UI オーバーレイで共有する可視時間窓 */
export function resolveWaveDrawView(params: {
  durationSec: number;
  viewPortion: number;
  anchorTimeSec: number;
  isPlaying: boolean;
  viewStartOverride: number | null;
}): { start: number; end: number; span: number } {
  const { durationSec, viewPortion, anchorTimeSec, isPlaying, viewStartOverride } =
    params;
  if (
    !isPlaying &&
    viewStartOverride !== null &&
    Number.isFinite(durationSec) &&
    durationSec > 0
  ) {
    const span = Math.max(0.08, durationSec * viewPortion);
    return {
      start: viewStartOverride,
      end: viewStartOverride + span,
      span,
    };
  }
  return getWaveViewForDraw(durationSec, viewPortion, anchorTimeSec);
}

/** 目盛り・再生ヘッド用: 時刻をコンテナ幅に対する 0–100% へ */
export function waveTimeToPercent(
  tSec: number,
  viewStart: number,
  viewSpan: number
): number {
  return waveTimeToExtentX(tSec, viewStart, viewSpan, 100);
}

/** 再生位置オーバーレイ: 0%/100% でも縦線がコンテナ端まで届く */
export function playheadOverlayPositionStyles(pct: number): {
  left: string;
  transform: string;
} {
  const p = Math.max(0, Math.min(100, pct));
  if (p <= 0) return { left: "0", transform: "none" };
  if (p >= 100) return { left: "100%", transform: "translateX(-100%)" };
  return { left: `${p}%`, transform: "translateX(-50%)" };
}
