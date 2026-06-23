import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
import {
  applyWaveViewportZoomMultiplier,
  resolveWaveZoomPlayheadSec,
} from "../lib/waveViewportZoom";

type Params = {
  waveContainerRef: RefObject<HTMLDivElement | null>;
  durationRef: MutableRefObject<number>;
  viewPortionRef: MutableRefObject<number>;
  waveViewStartOverrideRef: MutableRefObject<number | null>;
  currentTimePropRef: MutableRefObject<number>;
  isPlayingForWaveRef: MutableRefObject<boolean>;
  cueDragRef: RefObject<{ armed: boolean } | null>;
  emptyWaveDragRef: RefObject<{ active: boolean } | null>;
  setViewPortion: Dispatch<SetStateAction<number>>;
  setWaveViewStartOverride: Dispatch<SetStateAction<number | null>>;
};

/**
 * 波形枠上のホイールで時間軸の拡大・縮小。
 * ズームの軸はカーソルではなく赤い再生バー（画面中央付近に固定）。
 */
export function useTimelineWaveWheelZoom({
  waveContainerRef,
  durationRef,
  viewPortionRef,
  waveViewStartOverrideRef,
  currentTimePropRef,
  isPlayingForWaveRef,
  cueDragRef,
  emptyWaveDragRef,
  setViewPortion,
  setWaveViewStartOverride,
}: Params) {
  useEffect(() => {
    const el = waveContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const d = durationRef.current;
      if (d <= 0) return;
      /** キュー枠の移動・リサイズ中はホイールズームを抑止（誤って一気に動くのを防ぐ） */
      if (
        cueDragRef.current?.armed === true ||
        emptyWaveDragRef.current?.active === true
      ) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      const dy = e.deltaY;
      if (dy === 0) return;
      /** deltaY>0 で縮小（見える時間幅↑）、<0 で拡大。トラックパッドの細かい delta に追従 */
      const mult = Math.exp(dy * 0.00115);
      const playheadSec = resolveWaveZoomPlayheadSec({
        currentTimeSec: currentTimePropRef.current,
        isPlaying: isPlayingForWaveRef.current,
      });

      setViewPortion((p) => {
        const { viewPortion, viewStartOverride } = applyWaveViewportZoomMultiplier({
          currentViewPortion: p,
          multiplier: mult,
          playheadSec,
          durationSec: d,
        });
        if (viewStartOverride != null) {
          setWaveViewStartOverride(viewStartOverride);
        } else if (viewPortion >= 1 - 1e-9) {
          setWaveViewStartOverride(null);
        }
        return viewPortion;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [
    waveContainerRef,
    durationRef,
    viewPortionRef,
    waveViewStartOverrideRef,
    currentTimePropRef,
    isPlayingForWaveRef,
    cueDragRef,
    emptyWaveDragRef,
    setViewPortion,
    setWaveViewStartOverride,
  ]);
}
