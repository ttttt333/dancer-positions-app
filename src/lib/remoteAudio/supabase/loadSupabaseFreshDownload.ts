import { supabaseDownloadProjectAudioWithCache } from "../../supabaseAudio";
import { supabaseDownloadWavePeaks } from "../../supabaseWavePeaks";
import { setPersistedSupabaseAudio } from "../../timelineAudioBlobPersist";
import { wavePeaksCacheKeyForSupabase } from "../../wavePeaksCache";
import { reportWaveLoadProgress } from "../../waveLoadProgress";
import { mountBlobUrlToPlayback } from "../playbackBlobSync";
import {
  markPlaybackReadyForWaveFetch,
  reportAudioLoadProgress,
} from "../remoteAudioUi";
import type { LoadSupabaseAudioParams } from "../loadSupabaseAudio";
import {
  sidecarPeaksAreUsable,
  tryApplyCachedPeaksEarly,
} from "../wavePeaksLoader";

/** キャッシュ／サイドカー確認後に音源を新規ダウンロードする経路 */
export async function loadSupabaseFreshDownload(
  params: LoadSupabaseAudioParams
): Promise<void> {
  const {
    blobUrlRef,
    decodePeaksRef,
    clearPlaybackTrustedDurationSec,
    publicShareView,
    isCancelled,
    audioPlayer,
    loadAbort,
    blobUrls,
    effectivePath,
  } = params;

  const cacheKey = wavePeaksCacheKeyForSupabase(effectivePath);

  reportWaveLoadProgress(0.05, "音源と波形を並列取得中…");
  await tryApplyCachedPeaksEarly(cacheKey, decodePeaksRef, isCancelled, {
    supabaseAudioPath: effectivePath,
  });
  loadAbort.throwIfAborted();

  const sidecar = await supabaseDownloadWavePeaks(
    effectivePath,
    loadAbort.signal
  ).catch(() => null);
  if (sidecarPeaksAreUsable(sidecar) && !isCancelled()) {
    await decodePeaksRef.current(new ArrayBuffer(0), {
      cacheKey,
      supabaseAudioPath: effectivePath,
      previewOnly: true,
      precomputed: {
        peaks: sidecar!.peaks,
        durationSec: sidecar!.durationSec,
      },
    });
  }

  const audio = await supabaseDownloadProjectAudioWithCache(
    effectivePath,
    (ratio) => {
      reportAudioLoadProgress(
        publicShareView,
        0.08 + ratio * 0.32,
        ratio < 0.5 ? "音源をダウンロード中…" : "再生の準備中…"
      );
    },
    loadAbort.signal
  );
  if (isCancelled()) return;

  const blobUrl = blobUrls.create(
    new Blob([audio.buffer], { type: audio.mime })
  );
  setPersistedSupabaseAudio(blobUrl, effectivePath);
  blobUrls.commit(blobUrl);
  mountBlobUrlToPlayback(
    blobUrlRef,
    blobUrl,
    clearPlaybackTrustedDurationSec,
    audioPlayer,
    { forceEngine: true }
  );

  reportWaveLoadProgress(0.35, "波形を音源から同期中…");
  await decodePeaksRef.current(audio.buffer, {
    cacheKey,
    supabaseAudioPath: effectivePath,
  });
  markPlaybackReadyForWaveFetch(publicShareView, blobUrlRef, audioPlayer);
}
