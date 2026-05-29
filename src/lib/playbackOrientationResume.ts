import { playbackEngine } from "../core/playbackEngine";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

/** iOS 等: 画面回転で HTMLAudio が一時停止することがあるため、意図的な再生中は再開する */
export function resumePlaybackIfInterrupted(): void {
  const { isPlaying } = usePlaybackUiStore.getState();
  if (!isPlaying) return;
  if (!playbackEngine.getMediaSourceUrl()) return;
  if (!playbackEngine.isPaused()) return;
  void playbackEngine.play().catch(() => {
    /* ユーザー操作待ち等 */
  });
}

export function bindPlaybackOrientationResume(): () => void {
  const onResume = () => {
    window.setTimeout(resumePlaybackIfInterrupted, 120);
  };
  window.addEventListener("orientationchange", onResume);
  window.addEventListener("resize", onResume);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onResume);
  }
  return () => {
    window.removeEventListener("orientationchange", onResume);
    window.removeEventListener("resize", onResume);
    document.removeEventListener("visibilitychange", onResume);
  };
}
