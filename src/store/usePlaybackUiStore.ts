import { create } from "zustand";

/**
 * 再生まわりの UI 同期用ストア（段階的に Editor / Timeline から集約）。
 * 音源の真実は `playbackEngine`、ここは再生 UI 同期（時刻・再生フラグ・尺）の共有。
 *
 * 編集ルートでは `resetPlaybackUi` と `playbackEngine` からの購読・RAF 同期を
 * `hooks/useEditorPlaybackSync` にまとめている（`<audio>` も同フックが差し込む）。
 */
export type PlaybackUiStore = {
  currentTimeSec: number;
  isPlaying: boolean;
  /** `<audio>` / 波形と揃える実尺（秒） */
  durationSec: number;
  /**
   * decodeAudioData 等で確定した尺（秒）。`loadedmetadata` がわずかに食い違うとき
   * `durationSec` の上書きと expandShortCues の二重実行を避ける。
   */
  trustedAudioDurationSec: number | null;
  setCurrentTimeSec: (t: number) => void;
  setIsPlaying: (v: boolean) => void;
  setDurationSec: (d: number) => void;
  setTrustedAudioDurationSec: (v: number | null) => void;
  /** 別プロジェクトへ遷移したときなどに呼ぶ */
  resetPlaybackUi: () => void;
};

export const usePlaybackUiStore = create<PlaybackUiStore>((set) => ({
  currentTimeSec: 0,
  isPlaying: false,
  durationSec: 0,
  trustedAudioDurationSec: null,
  setCurrentTimeSec: (t) =>
    set({
      currentTimeSec:
        typeof t === "number" && Number.isFinite(t) ? t : 0,
    }),
  setIsPlaying: (v) => set({ isPlaying: Boolean(v) }),
  setDurationSec: (d) =>
    set({
      durationSec:
        typeof d === "number" && Number.isFinite(d) && d >= 0 ? d : 0,
    }),
  setTrustedAudioDurationSec: (v) =>
    set({
      trustedAudioDurationSec:
        typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null,
    }),
  resetPlaybackUi: () =>
    set({
      currentTimeSec: 0,
      isPlaying: false,
      durationSec: 0,
      trustedAudioDurationSec: null,
    }),
}));
