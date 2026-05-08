import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { useEffect } from "react";

type Params = {
  waveContainerRef: RefObject<HTMLDivElement | null>;
  durationRef: MutableRefObject<number>;
  lastWaveDrawRangeRef: MutableRefObject<{ viewStart: number; viewSpan: number }>;
  isPlayingForWaveRef: MutableRefObject<boolean>;
  setViewPortion: Dispatch<SetStateAction<number>>;
  setWaveViewStartOverride: Dispatch<SetStateAction<number | null>>;
};

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
      const rect = el.getBoundingClientRect();
      const cursorFrac =
        rect.width > 0
          ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
          : 0.5;

      /** 現在の viewStart/viewSpan を取得（最後に描画された範囲） */
      const { viewStart, viewSpan } = lastWaveDrawRangeRef.current;

      /** カーソル位置が示す時刻 */
      const tCursor = viewStart + cursorFrac * viewSpan;

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
