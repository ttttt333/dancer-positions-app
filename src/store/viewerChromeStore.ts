import { create } from "zustand";

export type ViewerChromeStore = {
  controlsVisible: boolean;
  cuePagerVisible: boolean;
  applyLandscapeDefaults: () => void;
  applyPortraitDefaults: () => void;
  setControlsVisible: (visible: boolean) => void;
  setCuePagerVisible: (visible: boolean) => void;
  toggleControls: () => void;
  toggleCuePager: () => void;
  reset: () => void;
};

const portraitDefaults = {
  controlsVisible: true,
  cuePagerVisible: true,
};

const landscapeDefaults = {
  controlsVisible: true,
  cuePagerVisible: true,
};

export const useViewerChromeStore = create<ViewerChromeStore>((set) => ({
  ...portraitDefaults,

  applyLandscapeDefaults: () => set({ ...landscapeDefaults }),

  applyPortraitDefaults: () => set({ ...portraitDefaults }),

  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  setCuePagerVisible: (cuePagerVisible) => set({ cuePagerVisible }),

  toggleControls: () =>
    set((s) => ({ controlsVisible: !s.controlsVisible })),
  toggleCuePager: () =>
    set((s) => ({ cuePagerVisible: !s.cuePagerVisible })),

  reset: () => set({ ...portraitDefaults }),
}));
