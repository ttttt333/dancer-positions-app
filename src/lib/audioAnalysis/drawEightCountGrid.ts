/**
 * 8カウント・ビート縦線グリッド（Canvas）。
 * Viewport 内のみ描画し、ズームに応じて密度を落とす。
 */

import type { BeatInfo } from "../../types/audioAnalysis";
import { waveTimeToExtentX } from "../timelineWaveGeometry";

export type DrawEightCountGridOpts = {
  beats: BeatInfo[];
  viewStart: number;
  viewSpan: number;
  canvasWidth: number;
  canvasHeight: number;
  /**
   * この px/秒 未満なら Downbeat のみ。
   * 広域表示で縦線が潰れるのを防ぐ。
   */
  fullGridMinPxPerSec?: number;
  /** Downbeat 上に「1」を描く最小 px/秒 */
  labelMinPxPerSec?: number;
};

const DOWNBEAT_STROKE = "rgba(255, 255, 255, 0.55)";
const SUBBEAT_STROKE = "rgba(255, 255, 255, 0.14)";
const LABEL_FILL = "rgba(226, 232, 240, 0.75)";

/**
 * 波形ピークの上に 8カウント縦線を重ねる。
 * Downbeat（1）= 太め、2〜8 = 細線。画面外はスキップ。
 */
export function drawEightCountGrid(
  g: CanvasRenderingContext2D,
  opts: DrawEightCountGridOpts
): void {
  const {
    beats,
    viewStart,
    viewSpan,
    canvasWidth: w,
    canvasHeight: h,
    fullGridMinPxPerSec = 32,
    labelMinPxPerSec = 72,
  } = opts;

  if (!beats.length || viewSpan <= 0 || w <= 0 || h <= 0) return;

  const viewEnd = viewStart + viewSpan;
  const pxPerSec = w / viewSpan;
  const showSubBeats = pxPerSec >= fullGridMinPxPerSec;
  const showLabels = pxPerSec >= labelMinPxPerSec;
  const pad = viewSpan * 0.02;
  const t0 = viewStart - pad;
  const t1 = viewEnd + pad;

  // サブビートは最低 ~5px 間隔を空ける（重なり防止）
  const minSubGapPx = 5;
  let lastSubX = -Infinity;

  g.save();
  g.lineCap = "butt";

  for (const beat of beats) {
    const t = beat.timestamp;
    if (t < t0 || t > t1) continue;

    const isDb = beat.isDownbeat;
    if (!isDb && !showSubBeats) continue;

    const x = waveTimeToExtentX(t, viewStart, viewSpan, w);
    if (x < -2 || x > w + 2) continue;

    if (!isDb) {
      if (x - lastSubX < minSubGapPx) continue;
      lastSubX = x;
    }

    const lw = isDb ? 1.75 : 0.75;
    g.strokeStyle = isDb ? DOWNBEAT_STROKE : SUBBEAT_STROKE;
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, h);
    g.stroke();

    if (isDb && showLabels) {
      g.fillStyle = LABEL_FILL;
      g.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
      g.textAlign = "left";
      g.textBaseline = "top";
      const label =
        beat.beatNumber === 1 || beat.beatNumber === 0
          ? "1"
          : String(beat.beatNumber);
      g.fillText(label, x + 3, 2);
    }
  }

  g.restore();
}

/** テスト／デバッグ用: ビューポート内に描画対象となるビート数 */
export function countVisibleEightCountBeats(
  beats: BeatInfo[],
  viewStart: number,
  viewSpan: number,
  canvasWidth: number,
  fullGridMinPxPerSec = 32
): { downbeats: number; subBeats: number } {
  const viewEnd = viewStart + viewSpan;
  const showSub = canvasWidth / viewSpan >= fullGridMinPxPerSec;
  let downbeats = 0;
  let subBeats = 0;
  for (const b of beats) {
    if (b.timestamp < viewStart || b.timestamp > viewEnd) continue;
    if (b.isDownbeat) downbeats += 1;
    else if (showSub) subBeats += 1;
  }
  return { downbeats, subBeats };
}
