import { create } from "zustand";

/**
 * 舞台上の照明オーバーレイ表示（編集中の立ち位置操作をしやすくする一時トグル）。
 * 作品データには保存しない。
 */
export type StageLightsViewStore = {
  /** false のとき舞台上の照明ウォッシュ／ヒットを描かない */
  visibleOnStage: boolean;
  setVisibleOnStage: (v: boolean) => void;
  toggleVisibleOnStage: () => void;
};

export const useStageLightsViewStore = create<StageLightsViewStore>((set) => ({
  visibleOnStage: true,
  setVisibleOnStage: (v) => set({ visibleOnStage: Boolean(v) }),
  toggleVisibleOnStage: () =>
    set((s) => ({ visibleOnStage: !s.visibleOnStage })),
}));
