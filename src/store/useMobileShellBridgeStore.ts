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
  /** キューの開始秒数一覧 (波形マーカー表示用) */
  cueStartTimes: number[];
  activeTab: "stages" | "timeline" | "team" | "settings";
  stageView: "2d" | "3d";
  undoDisabled: boolean;
  redoDisabled: boolean;
  onCuePrev: () => void;
  onCueNext: () => void;
  onAddCue: () => void;
  /** 選択中キューを削除（Undo 可） */
  onDeleteSelectedCue: () => void;
  /** 削除ボタンを有効にするか */
  canDeleteSelectedCue: boolean;
  onStageSettings: () => void;
  onViewerList: () => void;
  /** 動画書き出しシートを開く */
  onVideoExport: () => void;
  onTabChange: (tab: MobileShellBridgeStore["activeTab"]) => void;
  onStageViewChange: (v: "2d" | "3d") => void;
  onUndo: () => void;
  onRedo: () => void;
  // ── タブメニュー用アクション ──
  /** 立ち位置保存 (stages) */
  onSaveSpot: () => void;
  /** テキスト追加 (stages) */
  onAddText: () => void;
  /** キュー一覧 (stages) */
  onCueList: () => void;
  /** 舞台変形 (stages) */
  onStageShape: () => void;
  /** 大道具 (stages) */
  onSetPiece: () => void;
  /** 音源追加 (timeline) */
  onAudioImport: () => void;
  /** AI提案 (timeline) */
  onAiSuggest: () => void;
  /** 名簿取込 (timeline) */
  onRosterImport: () => void;
  /** メンバー表示 (team) */
  onMemberList: () => void;
  /** メンバー追加 (team) */
  onMemberAdd: () => void;
  /** 閲覧共有 (team) */
  onShareLinks: () => void;
  /** ヘルプ (settings) */
  onHelp: () => void;
  /** ライブラリ (stages) */
  onFlowLibrary: () => void;
  /** 写真からキュー追加 (stages) */
  onPhotoParse: () => void;
  /** 波形タップで近傍キューを選択 */
  onSelectCueNearTime: (tSec: number) => void;
  /** 横画面・波形たたみ時の Change ボタン */
  showFormationChange?: boolean;
  onFormationChange?: () => void;
  /** 横画面・波形たたみ時のキューページャ表示 */
  cuePagerLabel?: string;
  cuePagerCanPrev?: boolean;
  cuePagerCanNext?: boolean;
  /** MobileShell 横画面で波形を畳んでいる（Editor の重複 UI を抑止） */
  landscapeWaveCollapsed?: boolean;
  /** タイムライン左端（停止ボタンで戻る位置） */
  trimStartSec: number;
  trimEndSec: number | null;
  /** EditorPage または上位コンポーネントから一括設定 */
  setMobileShellBridge: (patch: Partial<Omit<MobileShellBridgeStore, "setMobileShellBridge">>) => void;
};

export const useMobileShellBridgeStore = create<MobileShellBridgeStore>((set) => ({
  currentCueIndex: 0,
  totalCues: 1,
  audioUrl: null,
  cueStartTimes: [],
  activeTab: "stages",
  stageView: "2d",
  undoDisabled: true,
  redoDisabled: true,
  onCuePrev: () => {},
  onCueNext: () => {},
  onAddCue: () => {},
  onDeleteSelectedCue: () => {},
  canDeleteSelectedCue: false,
  onStageSettings: () => {},
  onViewerList: () => {},
  onVideoExport: () => {},
  onTabChange: (tab) => set({ activeTab: tab }),
  onStageViewChange: () => {},
  onUndo: () => {},
  onRedo: () => {},
  onSaveSpot: () => {},
  onAddText: () => {},
  onCueList: () => {},
  onStageShape: () => {},
  onSetPiece: () => {},
  onAudioImport: () => {},
  onAiSuggest: () => {},
  onRosterImport: () => {},
  onMemberList: () => {},
  onMemberAdd: () => {},
  onShareLinks: () => {},
  onHelp: () => {},
  onFlowLibrary: () => {},
  onPhotoParse: () => {},
  onSelectCueNearTime: () => {},
  showFormationChange: false,
  onFormationChange: () => {},
  cuePagerLabel: "",
  cuePagerCanPrev: false,
  cuePagerCanNext: false,
  landscapeWaveCollapsed: false,
  trimStartSec: 0,
  trimEndSec: null,
  setMobileShellBridge: (patch) => set(patch),
}));
