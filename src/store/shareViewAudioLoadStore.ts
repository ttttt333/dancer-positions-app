import { create } from "zustand";

export type ShareViewAudioPhase =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "unconfigured";

type ShareViewAudioLoadStore = {
  phase: ShareViewAudioPhase;
  ratio: number;
  message: string;
  setLoading: (ratio: number, message?: string) => void;
  setReady: (message?: string) => void;
  setError: (message: string) => void;
  setUnconfigured: () => void;
  reset: () => void;
};

export const useShareViewAudioLoadStore = create<ShareViewAudioLoadStore>(
  (set) => ({
    phase: "idle",
    ratio: 0,
    message: "",
    setLoading: (ratio, message = "") =>
      set({ phase: "loading", ratio, message }),
    setReady: (message = "") =>
      set({ phase: "ready", ratio: 1, message }),
    setError: (message) =>
      set({ phase: "error", ratio: 0, message }),
    setUnconfigured: () =>
      set({ phase: "unconfigured", ratio: 0, message: "" }),
    reset: () => set({ phase: "idle", ratio: 0, message: "" }),
  })
);
