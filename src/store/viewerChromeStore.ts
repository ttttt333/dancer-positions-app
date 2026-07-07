import { create } from "zustand";

export type ViewerChromeStore = {
  stageOnly: boolean;
  waveVisible: boolean;
  controlsVisible: boolean;
  cuePagerVisible: boolean;
  detailsVisible: boolean;
  /** ステージのみに入る直前の表示状態 */
  restoreSnapshot: Pick<
    ViewerChromeStore,
    "waveVisible" | "controlsVisible" | "cuePagerVisible" | "detailsVisible"
  > | null;
  applyLandscapeDefaults: () => void;
  applyPortraitDefaults: () => void;
  enterStageOnly: () => void;
  exitStageOnly: () => void;
  setWaveVisible: (visible: boolean) => void;
  setControlsVisible: (visible: boolean) => void;
  setCuePagerVisible: (visible: boolean) => void;
  setDetailsVisible: (visible: boolean) => void;
  toggleWave: () => void;
  toggleControls: () => void;
  toggleCuePager: () => void;
  toggleDetails: () => void;
  reset: () => void;
};

const portraitDefaults = {
  waveVisible: false,
  controlsVisible: true,
  cuePagerVisible: true,
  detailsVisible: false,
};

const landscapeDefaults = {
  waveVisible: false,
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
        waveVisible: s.waveVisible,
        controlsVisible: s.controlsVisible,
        cuePagerVisible: s.cuePagerVisible,
        detailsVisible: s.detailsVisible,
      },
      stageOnly: true,
      waveVisible: false,
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

  setWaveVisible: (waveVisible) => set({ waveVisible, stageOnly: false }),
  setControlsVisible: (controlsVisible) =>
    set({ controlsVisible, stageOnly: false }),
  setCuePagerVisible: (cuePagerVisible) =>
    set({ cuePagerVisible, stageOnly: false }),
  setDetailsVisible: (detailsVisible) =>
    set({ detailsVisible, stageOnly: false }),

  toggleWave: () =>
    set((s) => ({ waveVisible: !s.waveVisible, stageOnly: false })),
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
