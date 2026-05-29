import type { MutableRefObject } from "react";
import { useEffect } from "react";
import { fetchAuthorizedAudio, getToken } from "../api/client";
import { playbackEngine } from "../core/playbackEngine";
import { isSupabaseBackend } from "../lib/supabaseClient";
import { supabaseDownloadProjectAudioBuffer } from "../lib/supabaseAudio";
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
  clearWaveLoadProgress,
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

        const { blobUrl, buffer } = await fetchAuthorizedAudio(aid, (ratio) => {
          reportWaveLoadProgress(0.05 + ratio * 0.45, "音源を読み込み中…");
        });
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
          reportWaveLoadProgress(0.55, "波形を解析中…");
          await decodePeaksFromBuffer(buffer, { cacheKey });
        }
      } catch (e) {
        clearWaveLoadProgress();
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
      clearWaveLoadProgress();
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

        reportWaveLoadProgress(0.08, "音源と波形を並列取得中…");
        const [sidecar, buf] = await Promise.all([
          supabaseDownloadWavePeaks(effectivePath).catch(() => null),
          supabaseDownloadProjectAudioBuffer(effectivePath),
        ]);
        if (cancelled) return;
        const url = URL.createObjectURL(new Blob([buf]));
        if (
          blobUrlRef.current &&
          blobUrlRef.current !== persistedServerAudioBlobUrl &&
          blobUrlRef.current !== persistedSupabaseAudioBlobUrl
        ) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = url;
        setPersistedSupabaseAudio(url, effectivePath);
        clearPlaybackTrustedDurationSec();
        playbackEngine.setMediaSourceUrl(url);
        if (!cancelled) {
          if (sidecar?.peaks.length) {
            await decodePeaksFromBuffer(new ArrayBuffer(0), {
              cacheKey,
              supabaseAudioPath: effectivePath,
              precomputed: {
                peaks: sidecar.peaks,
                durationSec: sidecar.durationSec,
              },
            });
          } else {
            reportWaveLoadProgress(0.42, "波形を解析中…");
            await decodePeaksFromBuffer(buf, {
              cacheKey,
              supabaseAudioPath: effectivePath,
            });
          }
        }
      } catch (e) {
        clearWaveLoadProgress();
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
      clearWaveLoadProgress();
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
        const buf = await blob.arrayBuffer();
        if (!cancelled) await decodePeaksFromBuffer(buf, { cacheKey });
      } catch (e) {
        clearWaveLoadProgress();
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
      clearWaveLoadProgress();
    };
  }, [
    audioAssetId,
    audioSupabasePath,
    flowLocalAudioKey,
    blobUrlRef,
    decodePeaksFromBuffer,
  ]);
}
