import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { resyncEditorPlaybackMedia, resolveEditorPlaybackBlobUrl } from "../lib/resyncPlaybackMedia";
import { playbackEngine } from "../core/playbackEngine";
import { useWavePeaksStore } from "../store/wavePeaksStore";
import { fulfillViewerPendingPlay } from "../lib/playbackViewerIntent";
import { isPlaybackBlobAlive } from "../lib/restorePlaybackAudio";
import { useTimelineAudioImport } from "./useTimelineAudioImport";
import { useTimelineRemoteAudio } from "./useTimelineRemoteAudio";
import { useTimelineWaveDecode } from "./useTimelineWaveDecode";
import { useAudioReconnector } from "./useAudioReconnector";
import { usePlaybackAudioStore } from "../store/playbackAudioStore";

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

  const getRestoreContext = useCallback(
    () => ({
      audioSupabasePath,
      audioAssetId,
      flowLocalAudioKey,
    }),
    [audioSupabasePath, audioAssetId, flowLocalAudioKey]
  );

  useEffect(() => {
    if (typeof audioSupabasePath === "string" && audioSupabasePath.trim()) {
      usePlaybackAudioStore.getState().setSupabaseSource(audioSupabasePath.trim());
    }
  }, [audioSupabasePath]);

  useAudioReconnector({
    enabled: true,
    blobUrlRef,
    getRestoreContext,
    onNeedsRemoteReload: requestRemoteAudioReload,
  });

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

  return {
    extractProgress,
    audioFileInputRef,
    onPickAudio,
    openAudioImport,
    resyncPlayback,
    reloadRemoteAudio: requestRemoteAudioReload,
  };
}
