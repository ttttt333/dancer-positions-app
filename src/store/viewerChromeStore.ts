import { create } from "zustand";
import type { ViewerAudiencePerspective } from "../lib/viewerAudiencePerspective";
import { PUBLIC_VIEWER_MARKER_DISPLAY_SCALE } from "../lib/viewerMarkerDisplay";

export type ViewerChromeStore = {
  controlsVisible: boolean;
  cuePagerVisible: boolean;
  audiencePerspective: ViewerAudiencePerspective;
  /** 閲覧時の印表示倍率（作品データは変更しない） */
  markerDisplayScale: number;
  /** 閲覧時の名下ラベル倍率（印倍率とは独立。自動フィットと掛け合わせ） */
  nameLabelScale: number;
  /** 名前の重なりを自動で小さくする */
  autoNameFit: boolean;
  applyLandscapeDefaults: () => void;
  applyPortraitDefaults: () => void;
  setControlsVisible: (visible: boolean) => void;
  setCuePagerVisible: (visible: boolean) => void;
  setAudiencePerspective: (perspective: ViewerAudiencePerspective) => void;
  toggleAudiencePerspective: () => void;
  setMarkerDisplayScale: (scale: number) => void;
  setNameLabelScale: (scale: number) => void;
  setAutoNameFit: (on: boolean) => void;
  toggleControls: () => void;
  toggleCuePager: () => void;
  reset: () => void;
};

const portraitDefaults = {
  controlsVisible: true,
  cuePagerVisible: true,
  audiencePerspective: "stage" as ViewerAudiencePerspective,
  markerDisplayScale: PUBLIC_VIEWER_MARKER_DISPLAY_SCALE,
  nameLabelScale: 1,
  autoNameFit: true,
};

const landscapeDefaults = {
  controlsVisible: true,
  cuePagerVisible: true,
  audiencePerspective: "stage" as ViewerAudiencePerspective,
  markerDisplayScale: PUBLIC_VIEWER_MARKER_DISPLAY_SCALE,
  nameLabelScale: 1,
  autoNameFit: true,
};

export const useViewerChromeStore = create<ViewerChromeStore>((set) => ({
  ...portraitDefaults,

  applyLandscapeDefaults: () =>
    set((s) => ({
      ...landscapeDefaults,
      audiencePerspective: s.audiencePerspective,
      markerDisplayScale: s.markerDisplayScale,
      nameLabelScale: s.nameLabelScale,
      autoNameFit: s.autoNameFit,
    })),

  applyPortraitDefaults: () =>
    set((s) => ({
      ...portraitDefaults,
      audiencePerspective: s.audiencePerspective,
      markerDisplayScale: s.markerDisplayScale,
      nameLabelScale: s.nameLabelScale,
      autoNameFit: s.autoNameFit,
    })),

  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  setCuePagerVisible: (cuePagerVisible) => set({ cuePagerVisible }),

  setAudiencePerspective: (audiencePerspective) => set({ audiencePerspective }),
  toggleAudiencePerspective: () =>
    set((s) => ({
      audiencePerspective:
        s.audiencePerspective === "stage" ? "audience" : "stage",
    })),

  setMarkerDisplayScale: (markerDisplayScale) => set({ markerDisplayScale }),
  setNameLabelScale: (nameLabelScale) => set({ nameLabelScale }),
  setAutoNameFit: (autoNameFit) => set({ autoNameFit }),

  toggleControls: () =>
    set((s) => ({ controlsVisible: !s.controlsVisible })),
  toggleCuePager: () =>
    set((s) => ({ cuePagerVisible: !s.cuePagerVisible })),

  reset: () => set({ ...portraitDefaults }),
}));
