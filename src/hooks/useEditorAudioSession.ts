import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { EDITOR_WIDE_MIN_PX } from "../pages/editor/editorConstants";
import { subscribeEditorViewport } from "../pages/editor/editorViewport";
import { resyncEditorPlaybackMedia, resolveEditorPlaybackBlobUrl } from "../lib/resyncPlaybackMedia";
import { playbackEngine } from "../core/playbackEngine";
import { useWavePeaksStore } from "../store/wavePeaksStore";
import { fulfillViewerPendingPlay } from "../lib/playbackViewerIntent";
import { isPlaybackBlobAlive } from "../lib/restorePlaybackAudio";
import { useTimelineAudioImport } from "./useTimelineAudioImport";
import { useTimelineRemoteAudio } from "./useTimelineRemoteAudio";
import { useTimelineWaveDecode } from "./useTimelineWaveDecode";

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  loggedIn: boolean;
  authReady?: boolean;
  serverProjectId: number | null;
  audioAssetId: number | null;
  audioSupabasePath: string | null | undefined;
  flowLocalAudioKey: string | null | undefined;
  publicShareView?: boolean;
  /** 音源取り込み直後に作品 JSON をクラウドへ保存（audioSupabasePath を共有 URL に載せる） */
  persistProjectToCloudAfterAudioImport?: (
    audioPatch?: Pick<
      ChoreographyProjectJson,
      "audioSupabasePath" | "audioAssetId" | "flowLocalAudioKey"
    >
  ) => Promise<unknown>;
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
  authReady = true,
  serverProjectId,
  audioAssetId,
  audioSupabasePath,
  flowLocalAudioKey,
  publicShareView = false,
  persistProjectToCloudAfterAudioImport,
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
    persistProjectToCloudAfterAudioImport,
  });

  useTimelineRemoteAudio({
    blobUrlRef,
    decodePeaksRef,
    audioAssetId,
    audioSupabasePath,
    flowLocalAudioKey,
    publicShareView,
    reloadRemoteAudioNonce,
    authReady,
  });

  const requestRemoteAudioReload = useCallback(() => {
    setReloadRemoteAudioNonce((n) => n + 1);
  }, []);

  const resyncPlayback = useCallback(
    (opts?: { force?: boolean }): Promise<void> => {
      const restoreCtx = {
        audioSupabasePath,
        audioAssetId,
        flowLocalAudioKey,
      };
      return resolveEditorPlaybackBlobUrl(blobUrlRef, restoreCtx).then(async (url) => {
        if (url) {
          blobUrlRef.current = url;
          await resyncEditorPlaybackMedia(blobUrlRef, { ...restoreCtx, ...opts });
          fulfillViewerPendingPlay();
          return;
        }
        const peaks = useWavePeaksStore.getState().peaks;
        const engineUrl = playbackEngine.getMediaSourceUrl();
        if (peaks?.length && engineUrl && (await isPlaybackBlobAlive(engineUrl))) {
          blobUrlRef.current = engineUrl;
          await resyncEditorPlaybackMedia(blobUrlRef, { ...restoreCtx, ...opts });
          fulfillViewerPendingPlay();
          return;
        }
        if (hasActiveFlowAudioKey(flowKey)) {
          const engineUrl = playbackEngine.getMediaSourceUrl();
          if (engineUrl && (await isPlaybackBlobAlive(engineUrl))) {
            blobUrlRef.current = engineUrl;
            await resyncEditorPlaybackMedia(blobUrlRef, { ...restoreCtx, ...opts });
            fulfillViewerPendingPlay();
            return;
          }
        }
        requestRemoteAudioReload();
      });
    },
    [
      requestRemoteAudioReload,
      flowKey,
      audioSupabasePath,
      audioAssetId,
      flowLocalAudioKey,
    ]
  );

  useEffect(() => {
    if (!authReady && !publicShareView) return;
    const timer = window.setTimeout(() => {
      void resyncPlayback({ force: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    audioSupabasePath,
    audioAssetId,
    flowLocalAudioKey,
    authReady,
    publicShareView,
    resyncPlayback,
  ]);

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
      void (async () => {
        const engineUrl = playbackEngine.getMediaSourceUrl();
        if (engineUrl && !(await isPlaybackBlobAlive(engineUrl))) {
          requestRemoteAudioReload();
          return;
        }
        scheduleResync(true);
      })();
    };

    const onPageHide = () => {
      /* blob URL は OS が失効させることがある — 復帰時に onPageWake で再構築 */
    };

    const onLayoutChange = () => scheduleResync(false);

    const mqWide = window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`);
    mqWide.addEventListener("change", onLayoutChange);
    const unsubViewport = subscribeEditorViewport(onLayoutChange);
    window.addEventListener("resize", onLayoutChange);
    document.addEventListener("visibilitychange", onPageWake);
    window.addEventListener("pageshow", onPageWake);
    window.addEventListener("focus", onPageWake);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearTimeout(debounce);
      mqWide.removeEventListener("change", onLayoutChange);
      unsubViewport();
      window.removeEventListener("resize", onLayoutChange);
      document.removeEventListener("visibilitychange", onPageWake);
      window.removeEventListener("pageshow", onPageWake);
      window.removeEventListener("focus", onPageWake);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [resyncPlayback, requestRemoteAudioReload]);

  return {
    extractProgress,
    audioFileInputRef,
    onPickAudio,
    openAudioImport,
    resyncPlayback,
    reloadRemoteAudio: requestRemoteAudioReload,
  };
}
