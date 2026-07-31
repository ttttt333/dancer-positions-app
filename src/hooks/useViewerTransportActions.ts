import { useCallback, useRef } from "react";
import type { RefObject } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import type { TimelinePanelHandle } from "../components/timelinePanelTypes";
import { playbackEngine } from "../core/playbackEngine";
import {
  seekPlaybackClampedAndSyncStore,
  stopPlaybackAtTrimStart,
} from "../lib/playbackTransport";
import { primeAudioForUserGesture } from "../lib/playbackViewerIntent";
import {
  toggleViewerPlayback,
  tryStartViewerPlaybackFromUserGesture,
} from "../lib/viewerPlayback";
import { tryEnterViewerFullscreen } from "../lib/viewerFullscreen";

type Args = {
  project: ChoreographyProjectJson;
  timelineRef?: RefObject<TimelinePanelHandle | null>;
  trimStartSec: number;
  trimEndSec: number | null;
  duration: number;
  onBeforeTransport?: () => void | Promise<void>;
};

export function useViewerTransportActions({
  project,
  timelineRef,
  trimStartSec,
  trimEndSec,
  duration,
  onBeforeTransport,
}: Args) {
  const playGestureHandledRef = useRef(false);

  const seekBack = useCallback(() => {
    onBeforeTransport?.();
    if (playbackEngine.getMediaSourceUrl()) {
      seekPlaybackClampedAndSyncStore({
        t: playbackEngine.getCurrentTime() - 5,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
      });
      return;
    }
    timelineRef?.current?.seekBackward5Sec();
  }, [duration, onBeforeTransport, timelineRef, trimEndSec, trimStartSec]);

  const seekForward = useCallback(() => {
    onBeforeTransport?.();
    if (playbackEngine.getMediaSourceUrl()) {
      seekPlaybackClampedAndSyncStore({
        t: playbackEngine.getCurrentTime() + 5,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
      });
      return;
    }
    timelineRef?.current?.seekForward5Sec();
  }, [duration, onBeforeTransport, timelineRef, trimEndSec, trimStartSec]);

  const onPlayPointerDown = useCallback(() => {
    // Galaxy 等: 再生操作のユーザージェスチャでブラウザ UI を隠して最大化
    tryEnterViewerFullscreen();
    if (tryStartViewerPlaybackFromUserGesture(project, trimStartSec)) {
      playGestureHandledRef.current = true;
      return;
    }
    primeAudioForUserGesture();
  }, [project, trimStartSec]);

  const togglePlay = useCallback(() => {
    if (playGestureHandledRef.current) {
      playGestureHandledRef.current = false;
      if (!playbackEngine.isPaused()) return;
    }
    if (!playbackEngine.getMediaSourceUrl()) {
      void onBeforeTransport?.();
    }
    const starting =
      playbackEngine.isPaused() || !playbackEngine.getMediaSourceUrl();
    if (starting) tryEnterViewerFullscreen();
    toggleViewerPlayback(project, trimStartSec);
  }, [onBeforeTransport, project, trimStartSec]);

  const stopPlayback = useCallback(() => {
    onBeforeTransport?.();
    if (playbackEngine.getMediaSourceUrl()) {
      stopPlaybackAtTrimStart(trimStartSec);
      return;
    }
    timelineRef?.current?.stopPlayback();
  }, [onBeforeTransport, timelineRef, trimStartSec]);

  return {
    seekBack,
    seekForward,
    onPlayPointerDown,
    togglePlay,
    stopPlayback,
  };
}
