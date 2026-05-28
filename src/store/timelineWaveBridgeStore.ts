import type { RefObject } from "react";
import { create } from "zustand";

export type TimelineWaveBridgeHandlers = {
  onWaveCanvasPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onWaveCanvasPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onWaveCanvasPointerLeave: () => void;
  onWaveClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWaveDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWaveContextMenu: (e: React.MouseEvent<HTMLCanvasElement>) => void;
};

type TimelineWaveBridgeApi = {
  handlers: TimelineWaveBridgeHandlers;
  drawWaveformAt: (playheadTime: number) => void;
  setViewPortion: (portion: number) => void;
  setWaveViewStartOverride: (start: number | null) => void;
  duration: number;
  isPlaying: boolean;
};

type TimelineWaveBridgeStore = {
  registered: boolean;
  portraitActive: boolean;
  portraitCanvasRef: RefObject<HTMLCanvasElement | null> | null;
  api: TimelineWaveBridgeApi | null;
  register: (api: TimelineWaveBridgeApi | null) => void;
  setPortraitActive: (active: boolean) => void;
  setPortraitCanvasRef: (ref: RefObject<HTMLCanvasElement | null> | null) => void;
  /** 縦画面の zoom / viewStart を PC 版波形ビューに同期 */
  syncPortraitView: (viewStart: number, zoom: number) => void;
};

export const useTimelineWaveBridgeStore = create<TimelineWaveBridgeStore>((set, get) => ({
  registered: false,
  portraitActive: false,
  portraitCanvasRef: null,
  api: null,
  register: (api) =>
    set({
      api,
      registered: api != null,
    }),
  setPortraitActive: (active) => set({ portraitActive: active }),
  setPortraitCanvasRef: (ref) => set({ portraitCanvasRef: ref }),
  syncPortraitView: (viewStart, zoom) => {
    const { api, isPlaying } = {
      api: get().api,
      isPlaying: get().api?.isPlaying ?? false,
    };
    if (!api || api.duration <= 0) return;
    const z = Math.max(1, zoom);
    const portion = Math.min(1, Math.max(0.02, 1 / z));
    api.setViewPortion(portion);
    if (!isPlaying && z > 1.001) {
      const span = api.duration * portion;
      const maxStart = Math.max(0, api.duration - span);
      api.setWaveViewStartOverride(Math.max(0, Math.min(maxStart, viewStart)));
    } else {
      api.setWaveViewStartOverride(null);
    }
  },
}));
