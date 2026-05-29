const DEFAULT_BIN_COUNT = 400;

/** サーバー／端末解析が使えないときの簡易波形（再生は通常どおり） */
export function createPlaceholderWavePeaks(count = DEFAULT_BIN_COUNT): number[] {
  const peaks = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    peaks[i] = 0.12 + 0.08 * Math.abs(Math.sin(i * 0.07));
  }
  return peaks;
}
