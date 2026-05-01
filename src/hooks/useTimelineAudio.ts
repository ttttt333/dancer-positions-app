import type { Dispatch, SetStateAction } from "react";
import { useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { useTimelineAudioImport } from "./useTimelineAudioImport";
import { useTimelineRemoteAudio } from "./useTimelineRemoteAudio";
import { useTimelineWaveDecode } from "./useTimelineWaveDecode";

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  setPeaks: Dispatch<SetStateAction<number[] | null>>;
  loggedIn: boolean;
  serverProjectId: number | null;
  audioAssetId: number | null;
  audioSupabasePath: string | null | undefined;
  flowLocalAudioKey: string | null | undefined;
};

/**
 * 波形デコード・ファイル／動画インポート・リモート音源同期をまとめたタイムライン音源パイプライン。
 */
export function useTimelineAudio({
  setProject,
  setPeaks,
  loggedIn,
  serverProjectId,
  audioAssetId,
  audioSupabasePath,
  flowLocalAudioKey,
}: Params) {
  const blobUrlRef = useRef<string | null>(null);

  const { decodePeaksFromBuffer } = useTimelineWaveDecode({
    setProject,
    setPeaks,
  });

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
    decodePeaksFromBuffer,
    audioAssetId,
    audioSupabasePath,
    flowLocalAudioKey,
  });

  return {
    extractProgress,
    audioFileInputRef,
    onPickAudio,
    openAudioImport,
  };
}
