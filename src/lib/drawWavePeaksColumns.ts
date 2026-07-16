import { waveExtentXToTime } from "./timelineWaveGeometry";
import { waveCanvasBitmapPxFromCssMm } from "./waveDockMetrics";
import {
  upsampleWavePeaks,
  WAVE_PEAK_BIN_MAX,
} from "./computeWavePeaksFromChannelData";

/** 半振幅の上限（キャンバス高さに対する比率）。上下に余白を残しつつ約 82% まで描画 */
const WAVE_PEAK_HALF_HEIGHT_MAX = 0.41;
/** 下端の切れ防止: 波形だけ下側をさらに上へ寄せる量（mm） */
const WAVE_PEAK_BOTTOM_TRIM_MM = 1.5;
/** ズーム時: 1 列あたり最低この本数のピークを当てはめる（細部が潰れないように） */
const MIN_PEAK_BINS_PER_PX = 3;
/**
 * 無音区間でも「何も描かれない空白」にならないよう、常にこの太さの基準線を描く。
 * これが無いと無音の出だしが背景と区別できず、再生ヘッド（赤バー）が動いていても
 * 目印が無くて数秒間見えていないように感じられる（mm）。
 */
const WAVE_SILENCE_BASELINE_MM = 0.5;

function peaksForZoomedDraw(
  peaks: number[],
  durationSec: number,
  viewSpan: number,
  canvasWidth: number
): number[] {
  const peakCount = peaks.length;
  if (peakCount <= 1 || durationSec <= 0 || viewSpan <= 0 || canvasWidth <= 0) {
    return peaks;
  }
  if (viewSpan >= durationSec * 0.98) return peaks;

  const peaksInView = peakCount * (viewSpan / durationSec);
  const neededInView = Math.ceil(canvasWidth * MIN_PEAK_BINS_PER_PX);
  if (peaksInView >= neededInView) return peaks;

  const upscaleFactor = neededInView / Math.max(1, peaksInView);
  const targetCount = Math.min(
    WAVE_PEAK_BIN_MAX,
    Math.max(peakCount + 1, Math.ceil(peakCount * upscaleFactor))
  );
  if (targetCount <= peakCount) return peaks;
  return upsampleWavePeaks(peaks, targetCount);
}

/** 表示窓内を 1px 列ごとに集約して波形を描画（ズーム時も隙間なく表示） */
export function drawWavePeaksColumns(
  g: CanvasRenderingContext2D,
  peaks: number[],
  durationSec: number,
  viewStart: number,
  viewSpan: number,
  canvasWidth: number,
  canvasHeight: number,
  amplitudeScale: number
): void {
  const drawPeaks = peaksForZoomedDraw(peaks, durationSec, viewSpan, canvasWidth);
  const peakCount = drawPeaks.length;
  if (peakCount <= 1 || durationSec <= 0 || viewSpan <= 0 || canvasWidth <= 0) return;

  const mid = canvasHeight / 2;
  const bottomTrimBitmap = waveCanvasBitmapPxFromCssMm(WAVE_PEAK_BOTTOM_TRIM_MM);
  const silenceBaselinePx = waveCanvasBitmapPxFromCssMm(WAVE_SILENCE_BASELINE_MM);
  const indexForTime = (t: number) => {
    const clamped = Math.max(0, Math.min(durationSec, t));
    return (clamped / durationSec) * (peakCount - 1);
  };

  for (let px = 0; px < canvasWidth; px++) {
    const t0 = waveExtentXToTime(px, viewStart, viewSpan, canvasWidth);
    const t1 = waveExtentXToTime(px + 1, viewStart, viewSpan, canvasWidth);
    const i0 = Math.floor(indexForTime(t0));
    const i1 = Math.ceil(indexForTime(t1));
    let peak = 0;
    for (let i = Math.max(0, i0); i <= Math.min(peakCount - 1, i1); i++) {
      const v = drawPeaks[i]!;
      if (v > peak) peak = v;
    }
    const ph = Math.min(
      canvasHeight * WAVE_PEAK_HALF_HEIGHT_MAX,
      ((peak * canvasHeight) / 2) * amplitudeScale
    );
    const rawBarHeight = Math.max(0, ph * 2 - bottomTrimBitmap);
    if (rawBarHeight >= silenceBaselinePx) {
      g.fillRect(px, mid - ph, 1, rawBarHeight);
    } else {
      g.fillRect(px, mid - silenceBaselinePx / 2, 1, silenceBaselinePx);
    }
  }
}
