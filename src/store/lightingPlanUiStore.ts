import { create } from "zustand";

/** 発表会の照明プラン用紙（エディタ全面） */
export const useLightingPlanUiStore = create<{
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}>((set) => ({
  open: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
}));
