import { create } from "zustand";

/**
 * MobileShell ↔ EditorPage の橋渡し用ストア。
 *
 * EditorPage はキュー状態・ダイアログ開閉を自身で管理しているため、
 * App.tsx レベルで MobileShell に props を渡すためにこのストアを経由する。
 *
 * EditorPage 側から `setMobileShellBridge(...)` を呼び出すことで
 * MobileShell に最新状態が自動的に伝わる設計。
 * （EditorPage 変更禁止のため、現時点では App.tsx 側のデフォルト値を使用）
 */
export type MobileShellBridgeStore = {
  currentCueIndex: number;
  totalCues: number;
  audioUrl: string | null;
  activeTab: "stages" | "timeline" | "team" | "settings";
  stageView: "2d" | "3d";
  onCuePrev: () => void;
  onCueNext: () => void;
  onAddCue: () => void;
  onStageSettings: () => void;
  onViewerList: () => void;
  onTabChange: (tab: MobileShellBridgeStore["activeTab"]) => void;
  onStageViewChange: (v: "2d" | "3d") => void;
  /** EditorPage または上位コンポーネントから一括設定 */
  setMobileShellBridge: (patch: Partial<Omit<MobileShellBridgeStore, "setMobileShellBridge">>) => void;
};

export const useMobileShellBridgeStore = create<MobileShellBridgeStore>((set) => ({
  currentCueIndex: 0,
  totalCues: 1,
  audioUrl: null,
  activeTab: "stages",
  stageView: "2d",
  onCuePrev: () => {},
  onCueNext: () => {},
  onAddCue: () => {},
  onStageSettings: () => {},
  onViewerList: () => {},
  onTabChange: (tab) => set({ activeTab: tab }),
  onStageViewChange: () => {},
  setMobileShellBridge: (patch) => set(patch),
}));
