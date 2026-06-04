import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { EDITOR_WIDE_MIN_PX } from "../pages/editor/editorConstants";
import { subscribeEditorViewport } from "../pages/editor/editorViewport";
import { resyncEditorPlaybackMedia, resolveEditorPlaybackBlobUrl } from "../lib/resyncPlaybackMedia";
import { playbackEngine } from "../core/playbackEngine";
import { useWavePeaksStore } from "../store/wavePeaksStore";
import { verifyBlobUrl } from "../lib/verifyBlobUrl";
import { fulfillViewerPendingPlay } from "../lib/playbackViewerIntent";
import { useTimelineAudioImport } from "./useTimelineAudioImport";
import { useTimelineRemoteAudio } from "./useTimelineRemoteAudio";
import { useTimelineWaveDecode } from "./useTimelineWaveDecode";

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  loggedIn: boolean;
  serverProjectId: number | null;
  audioAssetId: number | null;
  audioSupabasePath: string | null | undefined;
  flowLocalAudioKey: string | null | undefined;
  publicShareView?: boolean;
};

function hasActiveFlowAudioKey(
  flowLocalAudioKey: string | null | undefined
): flowLocalAudioKey is string {
  return typeof flowLocalAudioKey === "string" && flowLocalAudioKey.length > 0;
}

/**
 * タイムライン UI から独立した音源パイプライン。
 * 立ち位置編集や TimelinePanel ref 未接続時でも音源読み込み・インポートが動く。
 */
export function useEditorAudioSession({
  setProject,
  loggedIn,
  serverProjectId,
  audioAssetId,
  audioSupabasePath,
  flowLocalAudioKey,
  publicShareView = false,
}: Params) {
  const flowKey =
    typeof flowLocalAudioKey === "string" && flowLocalAudioKey.length > 0
      ? flowLocalAudioKey
      : null;
  const blobUrlRef = useRef<string | null>(null);
  const [reloadRemoteAudioNonce, setReloadRemoteAudioNonce] = useState(0);

  const { decodePeaksFromBuffer } = useTimelineWaveDecode({ setProject });

  const decodePeaksRef = useRef(decodePeaksFromBuffer);
  decodePeaksRef.current = decodePeaksFromBuffer;

  const {
    extractProgress,
    audioFileInputRef,
    onPickAudio,
    openAudioImport,
  } = useTimelineAudioImport({
    setProject,
    loggedIn,
    serverProjectId,
    blobUrlRef,
    decodePeaksFromBuffer,
  });

  useTimelineRemoteAudio({
    blobUrlRef,
    decodePeaksRef,
    audioAssetId,
    audioSupabasePath,
    flowLocalAudioKey,
    publicShareView,
    reloadRemoteAudioNonce,
  });

  const requestRemoteAudioReload = useCallback(() => {
    setReloadRemoteAudioNonce((n) => n + 1);
  }, []);

  const resyncPlayback = useCallback(
    (opts?: { force?: boolean }): Promise<void> => {
      return resolveEditorPlaybackBlobUrl(blobUrlRef).then(async (url) => {
        if (url) {
          blobUrlRef.current = url;
          await resyncEditorPlaybackMedia(blobUrlRef, opts);
          fulfillViewerPendingPlay();
          return;
        }
        const peaks = useWavePeaksStore.getState().peaks;
        const engineUrl = playbackEngine.getMediaSourceUrl();
        if (peaks?.length && engineUrl) {
          const valid =
            !engineUrl.startsWith("blob:") || (await verifyBlobUrl(engineUrl));
          if (valid) {
            blobUrlRef.current = engineUrl;
            await resyncEditorPlaybackMedia(blobUrlRef, opts);
            fulfillViewerPendingPlay();
            return;
          }
        }
        if (hasActiveFlowAudioKey(flowKey)) {
          const engineUrl = playbackEngine.getMediaSourceUrl();
          if (engineUrl) {
            const valid =
              !engineUrl.startsWith("blob:") ||
              (await verifyBlobUrl(engineUrl));
            if (valid) {
              blobUrlRef.current = engineUrl;
              await resyncEditorPlaybackMedia(blobUrlRef, opts);
              fulfillViewerPendingPlay();
              return;
            }
          }
        }
        requestRemoteAudioReload();
      });
    },
    [requestRemoteAudioReload, flowKey]
  );

  /** レイアウト切替・タブ復帰後も blob URL を `<audio>` に再接続 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let debounce = 0;
    const scheduleResync = (force = false) => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        resyncPlayback({ force });
      }, 80);
    };

    const onPageWake = () => {
      if (document.visibilityState === "hidden") return;
      scheduleResync(false);
    };

    const onLayoutChange = () => scheduleResync(false);

    const mqWide = window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`);
    mqWide.addEventListener("change", onLayoutChange);
    const unsubViewport = subscribeEditorViewport(onLayoutChange);
    window.addEventListener("resize", onLayoutChange);
    document.addEventListener("visibilitychange", onPageWake);
    window.addEventListener("pageshow", onPageWake);
    window.addEventListener("focus", onPageWake);

    return () => {
      window.clearTimeout(debounce);
      mqWide.removeEventListener("change", onLayoutChange);
      unsubViewport();
      window.removeEventListener("resize", onLayoutChange);
      document.removeEventListener("visibilitychange", onPageWake);
      window.removeEventListener("pageshow", onPageWake);
      window.removeEventListener("focus", onPageWake);
    };
  }, [resyncPlayback]);

  return {
    extractProgress,
    audioFileInputRef,
    onPickAudio,
    openAudioImport,
    resyncPlayback,
    reloadRemoteAudio: requestRemoteAudioReload,
  };
}
