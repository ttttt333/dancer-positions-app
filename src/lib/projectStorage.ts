import type { ChoreographyProjectJson } from "../types/choreography";
import { safeGetItem, safeSetItem, safeRemoveItem } from "../utils/storage";

const STORAGE_KEY = "dance-project";

/**
 * 🚀 プロジェクト保存（JSON）
 */
export const saveProject = (project: ChoreographyProjectJson): void => {
  safeSetItem(STORAGE_KEY, project);
};

/**
 * 🚀 プロジェクトロード
 */

export const loadProject = (): ChoreographyProjectJson | null => {
  try {
    return safeGetItem<ChoreographyProjectJson | null>(STORAGE_KEY, null);
  } catch (error) {
    console.error("Failed to load project:", error);
    return null;
  }
};

/**
 * 🚀 プロジェクト削除
 */
export const clearProject = (): void => {
  safeRemoveItem(STORAGE_KEY);
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
