import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { playbackEngine } from "../core/playbackEngine";
import { EDITOR_WIDE_MIN_PX } from "../pages/editor/editorConstants";
import { subscribeEditorViewport } from "../pages/editor/editorViewport";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { verifyBlobUrl } from "../lib/verifyBlobUrl";
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
  const blobUrlRef = useRef<string | null>(null);

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
  });

  /** レイアウト切替・ウィンドウリサイズ後も blob URL を `<audio>` に再接続 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let debounce = 0;
    const resync = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        const url = blobUrlRef.current;
        if (!url) return;
        void verifyBlobUrl(url).then((valid) => {
          if (!valid) return;
          if (playbackEngine.getMediaSourceUrl() === url) return;
          usePlaybackUiStore.getState().setTrustedAudioDurationSec(null);
          playbackEngine.setMediaSourceUrl(url);
        });
      }, 80);
    };
    const mqWide = window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`);
    mqWide.addEventListener("change", resync);
    const unsubViewport = subscribeEditorViewport(resync);
    window.addEventListener("resize", resync);
    return () => {
      window.clearTimeout(debounce);
      mqWide.removeEventListener("change", resync);
      unsubViewport();
      window.removeEventListener("resize", resync);
    };
  }, []);

  return {
    extractProgress,
    audioFileInputRef,
    onPickAudio,
    openAudioImport,
  };
}
