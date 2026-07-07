import {
  deleteCachedAudioBlob,
  deleteCachedPeaksPayload,
  waveMediaCacheKeyForServerAsset,
  waveMediaCacheKeyForSupabase,
} from "./waveMediaCache";
import {
  deleteWavePeaksCache,
  wavePeaksCacheKeyForFlow,
  wavePeaksCacheKeyForServerAsset,
  wavePeaksCacheKeyForSupabase,
} from "./wavePeaksCache";
import { supabaseDeleteWavePeaks } from "./supabaseWavePeaks";
import { useWavePeaksStore } from "../store/wavePeaksStore";

/** 音源スロット差し替え時に古い波形／音源キャッシュを破棄する */
export async function invalidateAudioWaveCaches(opts: {
  audioAssetId?: number | null;
  audioSupabasePath?: string | null;
  flowLocalAudioKey?: string | null;
}): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (opts.audioAssetId != null && Number.isFinite(opts.audioAssetId)) {
    const peaksKey = wavePeaksCacheKeyForServerAsset(opts.audioAssetId);
    const mediaKey = waveMediaCacheKeyForServerAsset(opts.audioAssetId);
    tasks.push(deleteWavePeaksCache(peaksKey));
    tasks.push(deleteCachedPeaksPayload(peaksKey));
    tasks.push(deleteCachedAudioBlob(mediaKey));
  }

  const supabasePath = opts.audioSupabasePath?.trim();
  if (supabasePath) {
    const peaksKey = wavePeaksCacheKeyForSupabase(supabasePath);
    const mediaKey = waveMediaCacheKeyForSupabase(supabasePath);
    tasks.push(deleteWavePeaksCache(peaksKey));
    tasks.push(deleteCachedPeaksPayload(peaksKey));
    tasks.push(deleteCachedAudioBlob(mediaKey));
    tasks.push(supabaseDeleteWavePeaks(supabasePath));
  }

  const flowKey = opts.flowLocalAudioKey?.trim();
  if (flowKey) {
    const peaksKey = wavePeaksCacheKeyForFlow(flowKey);
    tasks.push(deleteWavePeaksCache(peaksKey));
    tasks.push(deleteCachedPeaksPayload(peaksKey));
  }

  await Promise.all(tasks);

  const { peaksCacheKey } = useWavePeaksStore.getState();
  const clearedKeys = new Set(
    [
      opts.audioAssetId != null
        ? wavePeaksCacheKeyForServerAsset(opts.audioAssetId)
        : null,
      supabasePath ? wavePeaksCacheKeyForSupabase(supabasePath) : null,
      flowKey ? wavePeaksCacheKeyForFlow(flowKey) : null,
    ].filter(Boolean) as string[]
  );
  if (peaksCacheKey && clearedKeys.has(peaksCacheKey)) {
    useWavePeaksStore.getState().resetPeaks();
  }
}
