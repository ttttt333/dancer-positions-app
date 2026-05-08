import { useCallback } from "react";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

/** タイムラインが参照する再生 UI（時刻・再生中・尺・信頼尺の設定） */
export function useTimelinePlaybackUi() {
  const currentTime = usePlaybackUiStore((s) => s.currentTimeSec);
  const setCurrentTime = usePlaybackUiStore((s) => s.setCurrentTimeSec);
  const isPlaying = usePlaybackUiStore((s) => s.isPlaying);
  const duration = usePlaybackUiStore((s) => s.durationSec);
  const setDuration = usePlaybackUiStore((s) => s.setDurationSec);
  const setPlaybackTrustedDurationSec = useCallback((sec: number) => {
    usePlaybackUiStore.getState().setTrustedAudioDurationSec(sec);
  }, []);

  return {
    currentTime,
    setCurrentTime,
    isPlaying,
    duration,
    setDuration,
    setPlaybackTrustedDurationSec,
  };
}
