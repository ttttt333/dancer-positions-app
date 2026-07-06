import { arrayBufferFromBlobUrl } from "../../timelineAudioBlobPersist";
import { wavePeaksCacheKeyForSupabase } from "../../wavePeaksCache";
import { reportWaveLoadProgress } from "../../waveLoadProgress";
import { hasFreshPeaksForCacheKey } from "../../wavePeaksSession";
import { loadReusedBlobAudio } from "../loadReusedBlobAudio";
import { markPlaybackReadyForWaveFetch } from "../remoteAudioUi";
import type { LoadSupabaseAudioParams } from "../loadSupabaseAudio";
import {
  ensureSupabasePeaksOnly,
  rebindUsablePeaksToCacheKey,
} from "../wavePeaksLoader";
import {
  downloadAndMountSupabaseAudio,
  resolveActiveSupabaseBlobUrl,
} from "./supabaseBlobResolve";

/** engine が既に同じ Supabase 音源を再生中の経路 */
export async function loadSupabaseAlreadyPlaying(
  params: LoadSupabaseAudioParams
): Promise<void> {
  const {
    blobUrlRef,
    decodePeaksRef,
    publicShareView,
    isCancelled,
    audioPlayer,
    effectivePath,
  } = params;

  const cacheKey = wavePeaksCacheKeyForSupabase(effectivePath);
  let activeBlobUrl = await resolveActiveSupabaseBlobUrl(effectivePath);
  params.loadAbort.throwIfAborted();

  if (!activeBlobUrl) {
    activeBlobUrl = await downloadAndMountSupabaseAudio(params, effectivePath);
  } else {
    blobUrlRef.current = activeBlobUrl;
  }

  if (
    hasFreshPeaksForCacheKey(cacheKey) ||
    (await rebindUsablePeaksToCacheKey(cacheKey))
  ) {
    await loadReusedBlobAudio({
      ...params,
      reuseUrl: activeBlobUrl,
      cacheKey,
      decodeOptions: { supabaseAudioPath: effectivePath },
      onEmptyBufferFallback: undefined,
    });
    return;
  }

  reportWaveLoadProgress(0.4, "波形データを取得中…");
  await ensureSupabasePeaksOnly(
    effectivePath,
    () => arrayBufferFromBlobUrl(activeBlobUrl),
    decodePeaksRef,
    cacheKey,
    isCancelled
  );
  markPlaybackReadyForWaveFetch(publicShareView, blobUrlRef, audioPlayer);
}
