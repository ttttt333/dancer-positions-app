import { isWavePeaksResolutionStale } from "./computeWavePeaksFromChannelData";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { useWavePeaksStore } from "../store/wavePeaksStore";

export type WavePeaksPayload = {
  peaks: number[];
  durationSec: number;
};

function playbackDurationSec(fallbackSec?: number): number | null {
  const ui = usePlaybackUiStore.getState();
  const d = ui.trustedAudioDurationSec ?? ui.durationSec ?? fallbackSec ?? null;
  return d != null && Number.isFinite(d) && d > 0 ? d : null;
}

/** 現在のピークがこの音源キー向けに十分な解像度か */
export function hasFreshPeaksForCacheKey(cacheKey: string): boolean {
  const { peaks, peaksCacheKey } = useWavePeaksStore.getState();
  if (!peaks?.length || peaksCacheKey !== cacheKey) return false;
  const dur = playbackDurationSec();
  return dur != null && !isWavePeaksResolutionStale(peaks, dur);
}

/** 表示中ピークを低解像度データで上書きすべきか */
export function shouldReplaceWavePeaks(
  incoming: WavePeaksPayload,
  currentPeaks: number[] | null
): boolean {
  if (!currentPeaks?.length) return true;
  const dur = playbackDurationSec(incoming.durationSec) ?? incoming.durationSec;
  if (isWavePeaksResolutionStale(currentPeaks, dur)) return true;
  if (isWavePeaksResolutionStale(incoming.peaks, incoming.durationSec)) {
    return false;
  }
  return incoming.peaks.length > currentPeaks.length;
}

/** キャッシュ／サイドカーからピークを反映すべきか（ダウングレード防止） */
export function shouldApplyPeaksPayload(
  incoming: WavePeaksPayload,
  cacheKey: string | null | undefined
): boolean {
  const { peaks, peaksCacheKey } = useWavePeaksStore.getState();
  if (!peaks?.length) return true;
  const key = cacheKey?.trim() || null;
  if (key && peaksCacheKey && key !== peaksCacheKey) return true;
  if (key && hasFreshPeaksForCacheKey(key)) {
    return shouldReplaceWavePeaks(incoming, peaks);
  }
  return shouldReplaceWavePeaks(incoming, peaks);
}
