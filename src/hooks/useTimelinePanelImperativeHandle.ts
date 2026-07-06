import {
  useCallback,
  useImperativeHandle,
  type MutableRefObject,
  type Ref,
} from "react";
import { playbackEngine } from "../core/playbackEngine";
import type { TimelinePanelHandle } from "../components/timelinePanelTypes";
import { refinePeaksForTimeline } from "../lib/computeWavePeaksFromChannelData";
import { commitPeaksToStoreIfAllowed } from "../lib/wavePeaksSession";

type Params = {
  ref: Ref<TimelinePanelHandle>;
  peaksRef: MutableRefObject<number[] | null>;
  setDuration: (sec: number) => void;
  setPlaybackTrustedDurationSec: (sec: number) => void;
  togglePlay: () => void;
  stopPlayback: () => void;
  seekForward5Sec: () => void;
  seekBackward5Sec: () => void;
  openAudioImport: () => void;
};

export function useTimelinePanelImperativeHandle({
  ref,
  peaksRef,
  setDuration,
  setPlaybackTrustedDurationSec,
  togglePlay,
  stopPlayback,
  seekForward5Sec,
  seekBackward5Sec,
  openAudioImport,
}: Params) {
  const getWavePeaksSnapshot = useCallback((): number[] | null => {
    const p = peaksRef.current;
    if (!p || p.length === 0) return null;
    return [...p];
  }, [peaksRef]);

  const restoreWavePeaks = useCallback(
    (nextPeaks: number[], durationSec?: number) => {
      if (
        nextPeaks.length > 0 &&
        durationSec != null &&
        Number.isFinite(durationSec) &&
        durationSec > 0
      ) {
        const peaks = refinePeaksForTimeline(nextPeaks, durationSec);
        commitPeaksToStoreIfAllowed({ peaks, durationSec }, { force: true });
        setPlaybackTrustedDurationSec(durationSec);
        setDuration(durationSec);
      }
    },
    [setDuration, setPlaybackTrustedDurationSec]
  );

  const getCurrentAudioBlobForFlowLibrary =
    useCallback(async (): Promise<Blob | null> => {
      const url = playbackEngine.getMediaSourceUrl();
      if (!url) return null;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.blob();
      } catch {
        return null;
      }
    }, []);

  useImperativeHandle(
    ref,
    () => ({
      togglePlay,
      stopPlayback,
      seekForward5Sec,
      seekBackward5Sec,
      openAudioImport,
      getWavePeaksSnapshot,
      restoreWavePeaks,
      getCurrentAudioBlobForFlowLibrary,
    }),
    [
      togglePlay,
      stopPlayback,
      seekForward5Sec,
      seekBackward5Sec,
      openAudioImport,
      getWavePeaksSnapshot,
      restoreWavePeaks,
      getCurrentAudioBlobForFlowLibrary,
    ]
  );
}
