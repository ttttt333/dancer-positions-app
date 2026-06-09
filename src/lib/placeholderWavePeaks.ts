import { resolveWavePeakBinCount } from "./computeWavePeaksFromChannelData";

/** サーバー／端末解析が使えないときの簡易波形（再生は通常どおり） */
export function createPlaceholderWavePeaks(durationSec?: number | null): number[] {
  const count = resolveWavePeakBinCount(durationSec);
  const peaks = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    peaks[i] = 0.12 + 0.08 * Math.abs(Math.sin(i * 0.07));
  }
  return peaks;
}

/** `createPlaceholderWavePeaks` が生成する細い横棒パターンか */
export function isPlaceholderLikeWavePeaks(peaks: number[]): boolean {
  if (peaks.length < 32) return false;
  let min = Infinity;
  let max = -Infinity;
  for (const v of peaks) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min >= 0.1 && max <= 0.22;
}
