import { useCallback } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import {
  applyWaveViewportZoomStep,
  resolveWaveZoomPlayheadSec,
  type WaveZoomDirection,
} from "../lib/waveViewportZoom";

type Params = {
  durationRef: MutableRefObject<number>;
  currentTimePropRef: MutableRefObject<number>;
  isPlayingForWaveRef: MutableRefObject<boolean>;
  cueDragRef: RefObject<{ armed: boolean } | null>;
  emptyWaveDragRef: RefObject<{ active: boolean } | null>;
  setViewPortion: Dispatch<SetStateAction<number>>;
  setWaveViewStartOverride: Dispatch<SetStateAction<number | null>>;
};

export function useTimelineWaveButtonZoom({
  durationRef,
  currentTimePropRef,
  isPlayingForWaveRef,
  cueDragRef,
  emptyWaveDragRef,
  setViewPortion,
  setWaveViewStartOverride,
}: Params) {
  const applyZoom = useCallback(
    (direction: WaveZoomDirection) => {
      const durationSec = durationRef.current;
      if (durationSec <= 0) return;
      if (
        cueDragRef.current?.armed === true ||
        emptyWaveDragRef.current?.active === true
      ) {
        return;
      }

      const playheadSec = resolveWaveZoomPlayheadSec({
        currentTimeSec: currentTimePropRef.current,
        isPlaying: isPlayingForWaveRef.current,
      });

      setViewPortion((currentViewPortion) => {
        const { viewPortion, viewStartOverride } = applyWaveViewportZoomStep({
          currentViewPortion,
          direction,
          playheadSec,
          durationSec,
        });
        if (viewStartOverride != null) {
          setWaveViewStartOverride(viewStartOverride);
        } else if (viewPortion >= 1 - 1e-9) {
          setWaveViewStartOverride(null);
        }
        return viewPortion;
      });
    },
    [
      cueDragRef,
      currentTimePropRef,
      durationRef,
      emptyWaveDragRef,
      isPlayingForWaveRef,
      setViewPortion,
      setWaveViewStartOverride,
    ]
  );

  const zoomWaveIn = useCallback(() => applyZoom("in"), [applyZoom]);
  const zoomWaveOut = useCallback(() => applyZoom("out"), [applyZoom]);

  return { zoomWaveIn, zoomWaveOut };
}
