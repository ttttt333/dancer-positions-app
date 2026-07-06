import type { MutableRefObject } from "react";
import { useMemo } from "react";
import { useFlowRemoteAudio } from "./remoteAudio/useFlowRemoteAudio";
import { useRemoteAudioSession } from "./remoteAudio/useRemoteAudioSession";
import { useServerRemoteAudio } from "./remoteAudio/useServerRemoteAudio";
import { useSupabaseRemoteAudio } from "./remoteAudio/useSupabaseRemoteAudio";
import { resolveActiveAudioSource } from "../lib/audioSourcePriority";
import type { ActiveAudioSourceKind } from "../lib/audioSourcePriority";
import type { DecodePeaksFn } from "../lib/remoteAudio/types";

type Params = {
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksRef: MutableRefObject<DecodePeaksFn>;
  audioAssetId: number | null;
  audioSupabasePath: string | null | undefined;
  flowLocalAudioKey: string | null | undefined;
  /** 生徒閲覧（/view/s/…）: ログインなしで Supabase 音源を読む */
  publicShareView?: boolean;
  /** タブ復帰などで blob が無効になったときリモート音源を再取得 */
  reloadRemoteAudioNonce?: number;
  /** Supabase セッション復元後にリモート音源読み込みを再試行 */
  authReady?: boolean;
};

/**
 * プロジェクトに紐づくリモート／ローカルストア音源（API・Supabase・フローライブラリ）を
 * `playbackEngine` と波形デコードへ同期する。
 *
 * ソース種別ごとのロードは `useServerRemoteAudio` / `useSupabaseRemoteAudio` /
 * `useFlowRemoteAudio` に委譲する。
 */
export function useTimelineRemoteAudio({
  blobUrlRef,
  decodePeaksRef,
  audioAssetId,
  audioSupabasePath,
  flowLocalAudioKey,
  publicShareView = false,
  reloadRemoteAudioNonce = 0,
  authReady = true,
}: Params) {
  const { clearPlaybackTrustedDurationSec, audioPlayer } = useRemoteAudioSession(
    blobUrlRef,
    publicShareView
  );

  const activeAudioSource: ActiveAudioSourceKind = useMemo(
    () =>
      resolveActiveAudioSource({
        audioAssetId,
        audioSupabasePath,
        flowLocalAudioKey,
      }),
    [audioAssetId, audioSupabasePath, flowLocalAudioKey]
  );

  const session = {
    blobUrlRef,
    decodePeaksRef,
    publicShareView,
    reloadRemoteAudioNonce,
    clearPlaybackTrustedDurationSec,
    audioPlayer,
    activeAudioSource,
  };

  useServerRemoteAudio({ ...session, audioAssetId });
  useSupabaseRemoteAudio({ ...session, audioSupabasePath, authReady });
  useFlowRemoteAudio({
    ...session,
    flowLocalAudioKey,
  });
}
