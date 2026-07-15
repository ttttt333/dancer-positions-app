import { create } from "zustand";

/** 立ち位置操作しやすい編集ズーム（ピンチ最大 4 の中間寄り） */
export const STAGE_EDIT_ZOOM = 2.5;

export type StageBoardPinchViewportApi = {
  zoomToEdit: () => void;
  zoomToFit: () => void;
};

type StageBoardPinchViewportStore = {
  enabled: boolean;
  zoom: number;
  api: StageBoardPinchViewportApi | null;
  setEnabled: (enabled: boolean) => void;
  setZoom: (zoom: number) => void;
  register: (api: StageBoardPinchViewportApi) => void;
  unregister: () => void;
  zoomToEdit: () => void;
  zoomToFit: () => void;
};

export const useStageBoardPinchViewportStore =
  create<StageBoardPinchViewportStore>((set, get) => ({
    enabled: false,
    zoom: 1,
    api: null,
    setEnabled: (enabled) => set({ enabled }),
    setZoom: (zoom) => set({ zoom }),
    register: (api) => set({ api }),
    unregister: () => set({ api: null, enabled: false, zoom: 1 }),
    zoomToEdit: () => get().api?.zoomToEdit(),
    zoomToFit: () => get().api?.zoomToFit(),
  }));
