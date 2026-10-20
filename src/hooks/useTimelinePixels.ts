/**
 * タイムライン時間 ↔ ピクセル／％ の単一入口。
 * React セクション帯と Canvas 波形は、必ず同じ view（描画公開レンジ）を使う。
 */

import { useSyncExternalStore } from "react";
import {
  getWaveDrawRangeSnapshot,
  subscribeWaveDrawRange,
  type WaveDrawRange,
} from "../lib/waveDrawRangeSync";
import {
  waveExtentXToTime,
  waveTimeToExtentX,
  waveTimeToPercent,
} from "../lib/timelineWaveGeometry";

export type TimelineViewWindow = {
  start: number;
  end: number;
  span: number;
};

/**
 * Canvas が publish した描画窓を優先。未公開（初期デフォルト）のときだけ fallback。
 * ※ 以前は「フル表示時は waveView に戻す」ため、React と Canvas がずれた。
 */
export function resolveCanonicalTimelineView(
  published: WaveDrawRange,
  fallback: TimelineViewWindow,
  durationSec: number
): TimelineViewWindow {
  if (!(published.span > 0)) return fallback;
  // waveDrawRangeSync 初期値 {0,1,1} を曲長があるときに誤採用しない
  const looksLikeUnsetDefault =
    published.start === 0 &&
    Math.abs(published.span - 1) < 1e-9 &&
    durationSec > 2;
  if (looksLikeUnsetDefault) return fallback;
  return {
    start: published.start,
    end: published.end,
    span: published.span,
  };
}

export function useCanonicalTimelineView(
  fallback: TimelineViewWindow,
  durationSec: number
): TimelineViewWindow {
  const published = useSyncExternalStore(
    subscribeWaveDrawRange,
    getWaveDrawRangeSnapshot,
    getWaveDrawRangeSnapshot
  );
  return resolveCanonicalTimelineView(published, fallback, durationSec);
}

export function timelineTimeToPercent(
  tSec: number,
  view: TimelineViewWindow
): number {
  return waveTimeToPercent(tSec, view.start, view.span);
}

export function timelineTimeToX(
  tSec: number,
  view: TimelineViewWindow,
  extentPx: number
): number {
  return waveTimeToExtentX(tSec, view.start, view.span, extentPx);
}

export function timelineClientXToTime(
  clientX: number,
  trackEl: HTMLElement,
  view: TimelineViewWindow
): number | null {
  const rect = trackEl.getBoundingClientRect();
  if (rect.width <= 0) return null;
  return waveExtentXToTime(
    clientX - rect.left,
    view.start,
    view.span,
    rect.width
  );
}
