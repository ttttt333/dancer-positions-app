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

/** 正規化済みピークの最大振幅が極端に小さい（プレースホルダー波形） */
export function isPlaceholderLikeWavePeaks(peaks: number[]): boolean {
  if (peaks.length < 32) return false;
  let max = 0;
  for (const v of peaks) {
    if (v > max) max = v;
  }
  return max < 0.35;
}
