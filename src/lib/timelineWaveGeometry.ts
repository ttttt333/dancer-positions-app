/**
 * 波形キャンバス上の時間↔ピクセル変換・ヒットテスト（純関数）。
 * `TimelinePanel` の描画・ポインタ処理で共有する。
 */

import type { Cue } from "../types/choreography";
import { sortCuesByStart } from "./cueInterval";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 波形の左右に余白を取り、内側に縮小して描く・座標変換する。
 */
const WAVE_X_INSET_FRAC = 0.035;

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
  const mid = h / 2;
  const barHalfH = Math.max(14, Math.floor(h * 0.46));
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
    if (y < mid - barHalfH || y > mid + barHalfH) continue;
    const cx = clamp(x, left, right);
    const dist = Math.abs(x - cx) + Math.abs(y - mid) * 0.05;
    if (!best || dist < best.dist) best = { id: cue.id, dist };
  }
  return best?.id ?? null;
}

const CUE_EDGE_GRAB_PX = 14;
export type CueDragEdgeMode = "move" | "start" | "end";

/** 帯上のクリックが開始端／終了端／移動のいずれか */
export function pickCueDragKindAtWave(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  cueList: Cue[],
  viewStart: number,
  viewSpan: number,
  dragPreview: { cueId: string; tStart: number; tEnd: number } | null
): { cueId: string; mode: CueDragEdgeMode } | null {
  const id = pickCueIdAtWave(
    clientX,
    clientY,
    canvas,
    cueList,
    viewStart,
    viewSpan,
    dragPreview
  );
  if (!id || viewSpan <= 0) return null;
  const cue = cueList.find((c) => c.id === id);
  if (!cue) return null;
  const ts =
    dragPreview && dragPreview.cueId === cue.id ? dragPreview.tStart : cue.tStartSec;
  const te =
    dragPreview && dragPreview.cueId === cue.id ? dragPreview.tEnd : cue.tEndSec;
  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  const w = r.width;
  if (w <= 0) return null;
  const mid = r.height / 2;
  const barHalfH = Math.max(14, Math.floor(r.height * 0.46));
  if (y < mid - barHalfH || y > mid + barHalfH) return null;
  const viewEnd = viewStart + viewSpan;
  const x1 = waveTimeToExtentX(Math.max(ts, viewStart), viewStart, viewSpan, w);
  const x2 = waveTimeToExtentX(Math.min(te, viewEnd), viewStart, viewSpan, w);
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  let mode: CueDragEdgeMode = "move";
  if (x <= left + CUE_EDGE_GRAB_PX) mode = "start";
  else if (x >= right - CUE_EDGE_GRAB_PX) mode = "end";
  return { cueId: id, mode };
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
  dragPreview: { cueId: string; tStart: number; tEnd: number } | null
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
    if (!b) continue;
    if (
      px >= b.left &&
      px <= b.left + b.width &&
      py >= b.top &&
      py <= b.top + b.height
    ) {
      return { nextCueId: next.id };
    }
  }
  return null;
}

const PLAYHEAD_SCRUB_HALF_WIDTH_PX = 16;

export function hitPlayheadStripForScrub(
  clientX: number,
  canvas: HTMLCanvasElement,
  viewStart: number,
  viewSpan: number,
  playheadSec: number,
  durationSec: number
): boolean {
  if (durationSec <= 0 || viewSpan <= 0) return false;
  const r = canvas.getBoundingClientRect();
  const w = r.width;
  if (w <= 0) return false;
  const x = clientX - r.left;
  const xPlay = waveTimeToExtentX(playheadSec, viewStart, viewSpan, w);
  return Math.abs(x - xPlay) <= PLAYHEAD_SCRUB_HALF_WIDTH_PX;
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
