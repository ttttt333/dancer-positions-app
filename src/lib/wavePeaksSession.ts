import { isWavePeaksResolutionStale } from "./computeWavePeaksFromChannelData";
import { isPlaceholderLikeWavePeaks } from "./placeholderWavePeaks";
import { putCachedPeaksPayload } from "./waveMediaCache";
import {
  setWavePeaksCache,
  wavePeaksCacheKeyForSupabase,
} from "./wavePeaksCache";
import { supabaseUploadWavePeaks } from "./supabaseWavePeaks";
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

function peaksAreUsableForDisplay(
  peaks: number[],
  durationSec?: number | null
): boolean {
  if (!peaks.length || isPlaceholderLikeWavePeaks(peaks)) return false;
  const dur = playbackDurationSec(durationSec ?? undefined) ?? durationSec ?? null;
  if (dur == null) return peaks.length >= 512;
  return !isWavePeaksResolutionStale(peaks, dur);
}

/** 表示中のピークが実波形として十分か（キャッシュキー不問） */
export function hasUsablePeaksInStore(durationSec?: number | null): boolean {
  const { peaks } = useWavePeaksStore.getState();
  if (!peaks?.length) return false;
  return peaksAreUsableForDisplay(peaks, durationSec);
}

/** 現在のピークがこの音源キー向けに十分な解像度か */
export function hasFreshPeaksForCacheKey(cacheKey: string): boolean {
  const { peaks, peaksCacheKey } = useWavePeaksStore.getState();
  if (!peaks?.length || peaksCacheKey !== cacheKey) return false;
  return peaksAreUsableForDisplay(peaks);
}

/** 表示中ピークを低解像度データで上書きすべきか */
export function shouldReplaceWavePeaks(
  incoming: WavePeaksPayload,
  currentPeaks: number[] | null
): boolean {
  if (!currentPeaks?.length) {
    return !isPlaceholderLikeWavePeaks(incoming.peaks);
  }
  const dur = playbackDurationSec(incoming.durationSec) ?? incoming.durationSec;
  if (isPlaceholderLikeWavePeaks(incoming.peaks)) return false;
  if (isPlaceholderLikeWavePeaks(currentPeaks)) return true;
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

/** 表示中の実波形を Supabase 音源パス向けキャッシュ／サイドカーへ保存 */
export async function persistUsablePeaksForSupabasePath(
  audioSupabasePath: string
): Promise<boolean> {
  const path = audioSupabasePath.trim();
  if (!path || !hasUsablePeaksInStore()) return false;
  const { peaks } = useWavePeaksStore.getState();
  if (!peaks?.length) return false;
  const ui = usePlaybackUiStore.getState();
  const durationSec =
    ui.trustedAudioDurationSec ?? ui.durationSec ?? null;
  if (durationSec == null || !(durationSec > 0)) return false;

  const cacheKey = wavePeaksCacheKeyForSupabase(path);
  useWavePeaksStore.getState().setPeaks(peaks, cacheKey);
  await setWavePeaksCache(cacheKey, peaks, durationSec);
  void putCachedPeaksPayload(cacheKey, peaks, durationSec);
  void supabaseUploadWavePeaks(path, peaks, durationSec);
  return true;
}
