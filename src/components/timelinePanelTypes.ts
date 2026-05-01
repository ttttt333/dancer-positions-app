import type { Dispatch, SetStateAction } from "react";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";

export type TimelinePanelHandle = {
  togglePlay: () => void;
  /** 仕様 §5: 再生中ステージクリックなどと同じ「停止」（一時停止＋先頭付近へ） */
  stopPlayback: () => void;
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
  cueListPortalTarget?: HTMLElement | null;
  onSave?: () => void;
};
