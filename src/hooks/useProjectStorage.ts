import { useEffect } from "react";
import { useEditorStore } from "../store/useEditorStore";
import { saveProject, loadProject, createAutoSave } from "../lib/projectStorage";

/**
 * 🚀 プロジェクト保存・復元Hook
 */
export function useProjectStorage() {
  const project = useEditorStore((state) => state.project);
  const setProject = useEditorStore((state) => state.setProject);

  // 🚀 初回ロード
  useEffect(() => {
    const savedProject = loadProject();
    if (savedProject) {
      setProject(savedProject);
    }
  }, [setProject]);

  // 🚀 オートセーブ
  useEffect(() => {
    if (project) {
      const autoSave = createAutoSave(saveProject);
      autoSave(project);
    }
  }, [project]);
}
