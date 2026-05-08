import {
  useCallback,
  useImperativeHandle,
  type Dispatch,
  type MutableRefObject,
  type Ref,
  type SetStateAction,
} from "react";
import { playbackEngine } from "../core/playbackEngine";
import type { TimelinePanelHandle } from "../components/timelinePanelTypes";

type Params = {
  ref: Ref<TimelinePanelHandle>;
  peaksRef: MutableRefObject<number[] | null>;
  setPeaks: Dispatch<SetStateAction<number[] | null>>;
  setDuration: (sec: number) => void;
  setPlaybackTrustedDurationSec: (sec: number) => void;
  togglePlay: () => void;
  stopPlayback: () => void;
  openAudioImport: () => void;
};

export function useTimelinePanelImperativeHandle({
  ref,
  peaksRef,
  setPeaks,
  setDuration,
  setPlaybackTrustedDurationSec,
  togglePlay,
  stopPlayback,
  openAudioImport,
}: Params) {
  const getWavePeaksSnapshot = useCallback((): number[] | null => {
    const p = peaksRef.current;
    if (!p || p.length === 0) return null;
    return [...p];
  }, [peaksRef]);

  const restoreWavePeaks = useCallback(
    (nextPeaks: number[], durationSec?: number) => {
      if (nextPeaks.length > 0) {
        setPeaks([...nextPeaks]);
      }
      if (durationSec != null && Number.isFinite(durationSec) && durationSec > 0) {
        setPlaybackTrustedDurationSec(durationSec);
        setDuration(durationSec);
      }
    },
    [setPeaks, setDuration, setPlaybackTrustedDurationSec]
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
      openAudioImport,
      getWavePeaksSnapshot,
      restoreWavePeaks,
      getCurrentAudioBlobForFlowLibrary,
    }),
    [
      togglePlay,
      stopPlayback,
      openAudioImport,
      getWavePeaksSnapshot,
      restoreWavePeaks,
      getCurrentAudioBlobForFlowLibrary,
    ]
  );
}
