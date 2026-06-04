import { playbackEngine } from "../core/playbackEngine";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { togglePlaybackRespectingTrimStart } from "./playbackTransport";

/** 閲覧共有: 音源未準備のときに押した再生を、読み込み完了後に実行する */
let pendingPlayTrimStartSec: number | null = null;

export function setViewerPendingPlay(trimStartSec: number): void {
  pendingPlayTrimStartSec = trimStartSec;
  usePlaybackUiStore.getState().setIsPlaying(true);
}

export function clearViewerPendingPlay(): void {
  pendingPlayTrimStartSec = null;
}

export function hasViewerPendingPlay(): boolean {
  return pendingPlayTrimStartSec != null;
}

/** 音源 URL 設定・canplay 後に呼ぶ */
export function fulfillViewerPendingPlay(): void {
  if (!playbackEngine.getMediaSourceUrl()) return;
  const trim = pendingPlayTrimStartSec;
  if (trim != null) {
    pendingPlayTrimStartSec = null;
    togglePlaybackRespectingTrimStart(trim);
    return;
  }
  const store = usePlaybackUiStore.getState();
  if (!store.isPlaying || !playbackEngine.isPaused()) return;
  const t = store.currentTimeSec;
  if (Number.isFinite(t) && t >= 0) {
    playbackEngine.seek(t);
  }
  void playbackEngine.play();
}

/**
 * iOS Safari: ユーザータップの同期スタック内で一度 play してメディアを解放する。
 * 既に src があるときだけ有効。
 */
export function primeAudioForUserGesture(): void {
  const el = playbackEngine.getMediaElement();
  if (!el || !playbackEngine.getMediaSourceUrl()) return;
  const wasPaused = el.paused;
  void el.play().then(() => {
    if (wasPaused) {
      el.pause();
      usePlaybackUiStore.getState().setIsPlaying(false);
    }
  }).catch(() => {
    /* 未読み込み等 */
  });
}
