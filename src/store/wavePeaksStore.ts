import { create } from "zustand";

type WavePeaksStore = {
  peaks: number[] | null;
  setPeaks: (peaks: number[] | null) => void;
  resetPeaks: () => void;
};

export const useWavePeaksStore = create<WavePeaksStore>((set) => ({
  peaks: null,
  setPeaks: (peaks) => set({ peaks }),
  resetPeaks: () => set({ peaks: null }),
}));
