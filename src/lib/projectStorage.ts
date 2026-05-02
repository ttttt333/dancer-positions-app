import type { ChoreographyProjectJson } from "../types/choreography";

const STORAGE_KEY = "dance-project";

/**
 * 🚀 プロジェクト保存（JSON）
 */
export const saveProject = (project: ChoreographyProjectJson): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch (error) {
    console.error("Failed to save project:", error);
  }
};

/**
 * 🚀 プロジェクトロード
 */
export const loadProject = (): ChoreographyProjectJson | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load project:", error);
    return null;
  }
};

/**
 * 🚀 プロジェクト削除
 */
export const clearProject = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear project:", error);
  }
};

/**
 * 🚀 オートセーブ用デバウンス
 */
export const createAutoSave = (saveFn: (project: ChoreographyProjectJson) => void, delay: number = 1000) => {
  let timeoutId: number;
  
  return (project: ChoreographyProjectJson) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      saveFn(project);
    }, delay);
  };
};
