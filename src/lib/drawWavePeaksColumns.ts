import { waveExtentXToTime } from "./timelineWaveGeometry";
import { waveCanvasBitmapPxFromCssMm } from "./waveDockMetrics";

/** 半振幅の上限（キャンバス高さに対する比率）。上下に余白を残しつつ約 94% まで描画 */
const WAVE_PEAK_HALF_HEIGHT_MAX = 0.47;
/** 下端の切れ防止: 波形だけ下側をさらに上へ寄せる量（mm） */
const WAVE_PEAK_BOTTOM_TRIM_MM = 3;

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
  const peakCount = peaks.length;
  if (peakCount <= 1 || durationSec <= 0 || viewSpan <= 0 || canvasWidth <= 0) return;

  const mid = canvasHeight / 2;
  const bottomTrimBitmap = waveCanvasBitmapPxFromCssMm(WAVE_PEAK_BOTTOM_TRIM_MM);
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
      const v = peaks[i]!;
      if (v > peak) peak = v;
    }
    const ph = Math.min(
      canvasHeight * WAVE_PEAK_HALF_HEIGHT_MAX,
      ((peak * canvasHeight) / 2) * amplitudeScale
    );
    const barHeight = Math.max(0, ph * 2 - bottomTrimBitmap);
    if (barHeight > 0.2) {
      g.fillRect(px, mid - ph, 1, barHeight);
    }
  }
}
