import { playbackEngine } from "../core/playbackEngine";

/** 再生エンジンが有効なら現在時刻、それ以外は null */
export function getLiveEngineTimeSecOrNull(): number | null {
  if (
    playbackEngine.getMediaSourceUrl() &&
    !playbackEngine.isPaused() &&
    Number.isFinite(playbackEngine.getCurrentTime())
  ) {
    return playbackEngine.getCurrentTime();
  }
  return null;
}

/** 再生中は engine の現在時刻、それ以外は fallback を返す（波形スクラブ用） */
export function getLivePlaybackHeadSec(fallbackSec: number): number {
  return getLiveEngineTimeSecOrNull() ?? fallbackSec;
}
