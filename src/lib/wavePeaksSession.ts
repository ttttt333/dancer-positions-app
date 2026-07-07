import { isWavePeaksResolutionStale, resolveWavePeakBinCount } from "./computeWavePeaksFromChannelData";
import { QUICK_WAVEFORM_POINTS } from "./generateWaveformPeaks";
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

function resolveDurationSec(explicit?: number | null): number | null {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  return playbackDurationSec() ?? null;
}

/** Supabase サイドカーへ「確定版」として保存してよい解像度か */
export function peaksMeetSupabasePersistQuality(
  peaks: number[],
  durationSec: number
): boolean {
  if (!peaks.length || isPlaceholderLikeWavePeaks(peaks)) return false;
  const target = resolveWavePeakBinCount(durationSec);
  const minBins = Math.ceil(target * 0.85);
  if (peaks.length < minBins) return false;
  /** 固定ビン数のクイック波形を長尺向け確定データとして保存しない */
  if (target > QUICK_WAVEFORM_POINTS && peaks.length <= QUICK_WAVEFORM_POINTS) {
    return false;
  }
  return true;
}
function peaksAreUsableForDisplay(
  peaks: number[],
  durationSec?: number | null
): boolean {
  if (!peaks.length || isPlaceholderLikeWavePeaks(peaks)) return false;
  const dur = resolveDurationSec(durationSec);
  if (dur == null) return peaks.length >= 512;
  return !isWavePeaksResolutionStale(peaks, dur);
}

/** 表示中のピークが実波形として十分か（キャッシュキー不問） */
export function hasUsablePeaksInStore(durationSec?: number | null): boolean {
  const { peaks, peaksDurationSec } = useWavePeaksStore.getState();
  if (!peaks?.length) return false;
  return peaksAreUsableForDisplay(peaks, durationSec ?? peaksDurationSec);
}

/** 現在のピークがこの音源キー向けに十分な解像度か */
export function hasFreshPeaksForCacheKey(cacheKey: string): boolean {
  const { peaks, peaksCacheKey, peaksDurationSec } = useWavePeaksStore.getState();
  if (!peaks?.length || peaksCacheKey !== cacheKey) return false;
  return peaksAreUsableForDisplay(peaks, peaksDurationSec);
}

/**
 * 表示中ピークを incoming で置き換えるべきか。
 * current / incoming ともに payload 付属の尺で陳腐化判定する（playback UI 尺は使わない）。
 */
export function shouldReplaceWavePeaks(
  incoming: WavePeaksPayload,
  currentPeaks: number[] | null,
  currentDurationSec?: number | null
): boolean {
  if (!currentPeaks?.length) {
    return !isPlaceholderLikeWavePeaks(incoming.peaks);
  }
  if (isPlaceholderLikeWavePeaks(incoming.peaks)) return false;
  if (isPlaceholderLikeWavePeaks(currentPeaks)) return true;

  const incomingDur = incoming.durationSec;
  const currentDur =
    currentDurationSec != null &&
    Number.isFinite(currentDurationSec) &&
    currentDurationSec > 0
      ? currentDurationSec
      : incomingDur;

  if (isWavePeaksResolutionStale(currentPeaks, currentDur)) return true;
  if (isWavePeaksResolutionStale(incoming.peaks, incomingDur)) return false;

  /** 同じキーで既に十分な実波形がある場合は、より高解像度への昇格のみ許可 */
  return incoming.peaks.length > currentPeaks.length;
}

/** キャッシュ／サイドカーからピークを反映すべきか（ダウングレード防止） */
export function shouldApplyPeaksPayload(
  incoming: WavePeaksPayload,
  cacheKey: string | null | undefined
): boolean {
  const { peaks, peaksCacheKey, peaksDurationSec } = useWavePeaksStore.getState();
  if (!peaks?.length) return true;
  const key = cacheKey?.trim() || null;
  if (key && peaksCacheKey && key !== peaksCacheKey) return true;
  return shouldReplaceWavePeaks(incoming, peaks, peaksDurationSec);
}

export type CommitPeaksToStoreOptions = {
  cacheKey?: string | null;
  /** バックアップ復元など、上書き防止ガードを迂回する */
  force?: boolean;
};

/**
 * 波形ピークを store へ書き込む唯一のガード付き経路（復元の force 除く）。
 * @returns 反映した payload。拒否時は null
 */
export function commitPeaksToStoreIfAllowed(
  payload: WavePeaksPayload,
  opts?: CommitPeaksToStoreOptions
): WavePeaksPayload | null {
  if (!payload.peaks.length || !(payload.durationSec > 0)) return null;
  const cacheKey = opts?.cacheKey ?? null;
  if (!opts?.force && !shouldApplyPeaksPayload(payload, cacheKey)) {
    return null;
  }
  useWavePeaksStore
    .getState()
    .setPeaks(payload.peaks, cacheKey, payload.durationSec);
  return payload;
}

/** キャッシュ／サイドカーへピークを書き込む（store 反映成功後のみ呼ぶ） */
export async function persistWavePeaksPayload(
  payload: WavePeaksPayload,
  opts: {
    cacheKey?: string | null;
    supabaseAudioPath?: string | null;
  }
): Promise<void> {
  const cacheKey = opts.cacheKey?.trim() || null;
  const supabaseAudioPath = opts.supabaseAudioPath?.trim() || null;
  const { peaks, durationSec } = payload;
  if (!peaks.length || !(durationSec > 0)) return;
  if (isPlaceholderLikeWavePeaks(peaks)) return;

  if (cacheKey) {
    await setWavePeaksCache(cacheKey, peaks, durationSec);
    void putCachedPeaksPayload(cacheKey, peaks, durationSec);
  }
  if (supabaseAudioPath && !isPlaceholderLikeWavePeaks(peaks)) {
    void supabaseUploadWavePeaks(supabaseAudioPath, peaks, durationSec);
  }
}

/** 表示中の実波形を別キャッシュキーへ紐づけ直す（ピーク内容は変えない） */
export function rebindStorePeaksCacheKey(cacheKey: string): boolean {
  const key = cacheKey.trim();
  if (!key || !hasUsablePeaksInStore()) return false;
  const { peaks, peaksCacheKey, peaksDurationSec } = useWavePeaksStore.getState();
  if (!peaks?.length) return false;
  if (peaksCacheKey === key) return true;
  const durationSec = peaksDurationSec ?? playbackDurationSec();
  if (durationSec == null || !(durationSec > 0)) return false;
  useWavePeaksStore.getState().setPeaks(peaks, key, durationSec);
  return true;
}

/** 表示中の実波形を Supabase 音源パス向けキャッシュ／サイドカーへ保存 */
export async function persistUsablePeaksForSupabasePath(
  audioSupabasePath: string
): Promise<boolean> {
  const path = audioSupabasePath.trim();
  if (!path || !hasUsablePeaksInStore()) return false;
  const { peaks, peaksDurationSec } = useWavePeaksStore.getState();
  if (!peaks?.length) return false;
  const durationSec = peaksDurationSec ?? playbackDurationSec();
  if (durationSec == null || !(durationSec > 0)) return false;
  if (!peaksMeetSupabasePersistQuality(peaks, durationSec)) return false;

  const cacheKey = wavePeaksCacheKeyForSupabase(path);
  if (!rebindStorePeaksCacheKey(cacheKey)) return false;
  await persistWavePeaksPayload(
    { peaks, durationSec },
    { cacheKey, supabaseAudioPath: path }
  );
  return true;
}
