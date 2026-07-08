import { create } from "zustand";

export type ViewerChromeStore = {
  stageOnly: boolean;
  controlsVisible: boolean;
  cuePagerVisible: boolean;
  detailsVisible: boolean;
  /** ステージのみに入る直前の表示状態 */
  restoreSnapshot: Pick<
    ViewerChromeStore,
    "controlsVisible" | "cuePagerVisible" | "detailsVisible"
  > | null;
  applyLandscapeDefaults: () => void;
  applyPortraitDefaults: () => void;
  enterStageOnly: () => void;
  exitStageOnly: () => void;
  setControlsVisible: (visible: boolean) => void;
  setCuePagerVisible: (visible: boolean) => void;
  setDetailsVisible: (visible: boolean) => void;
  toggleControls: () => void;
  toggleCuePager: () => void;
  toggleDetails: () => void;
  reset: () => void;
};

const portraitDefaults = {
  controlsVisible: true,
  cuePagerVisible: true,
  detailsVisible: false,
};

const landscapeDefaults = {
  controlsVisible: true,
  cuePagerVisible: true,
  detailsVisible: false,
};

export const useViewerChromeStore = create<ViewerChromeStore>((set, get) => ({
  stageOnly: false,
  ...portraitDefaults,
  restoreSnapshot: null,

  applyLandscapeDefaults: () =>
    set({ stageOnly: false, ...landscapeDefaults, restoreSnapshot: null }),

  applyPortraitDefaults: () =>
    set({ stageOnly: false, ...portraitDefaults, restoreSnapshot: null }),

  enterStageOnly: () => {
    const s = get();
    if (s.stageOnly) return;
    set({
      restoreSnapshot: {
        controlsVisible: s.controlsVisible,
        cuePagerVisible: s.cuePagerVisible,
        detailsVisible: s.detailsVisible,
      },
      stageOnly: true,
      controlsVisible: false,
      cuePagerVisible: false,
      detailsVisible: false,
    });
  },

  exitStageOnly: () => {
    const snap = get().restoreSnapshot;
    set({
      stageOnly: false,
      restoreSnapshot: null,
      ...(snap ?? portraitDefaults),
    });
  },

  setControlsVisible: (controlsVisible) =>
    set({ controlsVisible, stageOnly: false }),
  setCuePagerVisible: (cuePagerVisible) =>
    set({ cuePagerVisible, stageOnly: false }),
  setDetailsVisible: (detailsVisible) =>
    set({ detailsVisible, stageOnly: false }),

  toggleControls: () =>
    set((s) => ({ controlsVisible: !s.controlsVisible, stageOnly: false })),
  toggleCuePager: () =>
    set((s) => ({ cuePagerVisible: !s.cuePagerVisible, stageOnly: false })),
  toggleDetails: () =>
    set((s) => ({ detailsVisible: !s.detailsVisible, stageOnly: false })),

  reset: () =>
    set({
      stageOnly: false,
      ...portraitDefaults,
      restoreSnapshot: null,
    }),
}));
