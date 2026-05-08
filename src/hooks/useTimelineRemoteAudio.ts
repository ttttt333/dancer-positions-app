import type { MutableRefObject } from "react";
import { useEffect } from "react";
import { fetchAuthorizedAudioBlobUrl, fetchLegacyAudioArrayBuffer, getToken } from "../api/client";
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

type Params = {
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksFromBuffer: (buf: ArrayBuffer) => Promise<void>;
  audioAssetId: number | null;
  audioSupabasePath: string | null | undefined;
  flowLocalAudioKey: string | null | undefined;
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
        revokePersistedSupabaseAudioBlob();
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
          const buf = await arrayBufferFromBlobUrl(reuseUrl);
          if (!cancelled) await decodePeaksFromBuffer(buf);
          return;
        }

        const url = await fetchAuthorizedAudioBlobUrl(aid);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        if (
          blobUrlRef.current &&
          blobUrlRef.current !== persistedServerAudioBlobUrl &&
          blobUrlRef.current !== persistedSupabaseAudioBlobUrl
        ) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = url;
        setPersistedServerAudio(url, aid);
        clearPlaybackTrustedDurationSec();
        playbackEngine.setMediaSourceUrl(url);
        const buf = await fetchLegacyAudioArrayBuffer(aid);
        if (!cancelled) await decodePeaksFromBuffer(buf);
      } catch (e) {
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
    if (effectivePath == null || !getToken()) {
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
        revokePersistedServerAudioBlob();
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
          const buf = await arrayBufferFromBlobUrl(reuseUrl);
          if (!cancelled) await decodePeaksFromBuffer(buf);
          return;
        }

        const buf = await supabaseDownloadProjectAudioBuffer(effectivePath);
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
        if (!cancelled) await decodePeaksFromBuffer(buf);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audioSupabasePath, blobUrlRef, decodePeaksFromBuffer]);

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
        const blob = await getFlowLibraryAudio(flowKey);
        if (cancelled || !blob || blob.size === 0) return;
        const url = URL.createObjectURL(blob);
        if (blobUrlRef.current) {
          revokeBlobUrlUnlessCloudPersisted(blobUrlRef.current);
        }
        blobUrlRef.current = url;
        clearPlaybackTrustedDurationSec();
        playbackEngine.setMediaSourceUrl(url);
        const buf = await blob.arrayBuffer();
        if (!cancelled) await decodePeaksFromBuffer(buf);
      } catch (e) {
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
