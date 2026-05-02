import { create } from "zustand";
import type { ChoreographyProjectJson } from "../types/choreography";

type EditorStoreState = {
  project: ChoreographyProjectJson | null;
  selectedCueId: string | null;
  selectedDancerIds: string[];
  dragState: {
    isDragging: boolean;
    target: string | null;
  };
  
  // Actions
  setProject: (project: ChoreographyProjectJson | null) => void;
  setSelectedCueId: (id: string | null) => void;
  setSelectedDancerIds: (ids: string[]) => void;
  setDragState: (state: { isDragging: boolean; target: string | null }) => void;
};

export const useEditorStore = create<EditorStoreState>((set) => ({
  project: null,
  selectedCueId: null,
  selectedDancerIds: [],
  dragState: { isDragging: false, target: null },

  setProject: (project) => set({ project }),
  setSelectedCueId: (selectedCueId) => set({ selectedCueId }),
  setSelectedDancerIds: (selectedDancerIds) => set({ selectedDancerIds }),
  setDragState: (dragState) => set({ dragState }),
}));

// Selectors for optimized access
export const useSelectedCueId = () => useEditorStore((state) => state.selectedCueId);
export const useSetSelectedCueId = () => useEditorStore((state) => state.setSelectedCueId);
