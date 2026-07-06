import { playbackEngine } from "../../core/playbackEngine";

/** テスト差し替え用の再生エンジン抽象（`playbackEngine` 直叩きをここに集約） */
export type IAudioPlayer = {
  getMediaSourceUrl(): string;
  getMediaElement(): HTMLMediaElement | null;
  setMediaSourceUrl(url: string, opts?: { force?: boolean }): void;
  clearMediaSource(): void;
};

export const defaultAudioPlayer: IAudioPlayer = {
  getMediaSourceUrl: () => playbackEngine.getMediaSourceUrl(),
  getMediaElement: () => playbackEngine.getMediaElement(),
  setMediaSourceUrl: (url, opts) =>
    playbackEngine.setMediaSourceUrl(url, opts),
  clearMediaSource: () => playbackEngine.clearMediaSource(),
};
