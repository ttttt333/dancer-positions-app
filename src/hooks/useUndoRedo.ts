import { useCallback } from "react";
import { useUndoRedoStore } from "../store/useUndoRedoStore";

/**
 * 🚀 Undo/Redo操作Hook
 */
export function useUndoRedo() {
  const setProject = useUndoRedoStore((state) => state.setProject);
  const undo = useUndoRedoStore((state) => state.undo);
  const redo = useUndoRedoStore((state) => state.redo);
  const canUndo = useUndoRedoStore((state) => state.canUndo());
  const canRedo = useUndoRedoStore((state) => state.canRedo());

  // 🚀 キーボードショートカット対応
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey)) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        if (canRedo) redo();
      }
    }
  }, [undo, redo, canUndo, canRedo]);

  return {
    setProject,
    undo,
    redo,
    canUndo,
    canRedo,
    handleKeyDown,
  };
}
