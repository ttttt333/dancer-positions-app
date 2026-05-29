import type { Dispatch, SetStateAction } from "react";
import { useRef } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { useTimelineAudioImport } from "./useTimelineAudioImport";
import { useTimelineRemoteAudio } from "./useTimelineRemoteAudio";
import { useTimelineWaveDecode, type DecodePeaksOptions } from "./useTimelineWaveDecode";

type Params = {
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  setPeaks: Dispatch<SetStateAction<number[] | null>>;
  loggedIn: boolean;
  serverProjectId: number | null;
  audioAssetId: number | null;
  audioSupabasePath: string | null | undefined;
  flowLocalAudioKey: string | null | undefined;
  publicShareView?: boolean;
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
  publicShareView = false,
}: Params) {
  const blobUrlRef = useRef<string | null>(null);

  const { decodePeaksFromBuffer } = useTimelineWaveDecode({
    setProject,
    setPeaks,
  });

  /** effect 再実行（向き変更等）で音源 reload を誘発しないよう ref 経由 */
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

export type { DecodePeaksOptions };
