import type { MutableRefObject } from "react";
import type { DecodePeaksOptions } from "../../hooks/useTimelineWaveDecode";
import { isWavePeaksResolutionStale } from "../computeWavePeaksFromChannelData";
import { isPlaceholderLikeWavePeaks } from "../placeholderWavePeaks";
import {
  resolveServerAssetWavePeaks,
  resolveSupabaseReuseWavePeaks,
} from "../resolveRemoteWavePeaks";
import { getWavePeaksCache } from "../wavePeaksCache";
import {
  hasFreshPeaksForCacheKey,
  persistWavePeaksPayload,
  rebindStorePeaksCacheKey,
  shouldApplyPeaksPayload,
} from "../wavePeaksSession";
import { useWavePeaksStore } from "../../store/wavePeaksStore";
import type { DecodePeaksFn, IsCancelled } from "./types";

export function hasWavePeaksInStore(): boolean {
  return (useWavePeaksStore.getState().peaks?.length ?? 0) > 0;
}

/** 表示中の実波形を新しいキャッシュキーへ紐づけ（ピーク配列は変更しない） */
export async function rebindUsablePeaksToCacheKey(
  cacheKey: string
): Promise<boolean> {
  if (!rebindStorePeaksCacheKey(cacheKey)) return false;
  const { peaks, peaksDurationSec } = useWavePeaksStore.getState();
  if (!peaks?.length || peaksDurationSec == null || !(peaksDurationSec > 0)) {
    return false;
  }
  await persistWavePeaksPayload(
    { peaks, durationSec: peaksDurationSec },
    { cacheKey }
  );
  return true;
}

export function sidecarPeaksAreUsable(
  sidecar: { peaks: number[]; durationSec: number } | null | undefined
): boolean {
  if (!sidecar?.peaks.length) return false;
  return (
    !isPlaceholderLikeWavePeaks(sidecar.peaks) &&
    !isWavePeaksResolutionStale(sidecar.peaks, sidecar.durationSec)
  );
}

/** キャッシュ済みピークを precomputed 経由で反映（空バッファ decode の失敗を避ける） */
export async function tryApplyCachedPeaksFromStore(
  decodePeaksRef: MutableRefObject<DecodePeaksFn>,
  cacheKey: string,
  cached: { peaks: number[]; durationSec: number } | null | undefined,
  extra?: Pick<DecodePeaksOptions, "supabaseAudioPath">
): Promise<boolean> {
  if (!cached?.peaks.length) return false;
  if (
    hasFreshPeaksForCacheKey(cacheKey) ||
    !shouldApplyPeaksPayload(
      { peaks: cached.peaks, durationSec: cached.durationSec },
      cacheKey
    )
  ) {
    return hasWavePeaksInStore();
  }
  try {
    await decodePeaksRef.current(new ArrayBuffer(0), {
      cacheKey,
      ...extra,
      previewOnly: true,
      precomputed: {
        peaks: cached.peaks,
        durationSec: cached.durationSec,
      },
    });
    return hasWavePeaksInStore();
  } catch (e) {
    console.warn("[wavePeaks] cached peaks apply failed:", e);
    return false;
  }
}

export async function ensureServerPeaksOnly(
  assetId: number,
  readBuffer: () => Promise<ArrayBuffer>,
  decodePeaksRef: MutableRefObject<DecodePeaksFn>,
  cacheKey: string,
  cancelled: IsCancelled
) {
  if (cancelled()) return;
  await resolveServerAssetWavePeaks(
    assetId,
    readBuffer,
    (buf, options) => decodePeaksRef.current(buf, options),
    { cacheKey }
  );
}

export async function ensureSupabasePeaksOnly(
  path: string,
  readBuffer: () => Promise<ArrayBuffer>,
  decodePeaksRef: MutableRefObject<DecodePeaksFn>,
  cacheKey: string,
  cancelled: IsCancelled
) {
  if (cancelled()) return;
  await resolveSupabaseReuseWavePeaks(
    path,
    readBuffer,
    (buf, options) => decodePeaksRef.current(buf, options),
    { cacheKey, supabaseAudioPath: path }
  );
}

export async function tryApplyCachedPeaksEarly(
  cacheKey: string,
  decodePeaksRef: MutableRefObject<DecodePeaksFn>,
  cancelled: IsCancelled,
  extra?: Pick<DecodePeaksOptions, "supabaseAudioPath">
): Promise<boolean> {
  if (hasFreshPeaksForCacheKey(cacheKey)) return true;
  const cached = await getWavePeaksCache(cacheKey);
  if (!cached?.peaks.length || cancelled()) return false;
  if (
    !shouldApplyPeaksPayload(
      { peaks: cached.peaks, durationSec: cached.durationSec },
      cacheKey
    )
  ) {
    return hasWavePeaksInStore();
  }
  await decodePeaksRef.current(new ArrayBuffer(0), {
    cacheKey,
    previewOnly: true,
    precomputed: { peaks: cached.peaks, durationSec: cached.durationSec },
    ...extra,
  });
  return true;
}
