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
  /** キュー間の動線メニュー（長押し専用） */
  openGapRouteMenuAtPointer: (clientX: number, clientY: number) => void;
  /** スマホ長押し: キュー内→操作メニュー、間→動線メニュー */
  openWaveCueMenuAtPointer: (clientX: number, clientY: number) => void;
  duration: number;
  isPlaying: boolean;
  hasPeaks: boolean;
};

export type PortraitWaveViewport = {
  zoom: number;
  viewStart: number;
};

const DEFAULT_PORTRAIT_VIEWPORT: PortraitWaveViewport = {
  zoom: 1,
  viewStart: 0,
};

type TimelineWaveBridgeStore = {
  registered: boolean;
  portraitActive: boolean;
  portraitCanvasRef: RefObject<HTMLCanvasElement | null> | null;
  portraitPlayheadLineRef: RefObject<HTMLDivElement | null> | null;
  api: TimelineWaveBridgeApi | null;
  /** PortraitWaveTransport 再マウント（縦横切替）後もズーム位置を維持する単一の真実 */
  portraitViewport: PortraitWaveViewport;
  /** `resetPortraitViewport` 時に増分（ローカル state を追従させる） */
  portraitViewportRevision: number;
  /** 縦画面: 再生ヘッド／ルーラー scrub 中の clientX（端で自動スクロール） */
  portraitWaveScrubAtClientX:
    | ((clientX: number, end?: boolean, shouldSeek?: boolean) => void)
    | null;
  /** 縦画面: 端スクロール rAF 中にキュー帯などを追従更新（shouldSeek=false のとき） */
  portraitWaveEdgeScrollTick: ((clientX: number) => void) | null;
  register: (api: TimelineWaveBridgeApi | null) => void;
  setPortraitActive: (active: boolean) => void;
  setPortraitCanvasRef: (ref: RefObject<HTMLCanvasElement | null> | null) => void;
  setPortraitPlayheadLineRef: (ref: RefObject<HTMLDivElement | null> | null) => void;
  setPortraitWaveScrubAtClientX: (
    fn: ((clientX: number, end?: boolean, shouldSeek?: boolean) => void) | null
  ) => void;
  setPortraitWaveEdgeScrollTick: (fn: ((clientX: number) => void) | null) => void;
  setPortraitViewport: (viewStart: number, zoom: number) => void;
  resetPortraitViewport: () => void;
  /** 縦画面の zoom / viewStart を PC 版波形ビューに同期 */
  syncPortraitView: (viewStart: number, zoom: number) => void;
  /** TimelinePanel 登録: 畳み・リサイズ時にキュー誤編集を破棄 */
  abortPointerGestures: (() => void) | null;
  registerAbortPointerGestures: (fn: (() => void) | null) => void;
};

export const useTimelineWaveBridgeStore = create<TimelineWaveBridgeStore>((set, get) => ({
  registered: false,
  portraitActive: false,
  portraitCanvasRef: null,
  portraitPlayheadLineRef: null,
  api: null,
  portraitViewport: DEFAULT_PORTRAIT_VIEWPORT,
  portraitViewportRevision: 0,
  portraitWaveScrubAtClientX: null,
  portraitWaveEdgeScrollTick: null,
  abortPointerGestures: null,
  registerAbortPointerGestures: (fn) => set({ abortPointerGestures: fn }),
  register: (api) =>
    set({
      api,
      registered: api != null,
    }),
  setPortraitActive: (active) => set({ portraitActive: active }),
  setPortraitCanvasRef: (ref) => set({ portraitCanvasRef: ref }),
  setPortraitPlayheadLineRef: (ref) => set({ portraitPlayheadLineRef: ref }),
  setPortraitWaveScrubAtClientX: (fn) => set({ portraitWaveScrubAtClientX: fn }),
  setPortraitWaveEdgeScrollTick: (fn) => set({ portraitWaveEdgeScrollTick: fn }),
  setPortraitViewport: (viewStart, zoom) => {
    const z = Math.max(1, zoom);
    const vs = Math.max(0, viewStart);
    const prev = get().portraitViewport;
    if (prev.zoom === z && prev.viewStart === vs) return;
    set({ portraitViewport: { zoom: z, viewStart: vs } });
  },
  resetPortraitViewport: () => {
    const prev = get().portraitViewport;
    if (prev.zoom === 1 && prev.viewStart === 0) return;
    set((state) => ({
      portraitViewport: DEFAULT_PORTRAIT_VIEWPORT,
      portraitViewportRevision: state.portraitViewportRevision + 1,
    }));
  },
  syncPortraitView: (viewStart, zoom) => {
    get().setPortraitViewport(viewStart, zoom);
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
