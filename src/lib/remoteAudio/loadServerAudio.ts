import { fetchAuthorizedAudio } from "../../api/client";
import {
  arrayBufferFromBlobUrl,
  persistedServerAudioAssetId,
  persistedServerAudioBlobUrl,
  revokePersistedFlowAudioBlob,
  revokePersistedServerAudioBlob,
  revokePersistedSupabaseAudioBlob,
  setPersistedServerAudio,
} from "../timelineAudioBlobPersist";
import { wavePeaksCacheKeyForServerAsset } from "../wavePeaksCache";
import { resolveServerAssetWavePeaks } from "../resolveRemoteWavePeaks";
import { reportWaveLoadError, reportWaveLoadProgress } from "../waveLoadProgress";
import { verifyBlobUrl } from "../verifyBlobUrl";
import { tryFetchServerWavePeaksReady } from "../wavePeaksServerApi";
import { awaitUnlessAborted } from "./loadAbort";
import { loadReusedBlobAudio } from "./loadReusedBlobAudio";
import { syncPlaybackUrl } from "./playbackBlobSync";
import { markPlaybackReadyForWaveFetch } from "./remoteAudioUi";
import { resolveVerifiedReuseUrl } from "./reuseBlobUrl";
import type { RemoteAudioLoadContext } from "./types";
import {
  ensureServerPeaksOnly,
  tryApplyCachedPeaksEarly,
} from "./wavePeaksLoader";

export type LoadServerAudioParams = RemoteAudioLoadContext & {
  assetId: number;
};

export async function loadServerAudio(params: LoadServerAudioParams): Promise<void> {
  const {
    assetId: aid,
    blobUrlRef,
    decodePeaksRef,
    clearPlaybackTrustedDurationSec,
    publicShareView,
    isCancelled,
    audioPlayer,
    loadAbort,
    blobUrls,
  } = params;

  revokePersistedSupabaseAudioBlob();
  revokePersistedFlowAudioBlob();

  const cacheKey = wavePeaksCacheKeyForServerAsset(aid);
  const reuseUrlRaw =
    persistedServerAudioAssetId === aid ? persistedServerAudioBlobUrl : null;

  const reuseUrl = await resolveVerifiedReuseUrl(reuseUrlRaw, async () => {
    revokePersistedServerAudioBlob();
    return null;
  });
  loadAbort.throwIfAborted();

  if (reuseUrl) {
    await loadReusedBlobAudio({
      ...params,
      reuseUrl,
      cacheKey,
      onEmptyBufferFallback: () =>
        ensureServerPeaksOnly(
          aid,
          () => arrayBufferFromBlobUrl(reuseUrl),
          decodePeaksRef,
          cacheKey,
          isCancelled
        ),
    });
    return;
  }

  const engineUrl = audioPlayer.getMediaSourceUrl();
  const engineAlreadyOnAsset =
    persistedServerAudioAssetId === aid &&
    persistedServerAudioBlobUrl &&
    engineUrl === persistedServerAudioBlobUrl;

  if (engineAlreadyOnAsset && persistedServerAudioBlobUrl) {
    const blobValid = await verifyBlobUrl(persistedServerAudioBlobUrl);
    loadAbort.throwIfAborted();
    if (blobValid) {
      blobUrlRef.current = persistedServerAudioBlobUrl;
      reportWaveLoadProgress(0.4, "波形データを取得中…");
      await ensureServerPeaksOnly(
        aid,
        () => arrayBufferFromBlobUrl(persistedServerAudioBlobUrl!),
        decodePeaksRef,
        cacheKey,
        isCancelled
      );
      markPlaybackReadyForWaveFetch(publicShareView, blobUrlRef, audioPlayer);
      return;
    }
    revokePersistedServerAudioBlob();
  }

  reportWaveLoadProgress(0.05, "音源と波形を並列取得中…");
  await tryApplyCachedPeaksEarly(cacheKey, decodePeaksRef, isCancelled);
  loadAbort.throwIfAborted();

  const readyPeaks = await tryFetchServerWavePeaksReady(aid);
  if (readyPeaks?.peaks.length && !isCancelled()) {
    await decodePeaksRef.current(new ArrayBuffer(0), {
      cacheKey,
      previewOnly: true,
      precomputed: readyPeaks,
    });
  }

  let audioResult: { blobUrl: string; buffer: ArrayBuffer } | null = null;
  const audioPromise = fetchAuthorizedAudio(
    aid,
    (ratio) => {
      reportWaveLoadProgress(0.05 + ratio * 0.35, "音源を読み込み中…");
    },
    loadAbort.signal
  ).then((result) => {
    audioResult = result;
    return result;
  });

  const peaksPromise = resolveServerAssetWavePeaks(
    aid,
    async () => {
      if (audioResult) return audioResult.buffer;
      return (await audioPromise).buffer;
    },
    (buf, options) => decodePeaksRef.current(buf, options),
    { cacheKey }
  );

  const { blobUrl } = await awaitUnlessAborted(loadAbort, audioPromise);
  blobUrls.adoptPending(blobUrl);
  setPersistedServerAudio(blobUrl, aid);
  blobUrls.commit(blobUrl);
  syncPlaybackUrl(
    blobUrlRef,
    blobUrl,
    clearPlaybackTrustedDurationSec,
    audioPlayer,
    { revokePrevious: true }
  );

  if (!isCancelled()) {
    await peaksPromise;
  }
  markPlaybackReadyForWaveFetch(publicShareView, blobUrlRef, audioPlayer);
}

export function reportServerAudioLoadError(err: unknown): void {
  if (err instanceof DOMException && err.name === "AbortError") return;
  reportWaveLoadError(
    err instanceof Error ? err.message : "音源の読み込みに失敗しました"
  );
  console.error(err);
}
