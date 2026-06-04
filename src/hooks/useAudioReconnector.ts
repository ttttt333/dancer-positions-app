import { useEffect, useRef } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  isPlaybackBlobAlive,
  restorePlaybackBlobUrl,
  type PlaybackAudioRestoreContext,
} from "../lib/restorePlaybackAudio";
import {
  resyncEditorPlaybackMedia,
  type ResolvePlaybackBlobOptions,
} from "../lib/resyncPlaybackMedia";
import { fulfillViewerPendingPlay } from "../lib/playbackViewerIntent";
import type { MutableRefObject } from "react";

type Params = {
  enabled?: boolean;
  blobUrlRef: MutableRefObject<string | null>;
  getRestoreContext: () => ResolvePlaybackBlobOptions;
  onNeedsRemoteReload?: () => void;
};

/**
 * タブ復帰・ページ折りたたみ後: blob URL 失効を検知し Cache API / Supabase から再接続。
 */
export function useAudioReconnector({
  enabled = true,
  blobUrlRef,
  getRestoreContext,
  onNeedsRemoteReload,
}: Params) {
  const ctxRef = useRef(getRestoreContext);
  ctxRef.current = getRestoreContext;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let debounce = 0;
    const reconnect = async (force = false) => {
      const ctx = ctxRef.current();
      const hasRemoteSource =
        (typeof ctx.audioSupabasePath === "string" &&
          ctx.audioSupabasePath.trim().length > 0) ||
        ctx.audioAssetId != null ||
        (typeof ctx.flowLocalAudioKey === "string" &&
          ctx.flowLocalAudioKey.length > 0);

      const engineUrl = playbackEngine.getMediaSourceUrl();
      const alive = await isPlaybackBlobAlive(engineUrl);

      if (!hasRemoteSource && !engineUrl) return;

      if (!alive || force) {
        const rebuilt = await restorePlaybackBlobUrl(
          ctx as PlaybackAudioRestoreContext
        );
        if (rebuilt) {
          blobUrlRef.current = rebuilt;
          await resyncEditorPlaybackMedia(blobUrlRef, { ...ctx, force: true });
          fulfillViewerPendingPlay();
          return;
        }
        if (hasRemoteSource) {
          onNeedsRemoteReload?.();
          return;
        }
      }

      const status = await resyncEditorPlaybackMedia(blobUrlRef, {
        ...ctx,
        force,
      });
      if (status === "reload") {
        onNeedsRemoteReload?.();
        return;
      }
      fulfillViewerPendingPlay();
    };

    const schedule = (force = false) => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        void reconnect(force);
      }, 80);
    };

    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      schedule(true);
    };

    playbackEngine.ensureDomMediaElement();
    schedule(false);

    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("pageshow", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      window.clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("pageshow", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [enabled, blobUrlRef, onNeedsRemoteReload]);
}
