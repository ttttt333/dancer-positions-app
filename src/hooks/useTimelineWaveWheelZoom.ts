import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
import { waveExtentXToTime } from "../lib/timelineWaveGeometry";

type Params = {
  waveContainerRef: RefObject<HTMLDivElement | null>;
  durationRef: MutableRefObject<number>;
  lastWaveDrawRangeRef: MutableRefObject<{ viewStart: number; viewSpan: number }>;
  isPlayingForWaveRef: MutableRefObject<boolean>;
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
  lastWaveDrawRangeRef,
  isPlayingForWaveRef,
  setViewPortion,
  setWaveViewStartOverride,
}: Params) {
  useEffect(() => {
    const el = waveContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const d = durationRef.current;
      if (d <= 0) return;
      e.preventDefault();
      const dy = e.deltaY;
      if (dy === 0) return;
      /** deltaY>0 で縮小（見える時間幅↑）、<0 で拡大。トラックパッドの細かい delta に追従 */
      const mult = Math.exp(dy * 0.00115);

      /** カーソル位置の横方向割合（0〜1）を求めてズームの軸とする */
      const canvas = el.querySelector("canvas");
      const rect = canvas?.getBoundingClientRect() ?? el.getBoundingClientRect();
      const xPx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));

      /** 現在の viewStart/viewSpan を取得（最後に描画された範囲） */
      const { viewStart, viewSpan } = lastWaveDrawRangeRef.current;

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

        /** 再生中はオーバーライドしない（プレイヘッド追従を維持） */
        if (!isPlayingForWaveRef.current) {
          if (newVp >= 1 - 1e-9) {
            setWaveViewStartOverride(null);
          } else {
            const newStart = Math.max(0, Math.min(d - newSpan, tCursor - cursorFrac * newSpan));
            setWaveViewStartOverride(newStart);
          }
        }
        return newVp;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [
    waveContainerRef,
    durationRef,
    lastWaveDrawRangeRef,
    isPlayingForWaveRef,
    setViewPortion,
    setWaveViewStartOverride,
  ]);
}
