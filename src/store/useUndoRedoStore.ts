import { create } from "zustand";
import type { ChoreographyProjectJson } from "../types/choreography";

type UndoRedoState = {
  past: ChoreographyProjectJson[];
  present: ChoreographyProjectJson | null;
  future: ChoreographyProjectJson[];
  
  // Actions
  setProject: (project: ChoreographyProjectJson | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
};

export const useUndoRedoStore = create<UndoRedoState>((set, get) => ({
  past: [],
  present: null,
  future: [],

  setProject: (project) => {
    const state = get();
    if (!project) {
      set({ past: [], present: null, future: [] });
      return;
    }

    // 現在の状態と同じなら何もしない
    if (JSON.stringify(state.present) === JSON.stringify(project)) {
      return;
    }

    set({
      past: [...state.past, state.present].filter(Boolean) as ChoreographyProjectJson[],
      present: project,
      future: [],
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;

    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);

    set({
      past: newPast,
      present: previous,
      future: [state.present, ...state.future].filter(Boolean) as ChoreographyProjectJson[],
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;

    const next = state.future[0];
    const newFuture = state.future.slice(1);

    set({
      past: [...state.past, state.present].filter(Boolean) as ChoreographyProjectJson[],
      present: next,
      future: newFuture,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  clear: () => {
    set({ past: [], present: null, future: [] });
  },
}));
