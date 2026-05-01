import { useCallback, useRef } from "react";
import type { TimelinePanelHandle } from "../components/timelinePanelTypes";

/**
 * タイムラインの imperative API（波形・音源インポート）を Editor から束ねる。
 * 再生トグル等は `playbackTransport` 側へ寄せ続ける前提で、ここはメディア UI の窓口のみ。
 */
export function useTimelineMediaHandle() {
  const timelineRef = useRef<TimelinePanelHandle>(null);

  const getWavePeaksSnapshot = useCallback(
    () => timelineRef.current?.getWavePeaksSnapshot() ?? null,
    []
  );

  const restoreWavePeaks = useCallback(
    (peaks: number[], durationSec?: number) => {
      timelineRef.current?.restoreWavePeaks(peaks, durationSec);
    },
    []
  );

  const getCurrentAudioBlobForFlowLibrary = useCallback(
    () =>
      timelineRef.current?.getCurrentAudioBlobForFlowLibrary() ??
      Promise.resolve(null),
    []
  );

  const openAudioImport = useCallback(() => {
    timelineRef.current?.openAudioImport();
  }, []);

  return {
    timelineRef,
    getWavePeaksSnapshot,
    restoreWavePeaks,
    getCurrentAudioBlobForFlowLibrary,
    openAudioImport,
  };
}
