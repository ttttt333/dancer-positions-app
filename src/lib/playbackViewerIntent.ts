import { playbackEngine } from "../core/playbackEngine";
import { isPlaybackBeforeTrimStart } from "../core/timelineController";
import { playbackRequiresUserGestureToStart } from "./playbackUserGesture";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

/** 閲覧共有: 音源未準備のときに押した再生を、読み込み完了後に実行する */
let pendingPlayTrimStartSec: number | null = null;
/** 音源は付いたが Safari 等で play() できていない → 次のタップで startViewerEnginePlayback */
let viewerPlayIntentActive = false;

export function setViewerPendingPlay(trimStartSec: number): void {
  pendingPlayTrimStartSec = trimStartSec;
  viewerPlayIntentActive = true;
  usePlaybackUiStore.getState().setIsPlaying(true);
}

export function clearViewerPendingPlay(): void {
  pendingPlayTrimStartSec = null;
  viewerPlayIntentActive = false;
}

export function hasViewerPendingPlay(): boolean {
  return pendingPlayTrimStartSec != null;
}

export function hasViewerPlayIntent(): boolean {
  return viewerPlayIntentActive;
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

  const needsGesture = playbackRequiresUserGestureToStart();
  if (!needsGesture) {
    store.setIsPlaying(true);
  }

  void playbackEngine.play().then(() => {
    if (needsGesture) {
      store.setIsPlaying(true);
    }
    viewerPlayIntentActive = false;
  }).catch(() => {
    store.setIsPlaying(false);
    viewerPlayIntentActive = needsGesture;
  });
}

/** 音源 URL 設定・canplay 後に呼ぶ */
export function fulfillViewerPendingPlay(): void {
  if (!playbackEngine.getMediaSourceUrl()) return;
  const store = usePlaybackUiStore.getState();
  if (!store.isPlaying && pendingPlayTrimStartSec == null) return;

  const trim = pendingPlayTrimStartSec ?? 0;

  viewerPlayIntentActive = true;

  if (playbackRequiresUserGestureToStart()) {
    pendingPlayTrimStartSec = null;
    if (!playbackEngine.isPaused()) {
      playbackEngine.pause();
    }
    store.setIsPlaying(false);
    return;
  }

  pendingPlayTrimStartSec = null;
  startViewerEnginePlayback(trim);
}

/**
 * iOS Safari: ユーザータップの同期スタック内で一度 play してメディアを解放する。
 * 既に src があるときだけ有効。
 */
export function primeAudioForUserGesture(): void {
  const el = playbackEngine.getMediaElement();
  if (!el || !playbackEngine.getMediaSourceUrl()) return;
  const store = usePlaybackUiStore.getState();
  const keepPlaying =
    store.isPlaying || hasViewerPendingPlay() || viewerPlayIntentActive;
  const wasPaused = el.paused;
  void el.play().then(() => {
    if (wasPaused && !keepPlaying) {
      el.pause();
      store.setIsPlaying(false);
    }
  }).catch(() => {
    /* 未読み込み等 */
  });
}
