import { useCallback, useRef } from "react";
import type { TimelinePanelHandle } from "../components/timelinePanelTypes";
import { useWavePeaksStore } from "../store/wavePeaksStore";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { playbackEngine } from "../core/playbackEngine";

type Options = {
  /** TimelinePanel ref 経由ではなく直接ファイル選択を開く */
  openAudioImport?: () => void;
};

/**
 * タイムラインの imperative API（波形・音源インポート）を Editor から束ねる。
 * 再生トグル等は `playbackTransport` 側へ寄せ続ける前提で、ここはメディア UI の窓口のみ。
 */
export function useTimelineMediaHandle(options: Options = {}) {
  const timelineRef = useRef<TimelinePanelHandle>(null);
  const directOpenAudioImport = options.openAudioImport;

  const getWavePeaksSnapshot = useCallback((): number[] | null => {
    const fromStore = useWavePeaksStore.getState().peaks;
    if (fromStore && fromStore.length > 0) return [...fromStore];
    return timelineRef.current?.getWavePeaksSnapshot() ?? null;
  }, []);

  const restoreWavePeaks = useCallback(
    (peaks: number[], durationSec?: number) => {
      if (peaks.length > 0) {
        useWavePeaksStore.getState().setPeaks([...peaks]);
      }
      if (durationSec != null && Number.isFinite(durationSec) && durationSec > 0) {
        usePlaybackUiStore.getState().setTrustedAudioDurationSec(durationSec);
        usePlaybackUiStore.getState().setDurationSec(durationSec);
      }
      timelineRef.current?.restoreWavePeaks(peaks, durationSec);
    },
    []
  );

  const getCurrentAudioBlobForFlowLibrary = useCallback(
    () =>
      timelineRef.current?.getCurrentAudioBlobForFlowLibrary() ??
      (async () => {
        const url = playbackEngine.getMediaSourceUrl();
        if (!url) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          return await res.blob();
        } catch {
          return null;
        }
      })(),
    []
  );

  const openAudioImport = useCallback(() => {
    if (directOpenAudioImport) {
      directOpenAudioImport();
      return;
    }
    timelineRef.current?.openAudioImport();
  }, [directOpenAudioImport]);

  return {
    timelineRef,
    getWavePeaksSnapshot,
    restoreWavePeaks,
    getCurrentAudioBlobForFlowLibrary,
    openAudioImport,
  };
}
