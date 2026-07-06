import type { MutableRefObject } from "react";
import { useEffect } from "react";
import { getToken } from "../../api/client";
import { persistedServerAudioAssetId } from "../../lib/timelineAudioBlobPersist";
import { revokePersistedServerAudioBlob } from "../../lib/timelineAudioBlobPersist";
import { buildRemoteAudioLoadContext } from "../../lib/remoteAudio/buildLoadContext";
import { runLoadTask } from "../../lib/remoteAudio/loadAbort";
import {
  loadAudioFromProvider,
  reportAudioProviderError,
} from "../../lib/remoteAudio/AudioLoader";
import type { IAudioPlayer } from "../../lib/remoteAudio/audioPlayer";
import type { DecodePeaksFn } from "../../lib/remoteAudio/types";
import type { ActiveAudioSourceKind } from "../../lib/audioSourcePriority";
import { teardownServerAudioWhenDetached } from "../../lib/remoteAudio/audioSourceTeardown";

type Params = {
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksRef: MutableRefObject<DecodePeaksFn>;
  audioAssetId: number | null;
  reloadRemoteAudioNonce: number;
  publicShareView: boolean;
  clearPlaybackTrustedDurationSec: () => void;
  audioPlayer: IAudioPlayer;
  activeAudioSource: ActiveAudioSourceKind;
};

export function useServerRemoteAudio({
  blobUrlRef,
  decodePeaksRef,
  audioAssetId,
  reloadRemoteAudioNonce,
  publicShareView,
  clearPlaybackTrustedDurationSec,
  audioPlayer,
  activeAudioSource,
}: Params) {
  useEffect(() => {
    const aid = audioAssetId;

    if (activeAudioSource !== "server") {
      if (aid == null) {
        teardownServerAudioWhenDetached(
          blobUrlRef,
          clearPlaybackTrustedDurationSec,
          audioPlayer
        );
      }
      return;
    }

    if (aid == null || !getToken()) return;

    if (
      persistedServerAudioAssetId != null &&
      persistedServerAudioAssetId !== aid
    ) {
      revokePersistedServerAudioBlob();
    }

    return runLoadTask(async (loadAbort) => {
      try {
        await loadAudioFromProvider("server", {
          ...buildRemoteAudioLoadContext({
            blobUrlRef,
            decodePeaksRef,
            clearPlaybackTrustedDurationSec,
            publicShareView,
            loadAbort,
            audioPlayer,
          }),
          assetId: aid,
        });
      } catch (e) {
        reportAudioProviderError("server", e);
      }
    });
  }, [
    audioAssetId,
    audioPlayer,
    blobUrlRef,
    clearPlaybackTrustedDurationSec,
    decodePeaksRef,
    publicShareView,
    reloadRemoteAudioNonce,
    activeAudioSource,
  ]);
}
