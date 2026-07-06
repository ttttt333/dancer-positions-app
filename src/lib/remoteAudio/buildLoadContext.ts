import type { MutableRefObject } from "react";
import type { LoadAbort } from "./loadAbort";
import type { IAudioPlayer } from "./audioPlayer";
import { defaultAudioPlayer } from "./audioPlayer";
import { LoadScopedBlobUrls } from "./blobUrlManager";
import type { DecodePeaksFn, RemoteAudioLoadContext } from "./types";

export type BuildLoadContextParams = {
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksRef: MutableRefObject<DecodePeaksFn>;
  clearPlaybackTrustedDurationSec: () => void;
  publicShareView: boolean;
  loadAbort: LoadAbort;
  audioPlayer?: IAudioPlayer;
};

export function buildRemoteAudioLoadContext(
  params: BuildLoadContextParams
): RemoteAudioLoadContext {
  const audioPlayer = params.audioPlayer ?? defaultAudioPlayer;
  const blobUrls = new LoadScopedBlobUrls(params.loadAbort);
  return {
    blobUrlRef: params.blobUrlRef,
    decodePeaksRef: params.decodePeaksRef,
    clearPlaybackTrustedDurationSec: params.clearPlaybackTrustedDurationSec,
    publicShareView: params.publicShareView,
    loadAbort: params.loadAbort,
    isCancelled: () => params.loadAbort.isAborted(),
    audioPlayer,
    blobUrls,
  };
}
