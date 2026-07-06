import { arrayBufferFromBlobUrl } from "../../timelineAudioBlobPersist";
import { wavePeaksCacheKeyForSupabase } from "../../wavePeaksCache";
import { loadReusedBlobAudio } from "../loadReusedBlobAudio";
import type { LoadSupabaseAudioParams } from "../loadSupabaseAudio";
import { ensureSupabasePeaksOnly } from "../wavePeaksLoader";

/** 永続化済み blob URL の再利用経路 */
export async function loadSupabaseReusePath(
  params: LoadSupabaseAudioParams,
  reuseUrl: string
): Promise<void> {
  const { effectivePath, decodePeaksRef, isCancelled } = params;
  const cacheKey = wavePeaksCacheKeyForSupabase(effectivePath);

  await loadReusedBlobAudio({
    ...params,
    reuseUrl,
    cacheKey,
    decodeOptions: { supabaseAudioPath: effectivePath },
    onEmptyBufferFallback: () =>
      ensureSupabasePeaksOnly(
        effectivePath,
        () => arrayBufferFromBlobUrl(reuseUrl),
        decodePeaksRef,
        cacheKey,
        isCancelled
      ),
  });
}
