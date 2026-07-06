import type { MutableRefObject } from "react";
import { useEffect } from "react";
import { isSupabaseBackend } from "../../lib/supabaseClient";
import {
  clearSupabaseAudioSource,
  persistedSupabaseAudioPath,
} from "../../lib/timelineAudioBlobPersist";
import { buildRemoteAudioLoadContext } from "../../lib/remoteAudio/buildLoadContext";
import { runLoadTask } from "../../lib/remoteAudio/loadAbort";
import {
  loadAudioFromProvider,
  reportAudioProviderError,
} from "../../lib/remoteAudio/AudioLoader";
import { ensureSupabaseAudioAuth } from "../../lib/remoteAudio/supabaseAudioAuth";
import { teardownSupabaseAudioWhenDetached } from "../../lib/remoteAudio/audioSourceTeardown";
import type { IAudioPlayer } from "../../lib/remoteAudio/audioPlayer";
import type { DecodePeaksFn } from "../../lib/remoteAudio/types";
import type { ActiveAudioSourceKind } from "../../lib/audioSourcePriority";
import { useShareViewAudioLoadStore } from "../../store/shareViewAudioLoadStore";

type Params = {
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksRef: MutableRefObject<DecodePeaksFn>;
  audioSupabasePath: string | null | undefined;
  reloadRemoteAudioNonce: number;
  publicShareView: boolean;
  authReady: boolean;
  clearPlaybackTrustedDurationSec: () => void;
  audioPlayer: IAudioPlayer;
  activeAudioSource: ActiveAudioSourceKind;
};

function resolveEffectiveSupabasePath(
  rawPath: string | null | undefined
): string | null {
  const path =
    typeof rawPath === "string" && rawPath.trim().length > 0
      ? rawPath.trim()
      : null;
  return isSupabaseBackend() ? path : null;
}

export function useSupabaseRemoteAudio({
  blobUrlRef,
  decodePeaksRef,
  audioSupabasePath,
  reloadRemoteAudioNonce,
  publicShareView,
  authReady,
  clearPlaybackTrustedDurationSec,
  audioPlayer,
  activeAudioSource,
}: Params) {
  useEffect(() => {
    const effectivePath = resolveEffectiveSupabasePath(audioSupabasePath);

    if (activeAudioSource !== "supabase") {
      if (effectivePath == null) {
        teardownSupabaseAudioWhenDetached(
          blobUrlRef,
          clearPlaybackTrustedDurationSec,
          audioPlayer,
          publicShareView
        );
      }
      return;
    }

    if (effectivePath == null) return;

    if (
      persistedSupabaseAudioPath != null &&
      persistedSupabaseAudioPath !== effectivePath
    ) {
      clearSupabaseAudioSource();
    }

    return runLoadTask(async (loadAbort) => {
      try {
        if (!publicShareView) {
          if (!(await ensureSupabaseAudioAuth(authReady))) return;
        } else {
          useShareViewAudioLoadStore
            .getState()
            .setLoading(0.05, "音源を読み込み中…");
        }

        await loadAudioFromProvider("supabase", {
          ...buildRemoteAudioLoadContext({
            blobUrlRef,
            decodePeaksRef,
            clearPlaybackTrustedDurationSec,
            publicShareView,
            loadAbort,
            audioPlayer,
          }),
          effectivePath,
        });
      } catch (e) {
        reportAudioProviderError("supabase", e, { publicShareView });
      }
    });
  }, [
    audioPlayer,
    audioSupabasePath,
    authReady,
    blobUrlRef,
    clearPlaybackTrustedDurationSec,
    decodePeaksRef,
    publicShareView,
    reloadRemoteAudioNonce,
    activeAudioSource,
  ]);
}
