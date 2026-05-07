import { create } from 'zustand';
import type { UIState } from '../types';

interface UIStore extends UIState {
  setSelectedFormationId: (id: string | null) => void;
  setSelectedDancerIds: (ids: string[]) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setZoom: (zoom: number) => void;
  resetSelection: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // 初期状態
  selectedFormationId: null,
  selectedDancerIds: [],
  isPlaying: false,
  currentTime: 0,
  zoom: 1,

  // アクション
  setSelectedFormationId: (selectedFormationId) => set({ selectedFormationId }),
  setSelectedDancerIds: (selectedDancerIds) => set({ selectedDancerIds }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setZoom: (zoom) => set({ zoom }),
  resetSelection: () => set({
    selectedFormationId: null,
    selectedDancerIds: [],
  }),
}));
