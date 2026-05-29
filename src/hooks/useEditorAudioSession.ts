import type { Dispatch, SetStateAction } from "react";
import { useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
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

  return {
    extractProgress,
    audioFileInputRef,
    onPickAudio,
    openAudioImport,
  };
}
