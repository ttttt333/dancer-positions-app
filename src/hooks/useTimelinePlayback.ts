import { useCallback } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  seekPlaybackClampedAndSyncStore,
  stopPlaybackAtTrimStart,
  togglePlaybackRespectingTrimStart,
} from "../lib/playbackTransport";

export type UseTimelinePlaybackParams = {
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number | null;
};

/**
 * タイムライン用: 再生トグル・±5 秒シーク・トリム先頭への停止。
 */
export function useTimelinePlayback({
  durationSec,
  trimStartSec,
  trimEndSec,
}: UseTimelinePlaybackParams) {
  const togglePlay = useCallback(() => {
    togglePlaybackRespectingTrimStart(trimStartSec);
  }, [trimStartSec]);

  const seekForward5Sec = useCallback(() => {
    seekPlaybackClampedAndSyncStore({
      t: playbackEngine.getCurrentTime() + 5,
      durationSec,
      trimStartSec,
      trimEndSec,
    });
  }, [durationSec, trimEndSec, trimStartSec]);

  const seekBackward5Sec = useCallback(() => {
    seekPlaybackClampedAndSyncStore({
      t: playbackEngine.getCurrentTime() - 5,
      durationSec,
      trimStartSec,
      trimEndSec,
    });
  }, [durationSec, trimEndSec, trimStartSec]);

  const stopPlayback = useCallback(() => {
    stopPlaybackAtTrimStart(trimStartSec);
  }, [trimStartSec]);

  return {
    togglePlay,
    seekForward5Sec,
    seekBackward5Sec,
    stopPlayback,
  };
}
