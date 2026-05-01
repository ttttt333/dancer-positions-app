import { useEffect, useMemo, useRef, useState } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  getWaveViewForDraw,
  quantizePlayheadForWaveView,
} from "../lib/timelineWaveGeometry";

type Params = {
  peaks: number[] | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
};

/**
 * 波形の「見えている時間窓」: ズーム倍率・カーソル基準オーバーライド・再生中のアンカー補正。
 */
export function useTimelineWaveViewport({
  peaks,
  duration,
  currentTime,
  isPlaying,
}: Params) {
  const [viewPortion, setViewPortion] = useState(1);
  const viewPortionRef = useRef(viewPortion);
  viewPortionRef.current = viewPortion;

  const [waveViewStartOverride, setWaveViewStartOverride] = useState<
    number | null
  >(null);
  const waveViewStartOverrideRef = useRef<number | null>(null);
  waveViewStartOverrideRef.current = waveViewStartOverride;

  const playheadGridSec = useMemo(
    () => (isPlaying ? quantizePlayheadForWaveView(currentTime) : currentTime),
    [currentTime, isPlaying]
  );

  /**
   * 再生中のズーム操作では親 `currentTime` 反映が 1 テンポ遅れることがあり、
   * 波形窓の基準だけ古い時刻で再計算されると赤バーが相対的にズレて見える。
   * そのため再生中は audio 要素の現在時刻を優先して、ズーム基準を常に実再生位置に合わせる。
   */
  const waveViewAnchorSec = useMemo(() => {
    if (!isPlaying) return playheadGridSec;
    if (
      !playbackEngine.isPaused() &&
      Number.isFinite(playbackEngine.getCurrentTime())
    ) {
      return playbackEngine.getCurrentTime();
    }
    return playheadGridSec;
  }, [isPlaying, playheadGridSec, viewPortion]);

  const waveView = useMemo(() => {
    /** 再生中はオーバーライドを無視してプレイヘッド追従 */
    if (waveViewStartOverride !== null && !isPlaying && duration > 0) {
      const span = Math.max(0.08, duration * viewPortion);
      return {
        start: waveViewStartOverride,
        end: waveViewStartOverride + span,
        span,
      };
    }
    return getWaveViewForDraw(duration, viewPortion, waveViewAnchorSec);
  }, [duration, viewPortion, waveViewAnchorSec, waveViewStartOverride, isPlaying]);

  useEffect(() => {
    setViewPortion(1);
    setWaveViewStartOverride(null);
  }, [peaks]);

  /** 再生開始時はオーバーライドを解除してプレイヘッド追従に戻す */
  useEffect(() => {
    if (isPlaying) setWaveViewStartOverride(null);
  }, [isPlaying]);

  /** プレイヘッドがオーバーライドのビュー範囲外に出たら追従に戻す */
  useEffect(() => {
    if (waveViewStartOverride === null || duration <= 0) return;
    const span = Math.max(0.08, duration * viewPortion);
    const margin = span * 0.15;
    if (
      playheadGridSec < waveViewStartOverride - margin ||
      playheadGridSec > waveViewStartOverride + span + margin
    ) {
      setWaveViewStartOverride(null);
    }
  }, [playheadGridSec, waveViewStartOverride, duration, viewPortion]);

  return {
    viewPortion,
    setViewPortion,
    viewPortionRef,
    waveViewStartOverride,
    setWaveViewStartOverride,
    waveViewStartOverrideRef,
    waveView,
  };
}
