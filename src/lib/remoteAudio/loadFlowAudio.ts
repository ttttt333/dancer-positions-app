import { getFlowLibraryAudio } from "../flowLibraryLocalAudio";
import {
  arrayBufferFromBlobUrl,
  persistedFlowAudioBlobUrl,
  persistedFlowLocalAudioKey,
  revokePersistedFlowAudioBlob,
  setPersistedFlowAudio,
} from "../timelineAudioBlobPersist";
import { getWavePeaksCache, wavePeaksCacheKeyForFlow } from "../wavePeaksCache";
import { reportWaveLoadError, reportWaveLoadProgress } from "../waveLoadProgress";
import { verifyBlobUrl } from "../verifyBlobUrl";
import { hasFreshPeaksForCacheKey, hasUsablePeaksInStore } from "../wavePeaksSession";
import { syncPlaybackUrl } from "./playbackBlobSync";
import { markPlaybackReadyForWaveFetch } from "./remoteAudioUi";
import { resolveVerifiedReuseUrl } from "./reuseBlobUrl";
import type { RemoteAudioLoadContext } from "./types";
import { tryApplyCachedPeaksFromStore } from "./wavePeaksLoader";

export type LoadFlowAudioParams = RemoteAudioLoadContext & {
  flowKey: string;
};

export async function loadFlowAudio(params: LoadFlowAudioParams): Promise<void> {
  const {
    flowKey,
    blobUrlRef,
    decodePeaksRef,
    clearPlaybackTrustedDurationSec,
    publicShareView,
    isCancelled,
    audioPlayer,
    loadAbort,
    blobUrls,
  } = params;

  if (
    persistedFlowLocalAudioKey != null &&
    persistedFlowLocalAudioKey !== flowKey
  ) {
    revokePersistedFlowAudioBlob();
  }

  const cacheKey = wavePeaksCacheKeyForFlow(flowKey);
  const reuseUrlRaw =
    persistedFlowLocalAudioKey === flowKey ? persistedFlowAudioBlobUrl : null;

  let reuseUrl = await resolveVerifiedReuseUrl(reuseUrlRaw, async () => {
    revokePersistedFlowAudioBlob();
    return null;
  });
  loadAbort.throwIfAborted();

  if (!reuseUrl) {
    const engineUrl = audioPlayer.getMediaSourceUrl();
    if (engineUrl && (await verifyBlobUrl(engineUrl))) {
      reuseUrl = engineUrl;
    }
  }

  if (reuseUrl) {
    syncPlaybackUrl(
      blobUrlRef,
      reuseUrl,
      clearPlaybackTrustedDurationSec,
      audioPlayer,
      { revokePrevious: true }
    );
    setPersistedFlowAudio(reuseUrl, flowKey);

    if (hasFreshPeaksForCacheKey(cacheKey)) {
      markPlaybackReadyForWaveFetch(publicShareView, blobUrlRef, audioPlayer);
      return;
    }

    const cached = await getWavePeaksCache(cacheKey);
    const peaksApplied = await tryApplyCachedPeaksFromStore(
      decodePeaksRef,
      cacheKey,
      cached
    );
    if (!peaksApplied && !isCancelled()) {
      reportWaveLoadProgress(0.4, "波形データを取得中…");
      const buf = await arrayBufferFromBlobUrl(reuseUrl);
      if (!isCancelled()) await decodePeaksRef.current(buf, { cacheKey });
    }
    markPlaybackReadyForWaveFetch(publicShareView, blobUrlRef, audioPlayer);
    return;
  }

  const cached = await getWavePeaksCache(cacheKey);
  if (cached?.peaks.length) {
    if (!isCancelled()) {
      await tryApplyCachedPeaksFromStore(decodePeaksRef, cacheKey, cached);
    }
  } else {
    reportWaveLoadProgress(0.05, "ローカル音源を読み込み中…");
  }
  loadAbort.throwIfAborted();

  const blob = await getFlowLibraryAudio(flowKey);
  if (isCancelled() || !blob || blob.size === 0) return;

  const url = blobUrls.create(blob);
  setPersistedFlowAudio(url, flowKey);
  blobUrls.commit(url);
  syncPlaybackUrl(
    blobUrlRef,
    url,
    clearPlaybackTrustedDurationSec,
    audioPlayer,
    { revokePrevious: true }
  );

  if (
    hasFreshPeaksForCacheKey(cacheKey) ||
    hasUsablePeaksInStore()
  ) {
    markPlaybackReadyForWaveFetch(publicShareView, blobUrlRef, audioPlayer);
    return;
  }

  const buf = await blob.arrayBuffer();
  if (!isCancelled()) await decodePeaksRef.current(buf, { cacheKey });
  markPlaybackReadyForWaveFetch(publicShareView, blobUrlRef, audioPlayer);
}

export function reportFlowAudioLoadError(err: unknown): void {
  if (err instanceof DOMException && err.name === "AbortError") return;
  reportWaveLoadError(
    err instanceof Error ? err.message : "音源の読み込みに失敗しました"
  );
  console.error(err);
}
