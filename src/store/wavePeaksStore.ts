import { create } from "zustand";

type WavePeaksStore = {
  peaks: number[] | null;
  /** 現在の peaks がどの音源キャッシュキー向けか（リロード時の誤スキップ防止） */
  peaksCacheKey: string | null;
  setPeaks: (peaks: number[] | null, cacheKey?: string | null) => void;
  resetPeaks: () => void;
};

export const useWavePeaksStore = create<WavePeaksStore>((set, get) => ({
  peaks: null,
  peaksCacheKey: null,
  setPeaks: (peaks, cacheKey) =>
    set({
      peaks,
      peaksCacheKey:
        peaks == null || !peaks.length
          ? null
          : cacheKey !== undefined
            ? cacheKey
            : get().peaksCacheKey,
    }),
  resetPeaks: () => set({ peaks: null, peaksCacheKey: null }),
}));
