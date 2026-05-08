import { create } from "zustand";

/**
 * ステージ上のインタラクション状態（編集ページでは Stage が 1 枚想定）。
 * フォーメーション切替時は `clearStageBoardInteraction` でリセットする。
 */
export type StageBoardInteractionStore = {
  selectedDancerIds: string[];
  setSelectedDancerIds: (
    next: string[] | ((prev: string[]) => string[]),
  ) => void;
  clearSelectedDancers: () => void;
};

export const useStageBoardInteractionStore = create<StageBoardInteractionStore>(
  (set) => ({
    selectedDancerIds: [],
    setSelectedDancerIds: (next) =>
      set((s) => ({
        selectedDancerIds:
          typeof next === "function"
            ? (next as (p: string[]) => string[])(s.selectedDancerIds)
            : next,
      })),
    clearSelectedDancers: () => set({ selectedDancerIds: [] }),
  }),
);
