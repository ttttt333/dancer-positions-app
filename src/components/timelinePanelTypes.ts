import type { ChangeEvent, Dispatch, RefObject, SetStateAction, ReactNode } from "react";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import type { TimelineExtractProgress } from "./TimelineAudioChrome";

export type TimelinePanelHandle = {
  togglePlay: () => void;
  /** 仕様 §5: 再生中ステージクリックなどと同じ「停止」（一時停止＋先頭付近へ） */
  stopPlayback: () => void;
  seekForward5Sec: () => void;
  seekBackward5Sec: () => void;
  /** 音源ファイル選択ダイアログを開く（エディタ上部ツールバー用） */
  openAudioImport: () => void;
  /** フローライブラリ保存用。現在の波形ピーク（無ければ null） */
  getWavePeaksSnapshot: () => number[] | null;
  /** フロー読み込み後に保存済みピークを即反映（decode を待たない） */
  restoreWavePeaks: (peaks: number[], durationSec?: number) => void;
  /**
   * フロー保存: 現在 `<audio>` の音源を Blob 化（未設定・取得失敗時は null）
   */
  getCurrentAudioBlobForFlowLibrary: () => Promise<Blob | null>;
};

export type TimelinePanelBodyProps = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  serverProjectId: number | null;
  loggedIn: boolean;
  onStagePreviewChange?: (dancers: DancerSpot[] | null) => void;
  onFormationChosenFromCueList?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  undoDisabled?: boolean;
  redoDisabled?: boolean;
  selectedCueIds: string[];
  onSelectedCueIdsChange: Dispatch<SetStateAction<string[]>>;
  formationIdForNewCue: string;
  wideWorkbench?: boolean;
  waveTimelineDockTop?: boolean;
  onWaveTimelineDockTopChange?: (next: boolean) => void;
  compactTopDock?: boolean;
  /** スマホ縦積みエディタ: 再生行・波形の余白を詰めた UI */
  editorMobileStack?: boolean;
  /**
   * スマホ compact 再生行の先頭（例: 「波形・再生」＋たたむ）。
   * 波形帯の直上で再生ボタン類と同一行に並べる。
   */
  compactDockLeading?: ReactNode;
  /** PC: 立ち位置雛形（Change）。再生バーの5秒戻す左 */
  showFormationChange?: boolean;
  onOpenFormationChange?: () => void;
  cueListPortalTarget?: HTMLElement | null;
  onSave?: () => void;
  onOpenAudioImport?: () => void;
  /** ギャップ右クリックメニューから個人軌道エディタを開くコールバック */
  onOpenPathEditor?: (cueId: string) => void;
  /** 生徒閲覧（/view/s/…）: ログインなしで Supabase 音源を読む */
  publicShareView?: boolean;
  /** PC 上部ドック外枠の高さ（px）。波形を再生エリアに連動させる */
  topDockHeightPx?: number | null;
  /** EditorPage の音源セッションから渡す（未指定時はインポート不可） */
  audioFileInputRef?: RefObject<HTMLInputElement | null>;
  extractProgress?: TimelineExtractProgress | null;
  onPickAudio?: (e: ChangeEvent<HTMLInputElement>) => void;
};
