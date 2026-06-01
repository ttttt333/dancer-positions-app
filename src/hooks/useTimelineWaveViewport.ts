import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { PlaybackScrubSession } from "../lib/playbackTransport";
import { playbackEngine } from "../core/playbackEngine";
import {
  effectiveWaveViewStartOverride,
  quantizePlayheadForWaveView,
  resolveWaveDrawView,
  waveVisibleSpanSec,
} from "../lib/timelineWaveGeometry";

type PlayheadScrubDragRef = RefObject<{
  armed: boolean;
  scrubSession: PlaybackScrubSession | null;
} | null>;

type Params = {
  peaks: number[] | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playheadScrubDragRef?: PlayheadScrubDragRef;
};

/**
 * 波形の「見えている時間窓」: ズーム倍率・カーソル基準オーバーライド・再生中のアンカー補正。
 */
export function useTimelineWaveViewport({
  peaks,
  duration,
  currentTime,
  isPlaying,
  playheadScrubDragRef,
}: Params) {
  const [viewPortion, setViewPortion] = useState(1);
  const viewPortionRef = useRef(viewPortion);
  viewPortionRef.current = viewPortion;

  const [waveViewStartOverride, setWaveViewStartOverrideState] = useState<
    number | null
  >(null);
  const waveViewStartOverrideRef = useRef<number | null>(null);
  const setWaveViewStartOverride = useCallback((start: number | null) => {
    waveViewStartOverrideRef.current = start;
    setWaveViewStartOverrideState(start);
  }, []);

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
    if (duration <= 0) {
      return { start: 0, end: 1, span: 1 };
    }
    const override = effectiveWaveViewStartOverride(waveViewStartOverride, {
      viewPortion,
      isPlaying,
      playheadScrubArmed: playheadScrubDragRef?.current?.armed ?? false,
      enginePaused: !isPlaying || playbackEngine.isPaused(),
    });
    return resolveWaveDrawView({
      durationSec: duration,
      viewPortion,
      anchorTimeSec: waveViewAnchorSec,
      isPlaying,
      viewStartOverride: override,
    });
  }, [
    duration,
    viewPortion,
    waveViewAnchorSec,
    waveViewStartOverride,
    isPlaying,
    playheadScrubDragRef,
  ]);

  const setViewPortionSynced = useCallback((action: SetStateAction<number>) => {
    setViewPortion((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      viewPortionRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    setViewPortion(1);
    setWaveViewStartOverride(null);
  }, [peaks]);

  /** プレイヘッドがオーバーライドのビュー範囲外に出たら追従に戻す */
  useEffect(() => {
    if (isPlaying) return;
    if (playheadScrubDragRef?.current?.armed) return;
    if (waveViewStartOverride === null || duration <= 0) return;
    const span = waveVisibleSpanSec(duration, viewPortion);
    const margin = span * 0.15;
    let phSec = playheadGridSec;
    if (
      isPlaying &&
      !playbackEngine.isPaused() &&
      Number.isFinite(playbackEngine.getCurrentTime())
    ) {
      phSec = playbackEngine.getCurrentTime();
    }
    if (
      phSec < waveViewStartOverride - margin ||
      phSec > waveViewStartOverride + span + margin
    ) {
      setWaveViewStartOverride(null);
    }
  }, [
    playheadGridSec,
    waveViewStartOverride,
    duration,
    viewPortion,
    isPlaying,
    playheadScrubDragRef,
  ]);

  return {
    viewPortion,
    setViewPortion: setViewPortionSynced,
    viewPortionRef,
    waveViewStartOverride,
    setWaveViewStartOverride,
    waveViewStartOverrideRef,
    waveView,
  };
}
