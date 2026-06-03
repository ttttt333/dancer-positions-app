import type { MutableRefObject } from "react";
import { useEffect } from "react";
import { fetchAuthorizedAudio, getToken } from "../api/client";
import { playbackEngine } from "../core/playbackEngine";
import { isSupabaseBackend } from "../lib/supabaseClient";
import {
  supabaseDownloadProjectAudioWithCache,
} from "../lib/supabaseAudio";
import { getFlowLibraryAudio } from "../lib/flowLibraryLocalAudio";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import {
  arrayBufferFromBlobUrl,
  persistedServerAudioAssetId,
  persistedServerAudioBlobUrl,
  persistedSupabaseAudioBlobUrl,
  persistedSupabaseAudioPath,
  revokeBlobUrlUnlessCloudPersisted,
  revokePersistedServerAudioBlob,
  revokePersistedSupabaseAudioBlob,
  setPersistedServerAudio,
  setPersistedSupabaseAudio,
} from "../lib/timelineAudioBlobPersist";
import type { DecodePeaksOptions } from "./useTimelineWaveDecode";
import {
  getWavePeaksCache,
  wavePeaksCacheKeyForFlow,
  wavePeaksCacheKeyForServerAsset,
  wavePeaksCacheKeyForSupabase,
} from "../lib/wavePeaksCache";
import {
  resolveServerAssetWavePeaks,
  resolveSupabaseReuseWavePeaks,
} from "../lib/resolveRemoteWavePeaks";
import { supabaseDownloadWavePeaks } from "../lib/supabaseWavePeaks";
import {
  getCachedPeaksPayload,
  putCachedPeaksPayload,
} from "../lib/waveMediaCache";
import {
  reportWaveLoadError,
  reportWaveLoadProgress,
  clearWaveLoadProgress,
} from "../lib/waveLoadProgress";
import { verifyBlobUrl } from "../lib/verifyBlobUrl";
import { waitForAudioElementReady } from "../lib/audioElementReady";
import { tryFetchServerWavePeaksReady } from "../lib/wavePeaksServerApi";

type DecodePeaksFn = (
  buf: ArrayBuffer,
  options?: DecodePeaksOptions
) => Promise<void>;

type Params = {
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksRef: MutableRefObject<DecodePeaksFn>;
  audioAssetId: number | null;
  audioSupabasePath: string | null | undefined;
  flowLocalAudioKey: string | null | undefined;
  /** 生徒閲覧（/view/s/…）: ログインなしで Supabase 音源を読む */
  publicShareView?: boolean;
  /** タブ復帰などで blob が無効になったときリモート音源を再取得 */
  reloadRemoteAudioNonce?: number;
};

function assignBlobUrlRef(
  blobUrlRef: MutableRefObject<string | null>,
  url: string,
  revokePrevious: boolean
) {
  const cur = blobUrlRef.current;
  if (revokePrevious && cur && cur !== url) {
    revokeBlobUrlUnlessCloudPersisted(cur);
  }
  blobUrlRef.current = url;
}

/** 再生 URL を設定（同一 URL・再生中は load() しない） */
function syncPlaybackUrl(
  blobUrlRef: MutableRefObject<string | null>,
  url: string,
  clearPlaybackTrustedDurationSec: () => void,
  opts?: { revokePrevious?: boolean; skipEngineIfSame?: boolean }
) {
  assignBlobUrlRef(blobUrlRef, url, opts?.revokePrevious ?? false);
  const engineUrl = playbackEngine.getMediaSourceUrl();
  if (opts?.skipEngineIfSame !== false && engineUrl === url) {
    return;
  }
  clearPlaybackTrustedDurationSec();
  playbackEngine.setMediaSourceUrl(url);
}

/** 音源 URL 設定後: ブラウザが再生可能になったら UI を解放 */
function scheduleMarkPlaybackReady() {
  void waitForAudioElementReady(playbackEngine.getMediaElement())
    .then(() => {
      clearWaveLoadProgress();
    })
    .catch((e) => {
      reportWaveLoadError(
        e instanceof Error ? e.message : "音源の読み込みに失敗しました"
      );
    });
}

function markPlaybackReadyForWaveFetch() {
  scheduleMarkPlaybackReady();
}

async function ensureServerPeaksOnly(
  assetId: number,
  readBuffer: () => Promise<ArrayBuffer>,
  decodePeaksRef: MutableRefObject<DecodePeaksFn>,
  cacheKey: string,
  cancelled: () => boolean
) {
  if (cancelled()) return;
  await resolveServerAssetWavePeaks(
    assetId,
    readBuffer,
    (buf, options) => decodePeaksRef.current(buf, options),
    { cacheKey }
  );
}

async function ensureSupabasePeaksOnly(
  path: string,
  readBuffer: () => Promise<ArrayBuffer>,
  decodePeaksRef: MutableRefObject<DecodePeaksFn>,
  cacheKey: string,
  cancelled: () => boolean
) {
  if (cancelled()) return;
  await resolveSupabaseReuseWavePeaks(
    path,
    readBuffer,
    (buf, options) => decodePeaksRef.current(buf, options),
    { cacheKey, supabaseAudioPath: path }
  );
}

/**
 * プロジェクトに紐づくリモート／ローカルストア音源（API・Supabase・フローライブラリ）を
 * `playbackEngine` と波形デコードへ同期する。
 */
export function useTimelineRemoteAudio({
  blobUrlRef,
  decodePeaksRef,
  audioAssetId,
  audioSupabasePath,
  flowLocalAudioKey,
  publicShareView = false,
  reloadRemoteAudioNonce = 0,
}: Params) {
  const clearPlaybackTrustedDurationSec = () =>
    usePlaybackUiStore.getState().setTrustedAudioDurationSec(null);

  useEffect(() => {
    const aid = audioAssetId;
    if (aid == null || !getToken()) {
      if (aid == null) {
        const hadServerBlobAttached =
          blobUrlRef.current != null &&
          blobUrlRef.current === persistedServerAudioBlobUrl;
        revokePersistedServerAudioBlob();
        if (hadServerBlobAttached) {
          blobUrlRef.current = null;
          clearPlaybackTrustedDurationSec();
          playbackEngine.clearMediaSource();
        }
      }
      return;
    }
    if (
      persistedServerAudioAssetId != null &&
      persistedServerAudioAssetId !== aid
    ) {
      revokePersistedServerAudioBlob();
    }

    let cancelled = false;
    const isCancelled = () => cancelled;

    (async () => {
      try {
        revokePersistedSupabaseAudioBlob();
        const cacheKey = wavePeaksCacheKeyForServerAsset(aid);
        const reuseUrlRaw =
          persistedServerAudioAssetId === aid
            ? persistedServerAudioBlobUrl
            : null;
        let reuseUrl = reuseUrlRaw;
        if (reuseUrl) {
          const valid = await verifyBlobUrl(reuseUrl);
          if (!valid) {
            revokePersistedServerAudioBlob();
            reuseUrl = null;
          }
        }

        if (reuseUrl) {
          syncPlaybackUrl(
            blobUrlRef,
            reuseUrl,
            clearPlaybackTrustedDurationSec,
            { revokePrevious: true }
          );
          markPlaybackReadyForWaveFetch();
          const cached = await getWavePeaksCache(cacheKey);
          if (cached?.peaks.length) {
            if (!cancelled) {
              await decodePeaksRef.current(new ArrayBuffer(0), { cacheKey });
            }
            return;
          }
          reportWaveLoadProgress(0.4, "波形データを取得中…");
          await ensureServerPeaksOnly(
            aid,
            () => arrayBufferFromBlobUrl(reuseUrl),
            decodePeaksRef,
            cacheKey,
            isCancelled
          );
          return;
        }

        const engineUrl = playbackEngine.getMediaSourceUrl();
        const engineAlreadyOnAsset =
          persistedServerAudioAssetId === aid &&
          persistedServerAudioBlobUrl &&
          engineUrl === persistedServerAudioBlobUrl;

        if (engineAlreadyOnAsset && persistedServerAudioBlobUrl) {
          const blobValid = await verifyBlobUrl(persistedServerAudioBlobUrl);
          if (blobValid) {
            blobUrlRef.current = persistedServerAudioBlobUrl;
            markPlaybackReadyForWaveFetch();
            reportWaveLoadProgress(0.4, "波形データを取得中…");
            await ensureServerPeaksOnly(
              aid,
              () => arrayBufferFromBlobUrl(persistedServerAudioBlobUrl!),
              decodePeaksRef,
              cacheKey,
              isCancelled
            );
            return;
          }
          revokePersistedServerAudioBlob();
        }

        reportWaveLoadProgress(0.05, "音源と波形を並列取得中…");

        const readyPeaks = await tryFetchServerWavePeaksReady(aid);
        if (readyPeaks?.peaks.length && !cancelled) {
          await decodePeaksRef.current(new ArrayBuffer(0), {
            cacheKey,
            precomputed: readyPeaks,
          });
        }

        let audioResult: { blobUrl: string; buffer: ArrayBuffer } | null = null;
        const audioPromise = fetchAuthorizedAudio(aid, (ratio) => {
          reportWaveLoadProgress(0.05 + ratio * 0.35, "音源を読み込み中…");
        }).then((result) => {
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

        const { blobUrl } = await audioPromise;
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        setPersistedServerAudio(blobUrl, aid);
        syncPlaybackUrl(blobUrlRef, blobUrl, clearPlaybackTrustedDurationSec, {
          revokePrevious: true,
        });
        markPlaybackReadyForWaveFetch();

        if (!cancelled) {
          await peaksPromise;
        }
      } catch (e) {
        reportWaveLoadError(
          e instanceof Error ? e.message : "音源の読み込みに失敗しました"
        );
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioAssetId, blobUrlRef, decodePeaksRef, reloadRemoteAudioNonce]);

  useEffect(() => {
    const rawPath = audioSupabasePath;
    const path =
      typeof rawPath === "string" && rawPath.trim().length > 0 ? rawPath.trim() : null;
    const effectivePath = isSupabaseBackend() ? path : null;
    const canLoadSupabaseAudio = getToken() || publicShareView;
    if (effectivePath == null || !canLoadSupabaseAudio) {
      if (effectivePath == null) {
        const hadSupabaseBlobAttached =
          blobUrlRef.current != null &&
          blobUrlRef.current === persistedSupabaseAudioBlobUrl;
        revokePersistedSupabaseAudioBlob();
        if (hadSupabaseBlobAttached) {
          blobUrlRef.current = null;
          clearPlaybackTrustedDurationSec();
          playbackEngine.clearMediaSource();
        }
      }
      return;
    }
    if (
      persistedSupabaseAudioPath != null &&
      persistedSupabaseAudioPath !== effectivePath
    ) {
      revokePersistedSupabaseAudioBlob();
    }

    let cancelled = false;
    const isCancelled = () => cancelled;

    (async () => {
      try {
        revokePersistedServerAudioBlob();
        const cacheKey = wavePeaksCacheKeyForSupabase(effectivePath);
        const reuseUrlRaw =
          persistedSupabaseAudioPath === effectivePath
            ? persistedSupabaseAudioBlobUrl
            : null;
        let reuseUrl = reuseUrlRaw;
        if (reuseUrl) {
          const valid = await verifyBlobUrl(reuseUrl);
          if (!valid) {
            revokePersistedSupabaseAudioBlob();
            reuseUrl = null;
          }
        }

        if (reuseUrl) {
          syncPlaybackUrl(
            blobUrlRef,
            reuseUrl,
            clearPlaybackTrustedDurationSec,
            { revokePrevious: true }
          );
          markPlaybackReadyForWaveFetch();
          const cached = await getWavePeaksCache(cacheKey);
          if (cached?.peaks.length) {
            if (!cancelled) {
              await decodePeaksRef.current(new ArrayBuffer(0), {
                cacheKey,
                supabaseAudioPath: effectivePath,
              });
            }
            return;
          }
          reportWaveLoadProgress(0.4, "波形データを取得中…");
          await ensureSupabasePeaksOnly(
            effectivePath,
            () => arrayBufferFromBlobUrl(reuseUrl),
            decodePeaksRef,
            cacheKey,
            isCancelled
          );
          return;
        }

        const engineUrl = playbackEngine.getMediaSourceUrl();
        const alreadyPlayingThisPath =
          persistedSupabaseAudioPath === effectivePath &&
          engineUrl.length > 0 &&
          engineUrl === persistedSupabaseAudioBlobUrl;

        if (alreadyPlayingThisPath) {
          if (persistedSupabaseAudioBlobUrl) {
            const valid = await verifyBlobUrl(persistedSupabaseAudioBlobUrl);
            if (valid) {
              blobUrlRef.current = persistedSupabaseAudioBlobUrl;
            } else {
              revokePersistedSupabaseAudioBlob();
            }
          }
          markPlaybackReadyForWaveFetch();
          reportWaveLoadProgress(0.4, "波形データを取得中…");
          const readBuf =
            persistedSupabaseAudioBlobUrl &&
            (await verifyBlobUrl(persistedSupabaseAudioBlobUrl))
              ? () => arrayBufferFromBlobUrl(persistedSupabaseAudioBlobUrl!)
              : async () =>
                  (
                    await supabaseDownloadProjectAudioWithCache(effectivePath)
                  ).buffer;
          await ensureSupabasePeaksOnly(
            effectivePath,
            readBuf,
            decodePeaksRef,
            cacheKey,
            isCancelled
          );
          return;
        }

        reportWaveLoadProgress(0.05, "音源と波形を並列取得中…");
        const sidecarPromise = supabaseDownloadWavePeaks(effectivePath).catch(
          () => null
        );

        const sidecar = await sidecarPromise;
        if (sidecar?.peaks.length && !cancelled) {
          void putCachedPeaksPayload(
            cacheKey,
            sidecar.peaks,
            sidecar.durationSec
          );
          await decodePeaksRef.current(new ArrayBuffer(0), {
            cacheKey,
            supabaseAudioPath: effectivePath,
            precomputed: {
              peaks: sidecar.peaks,
              durationSec: sidecar.durationSec,
            },
          });
        }

        const audioPromise = supabaseDownloadProjectAudioWithCache(
          effectivePath,
          (ratio) => {
            reportWaveLoadProgress(0.08 + ratio * 0.32, "音源を読み込み中…");
          }
        );

        const audio = await audioPromise;
        if (cancelled) return;

        const blobUrl = URL.createObjectURL(
          new Blob([audio.buffer], { type: audio.mime })
        );
        setPersistedSupabaseAudio(blobUrl, effectivePath);
        assignBlobUrlRef(blobUrlRef, blobUrl, false);

        const curEngine = playbackEngine.getMediaSourceUrl();
        if (curEngine !== blobUrl) {
          playbackEngine.setMediaSourceUrl(blobUrl);
        }
        markPlaybackReadyForWaveFetch();

        if (sidecar?.peaks.length) {
          return;
        }

        const mediaPeaks = await getCachedPeaksPayload(cacheKey);
        if (mediaPeaks?.peaks.length) {
          await decodePeaksRef.current(new ArrayBuffer(0), {
            cacheKey,
            supabaseAudioPath: effectivePath,
            precomputed: mediaPeaks,
          });
          return;
        }

        await ensureSupabasePeaksOnly(
          effectivePath,
          () => Promise.resolve(audio.buffer),
          decodePeaksRef,
          cacheKey,
          isCancelled
        );
      } catch (e) {
        reportWaveLoadError(
          e instanceof Error ? e.message : "音源の読み込みに失敗しました"
        );
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioSupabasePath, blobUrlRef, decodePeaksRef, publicShareView, reloadRemoteAudioNonce]);

  useEffect(() => {
    if (audioAssetId != null) return;
    if (isSupabaseBackend()) {
      const sp = audioSupabasePath;
      if (typeof sp === "string" && sp.trim().length > 0) return;
    }
    const flowKey = flowLocalAudioKey;
    if (typeof flowKey !== "string" || flowKey.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        reportWaveLoadProgress(0.05, "ローカル音源を読み込み中…");
        const blob = await getFlowLibraryAudio(flowKey);
        if (cancelled || !blob || blob.size === 0) return;
        const url = URL.createObjectURL(blob);
        syncPlaybackUrl(blobUrlRef, url, clearPlaybackTrustedDurationSec, {
          revokePrevious: true,
        });
        markPlaybackReadyForWaveFetch();
        const cacheKey = wavePeaksCacheKeyForFlow(flowKey);
        const cached = await getWavePeaksCache(cacheKey);
        if (cached?.peaks.length) {
          if (!cancelled) {
            await decodePeaksRef.current(new ArrayBuffer(0), { cacheKey });
          }
          return;
        }
        const buf = await blob.arrayBuffer();
        if (!cancelled) await decodePeaksRef.current(buf, { cacheKey });
      } catch (e) {
        reportWaveLoadError(
          e instanceof Error ? e.message : "音源の読み込みに失敗しました"
        );
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    audioAssetId,
    audioSupabasePath,
    flowLocalAudioKey,
    blobUrlRef,
    decodePeaksRef,
    reloadRemoteAudioNonce,
  ]);
}
