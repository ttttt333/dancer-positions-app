import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  resolveWaveViewForPointerHit,
  waveExtentXToTime,
} from "../lib/timelineWaveGeometry";

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

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * 波形枠上のホイールで時間軸の拡大・縮小（カーソル位置を軸に `viewPortion` と表示開始を更新）。
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

      /** カーソル位置の横方向割合（0〜1）を求めてズームの軸とする */
      const canvas = el.querySelector("canvas");
      const rect = canvas?.getBoundingClientRect() ?? el.getBoundingClientRect();
      const xPx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));

      let anchorSec = currentTimePropRef.current;
      if (
        isPlayingForWaveRef.current &&
        playbackEngine.getMediaSourceUrl() &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
      ) {
        anchorSec = playbackEngine.getCurrentTime();
      }
      const { viewStart, viewSpan } = resolveWaveViewForPointerHit({
        durationSec: d,
        viewPortion: viewPortionRef.current,
        isPlaying: isPlayingForWaveRef.current,
        viewStartOverride: waveViewStartOverrideRef.current,
        anchorTimeSec: anchorSec,
        playheadScrubArmed: false,
        enginePaused:
          !isPlayingForWaveRef.current || playbackEngine.isPaused(),
      });

      /** カーソル位置が示す時刻（波形左右余白込み） */
      const tCursor =
        viewSpan > 0 && rect.width > 0
          ? waveExtentXToTime(xPx, viewStart, viewSpan, rect.width)
          : viewStart + viewSpan / 2;
      const cursorFrac =
        viewSpan > 0 ? clamp01((tCursor - viewStart) / viewSpan) : 0.5;

      setViewPortion((p) => {
        const newVp = Math.min(1, Math.max(0.025, p * mult));
        const newSpan = Math.max(0.08, d * newVp);

        if (newVp >= 1 - 1e-9) {
          setWaveViewStartOverride(null);
        } else {
          const newStart = Math.max(
            0,
            Math.min(d - newSpan, tCursor - cursorFrac * newSpan)
          );
          setWaveViewStartOverride(newStart);
        }
        return newVp;
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
