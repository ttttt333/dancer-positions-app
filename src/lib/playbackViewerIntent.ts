import { playbackEngine } from "../core/playbackEngine";
import { isPlaybackBeforeTrimStart } from "../core/timelineController";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

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

/** 閲覧共有: ストアのヘッド位置で音源エンジンを再生（UI ヘッドと音を一致させる） */
export function startViewerEnginePlayback(trimStartSec: number): void {
  if (!playbackEngine.getMediaSourceUrl()) return;
  const store = usePlaybackUiStore.getState();
  let t = store.currentTimeSec;
  if (!Number.isFinite(t) || isPlaybackBeforeTrimStart(t, trimStartSec)) {
    t = trimStartSec;
    store.setCurrentTimeSec(t);
  }
  clearViewerPendingPlay();
  playbackEngine.seek(t);
  store.setIsPlaying(true);
  void playbackEngine.play().catch(() => {
    store.setIsPlaying(false);
  });
}

/** 音源 URL 設定・canplay 後に呼ぶ */
export function fulfillViewerPendingPlay(): void {
  if (!playbackEngine.getMediaSourceUrl()) return;
  const trim = pendingPlayTrimStartSec ?? 0;
  pendingPlayTrimStartSec = null;
  const store = usePlaybackUiStore.getState();
  if (!store.isPlaying) return;
  startViewerEnginePlayback(trim);
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
