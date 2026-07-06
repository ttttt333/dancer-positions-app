import { create } from "zustand";

type WavePeaksStore = {
  peaks: number[] | null;
  /** ピーク生成時のデコード尺（秒）。波形の時間軸マッピング用 */
  peaksDurationSec: number | null;
  /** 現在の peaks がどの音源キャッシュキー向けか（リロード時の誤スキップ防止） */
  peaksCacheKey: string | null;
  setPeaks: (
    peaks: number[] | null,
    cacheKey?: string | null,
    durationSec?: number | null
  ) => void;
  resetPeaks: () => void;
};

export const useWavePeaksStore = create<WavePeaksStore>((set, get) => ({
  peaks: null,
  peaksDurationSec: null,
  peaksCacheKey: null,
  setPeaks: (peaks, cacheKey, durationSec) =>
    set({
      peaks,
      peaksDurationSec:
        peaks == null || !peaks.length
          ? null
          : durationSec !== undefined
            ? durationSec
            : get().peaksDurationSec,
      peaksCacheKey:
        peaks == null || !peaks.length
          ? null
          : cacheKey !== undefined
            ? cacheKey
            : get().peaksCacheKey,
    }),
  resetPeaks: () => set({ peaks: null, peaksDurationSec: null, peaksCacheKey: null }),
}));
