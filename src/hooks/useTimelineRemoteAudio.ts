import type { MutableRefObject } from "react";
import { useEffect } from "react";
import { fetchAuthorizedAudio, getToken } from "../api/client";
import { playbackEngine } from "../core/playbackEngine";
import { isSupabaseBackend } from "../lib/supabaseClient";
import {
  supabaseDownloadProjectAudioWithCache,
  supabaseGetProjectAudioSignedUrl,
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
} from "../lib/waveLoadProgress";

type Params = {
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksFromBuffer: (
    buf: ArrayBuffer,
    options?: DecodePeaksOptions
  ) => Promise<void>;
  audioAssetId: number | null;
  audioSupabasePath: string | null | undefined;
  flowLocalAudioKey: string | null | undefined;
  /** 生徒閲覧（/view/s/…）: ログインなしで Supabase 音源を読む */
  publicShareView?: boolean;
};

function attachPlaybackUrl(
  blobUrlRef: MutableRefObject<string | null>,
  url: string,
  clearPlaybackTrustedDurationSec: () => void
) {
  if (
    blobUrlRef.current &&
    blobUrlRef.current !== persistedServerAudioBlobUrl &&
    blobUrlRef.current !== persistedSupabaseAudioBlobUrl &&
    !blobUrlRef.current.startsWith("http")
  ) {
    URL.revokeObjectURL(blobUrlRef.current);
  }
  blobUrlRef.current = url;
  clearPlaybackTrustedDurationSec();
  playbackEngine.setMediaSourceUrl(url);
}

/**
 * プロジェクトに紐づくリモート／ローカルストア音源（API・Supabase・フローライブラリ）を
 * `playbackEngine` と波形デコードへ同期する。
 */
export function useTimelineRemoteAudio({
  blobUrlRef,
  decodePeaksFromBuffer,
  audioAssetId,
  audioSupabasePath,
  flowLocalAudioKey,
  publicShareView = false,
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
    (async () => {
      try {
        reportWaveLoadProgress(0.02, "音源を準備中…");
        revokePersistedSupabaseAudioBlob();
        const cacheKey = wavePeaksCacheKeyForServerAsset(aid);
        const reuseUrl =
          persistedServerAudioAssetId === aid
            ? persistedServerAudioBlobUrl
            : null;
        if (reuseUrl) {
          const cur = blobUrlRef.current;
          if (cur && cur !== reuseUrl) {
            revokeBlobUrlUnlessCloudPersisted(cur);
          }
          blobUrlRef.current = reuseUrl;
          clearPlaybackTrustedDurationSec();
          playbackEngine.setMediaSourceUrl(reuseUrl);
          const cached = await getWavePeaksCache(cacheKey);
          if (cached?.peaks.length) {
            if (!cancelled) {
              await decodePeaksFromBuffer(new ArrayBuffer(0), { cacheKey });
            }
            return;
          }
          if (cancelled) return;
          await resolveServerAssetWavePeaks(
            aid,
            () => arrayBufferFromBlobUrl(reuseUrl),
            decodePeaksFromBuffer,
            { cacheKey }
          );
          return;
        }

        reportWaveLoadProgress(0.05, "音源と波形を並列取得中…");
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
            const result = await audioPromise;
            return result.buffer;
          },
          decodePeaksFromBuffer,
          { cacheKey }
        );

        const { blobUrl } = await audioPromise;
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        if (
          blobUrlRef.current &&
          blobUrlRef.current !== persistedServerAudioBlobUrl &&
          blobUrlRef.current !== persistedSupabaseAudioBlobUrl
        ) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = blobUrl;
        setPersistedServerAudio(blobUrl, aid);
        clearPlaybackTrustedDurationSec();
        playbackEngine.setMediaSourceUrl(blobUrl);

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
  }, [audioAssetId, blobUrlRef, decodePeaksFromBuffer]);

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
    (async () => {
      try {
        reportWaveLoadProgress(0.02, "音源を準備中…");
        revokePersistedServerAudioBlob();
        const cacheKey = wavePeaksCacheKeyForSupabase(effectivePath);
        const reuseUrl =
          persistedSupabaseAudioPath === effectivePath
            ? persistedSupabaseAudioBlobUrl
            : null;
        if (reuseUrl) {
          const cur = blobUrlRef.current;
          if (cur && cur !== reuseUrl) {
            revokeBlobUrlUnlessCloudPersisted(cur);
          }
          blobUrlRef.current = reuseUrl;
          clearPlaybackTrustedDurationSec();
          playbackEngine.setMediaSourceUrl(reuseUrl);
          const cached = await getWavePeaksCache(cacheKey);
          if (cached?.peaks.length) {
            if (!cancelled) {
              await decodePeaksFromBuffer(new ArrayBuffer(0), {
                cacheKey,
                supabaseAudioPath: effectivePath,
              });
            }
            return;
          }
          if (cancelled) return;
          await resolveSupabaseReuseWavePeaks(
            effectivePath,
            () => arrayBufferFromBlobUrl(reuseUrl),
            decodePeaksFromBuffer,
            { cacheKey, supabaseAudioPath: effectivePath }
          );
          return;
        }

        reportWaveLoadProgress(0.05, "音源と波形を並列取得中…");
        const sidecarPromise = supabaseDownloadWavePeaks(effectivePath).catch(
          () => null
        );

        let signedPlaybackUrl: string | null = null;
        if (!publicShareView) {
          try {
            signedPlaybackUrl = await supabaseGetProjectAudioSignedUrl(
              effectivePath
            );
          } catch {
            /* 署名 URL 不可時は blob ダウンロードへ */
          }
        }

        if (signedPlaybackUrl && !cancelled) {
          attachPlaybackUrl(
            blobUrlRef,
            signedPlaybackUrl,
            clearPlaybackTrustedDurationSec
          );
        }

        const audioPromise = supabaseDownloadProjectAudioWithCache(
          effectivePath,
          (ratio) => {
            reportWaveLoadProgress(0.08 + ratio * 0.32, "音源を読み込み中…");
          }
        );

        const [sidecar, audio] = await Promise.all([
          sidecarPromise,
          audioPromise,
        ]);
        if (cancelled) return;

        const blobUrl = URL.createObjectURL(
          new Blob([audio.buffer], { type: audio.mime })
        );
        setPersistedSupabaseAudio(blobUrl, effectivePath);
        attachPlaybackUrl(blobUrlRef, blobUrl, clearPlaybackTrustedDurationSec);

        if (sidecar?.peaks.length) {
          void putCachedPeaksPayload(
            cacheKey,
            sidecar.peaks,
            sidecar.durationSec
          );
          await decodePeaksFromBuffer(new ArrayBuffer(0), {
            cacheKey,
            supabaseAudioPath: effectivePath,
            precomputed: {
              peaks: sidecar.peaks,
              durationSec: sidecar.durationSec,
            },
          });
          return;
        }

        const mediaPeaks = await getCachedPeaksPayload(cacheKey);
        if (mediaPeaks?.peaks.length) {
          await decodePeaksFromBuffer(new ArrayBuffer(0), {
            cacheKey,
            supabaseAudioPath: effectivePath,
            precomputed: mediaPeaks,
          });
          return;
        }

        await resolveSupabaseReuseWavePeaks(
          effectivePath,
          () => Promise.resolve(audio.buffer),
          decodePeaksFromBuffer,
          { cacheKey, supabaseAudioPath: effectivePath }
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
  }, [audioSupabasePath, blobUrlRef, decodePeaksFromBuffer, publicShareView]);

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
        if (blobUrlRef.current) {
          revokeBlobUrlUnlessCloudPersisted(blobUrlRef.current);
        }
        blobUrlRef.current = url;
        clearPlaybackTrustedDurationSec();
        playbackEngine.setMediaSourceUrl(url);
        const cacheKey = wavePeaksCacheKeyForFlow(flowKey);
        const cached = await getWavePeaksCache(cacheKey);
        if (cached?.peaks.length) {
          if (!cancelled) {
            await decodePeaksFromBuffer(new ArrayBuffer(0), { cacheKey });
          }
          return;
        }
        const buf = await blob.arrayBuffer();
        if (!cancelled) await decodePeaksFromBuffer(buf, { cacheKey });
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
    decodePeaksFromBuffer,
  ]);
}
