import { create } from "zustand";

export type WaveformLoadProgress = {
  ratio: number;
  message?: string;
  /** 読み込み失敗時 true */
  error?: boolean;
};

type WaveformLoadProgressStore = {
  progress: WaveformLoadProgress | null;
  setProgress: (progress: WaveformLoadProgress | null) => void;
};

export const useWaveformLoadProgressStore = create<WaveformLoadProgressStore>((set) => ({
  progress: null,
  setProgress: (progress) => set({ progress }),
}));

export function setWaveformLoadProgress(progress: WaveformLoadProgress | null): void {
  useWaveformLoadProgressStore.getState().setProgress(progress);
}
