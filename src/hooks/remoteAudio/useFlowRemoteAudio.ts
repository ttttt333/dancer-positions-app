import type { MutableRefObject } from "react";
import { useEffect } from "react";
import { buildRemoteAudioLoadContext } from "../../lib/remoteAudio/buildLoadContext";
import { runLoadTask } from "../../lib/remoteAudio/loadAbort";
import {
  loadAudioFromProvider,
  reportAudioProviderError,
} from "../../lib/remoteAudio/AudioLoader";
import { teardownFlowAudioWhenDetached } from "../../lib/remoteAudio/audioSourceTeardown";
import type { IAudioPlayer } from "../../lib/remoteAudio/audioPlayer";
import type { DecodePeaksFn } from "../../lib/remoteAudio/types";
import type { ActiveAudioSourceKind } from "../../lib/audioSourcePriority";

type Params = {
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksRef: MutableRefObject<DecodePeaksFn>;
  flowLocalAudioKey: string | null | undefined;
  reloadRemoteAudioNonce: number;
  publicShareView: boolean;
  clearPlaybackTrustedDurationSec: () => void;
  audioPlayer: IAudioPlayer;
  activeAudioSource: ActiveAudioSourceKind;
};

export function useFlowRemoteAudio({
  blobUrlRef,
  decodePeaksRef,
  flowLocalAudioKey,
  reloadRemoteAudioNonce,
  publicShareView,
  clearPlaybackTrustedDurationSec,
  audioPlayer,
  activeAudioSource,
}: Params) {
  useEffect(() => {
    const flowKey = flowLocalAudioKey;

    if (activeAudioSource !== "flow") {
      if (typeof flowKey !== "string" || flowKey.length === 0) {
        teardownFlowAudioWhenDetached();
      }
      return;
    }

    if (typeof flowKey !== "string" || flowKey.length === 0) {
      teardownFlowAudioWhenDetached();
      return;
    }

    return runLoadTask(async (loadAbort) => {
      try {
        await loadAudioFromProvider("flow", {
          ...buildRemoteAudioLoadContext({
            blobUrlRef,
            decodePeaksRef,
            clearPlaybackTrustedDurationSec,
            publicShareView,
            loadAbort,
            audioPlayer,
          }),
          flowKey,
        });
      } catch (e) {
        reportAudioProviderError("flow", e);
      }
    });
  }, [
    activeAudioSource,
    audioPlayer,
    blobUrlRef,
    clearPlaybackTrustedDurationSec,
    decodePeaksRef,
    flowLocalAudioKey,
    publicShareView,
    reloadRemoteAudioNonce,
  ]);
}
