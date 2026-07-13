import { create } from "zustand";
import type { ViewerAudiencePerspective } from "../lib/viewerAudiencePerspective";

export type ViewerChromeStore = {
  controlsVisible: boolean;
  cuePagerVisible: boolean;
  audiencePerspective: ViewerAudiencePerspective;
  applyLandscapeDefaults: () => void;
  applyPortraitDefaults: () => void;
  setControlsVisible: (visible: boolean) => void;
  setCuePagerVisible: (visible: boolean) => void;
  setAudiencePerspective: (perspective: ViewerAudiencePerspective) => void;
  toggleAudiencePerspective: () => void;
  toggleControls: () => void;
  toggleCuePager: () => void;
  reset: () => void;
};

const portraitDefaults = {
  controlsVisible: true,
  cuePagerVisible: true,
  audiencePerspective: "stage" as ViewerAudiencePerspective,
};

const landscapeDefaults = {
  controlsVisible: true,
  cuePagerVisible: true,
  audiencePerspective: "stage" as ViewerAudiencePerspective,
};

export const useViewerChromeStore = create<ViewerChromeStore>((set) => ({
  ...portraitDefaults,

  applyLandscapeDefaults: () =>
    set((s) => ({ ...landscapeDefaults, audiencePerspective: s.audiencePerspective })),

  applyPortraitDefaults: () =>
    set((s) => ({ ...portraitDefaults, audiencePerspective: s.audiencePerspective })),

  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  setCuePagerVisible: (cuePagerVisible) => set({ cuePagerVisible }),

  setAudiencePerspective: (audiencePerspective) => set({ audiencePerspective }),
  toggleAudiencePerspective: () =>
    set((s) => ({
      audiencePerspective: s.audiencePerspective === "stage" ? "audience" : "stage",
    })),

  toggleControls: () =>
    set((s) => ({ controlsVisible: !s.controlsVisible })),
  toggleCuePager: () =>
    set((s) => ({ cuePagerVisible: !s.cuePagerVisible })),

  reset: () => set({ ...portraitDefaults }),
}));
