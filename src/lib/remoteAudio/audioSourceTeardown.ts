import type { MutableRefObject } from "react";
import type { IAudioPlayer } from "./audioPlayer";
import {
  clearSupabaseAudioSource,
  persistedServerAudioBlobUrl,
  persistedSupabaseAudioBlobUrl,
  revokePersistedFlowAudioBlob,
  revokePersistedServerAudioBlob,
} from "../timelineAudioBlobPersist";
import { useWavePeaksStore } from "../../store/wavePeaksStore";
import { useShareViewAudioLoadStore } from "../../store/shareViewAudioLoadStore";

export function teardownServerAudioWhenDetached(
  blobUrlRef: MutableRefObject<string | null>,
  clearPlaybackTrustedDurationSec: () => void,
  audioPlayer: IAudioPlayer
) {
  const hadServerBlobAttached =
    blobUrlRef.current != null &&
    blobUrlRef.current === persistedServerAudioBlobUrl;
  revokePersistedServerAudioBlob();
  if (!hadServerBlobAttached) return;
  blobUrlRef.current = null;
  clearPlaybackTrustedDurationSec();
  audioPlayer.clearMediaSource();
}

export function teardownSupabaseAudioWhenDetached(
  blobUrlRef: MutableRefObject<string | null>,
  clearPlaybackTrustedDurationSec: () => void,
  audioPlayer: IAudioPlayer,
  publicShareView: boolean
) {
  const hadSupabaseBlobAttached =
    blobUrlRef.current != null &&
    blobUrlRef.current === persistedSupabaseAudioBlobUrl;

  if (publicShareView) {
    useShareViewAudioLoadStore.getState().setUnconfigured();
  }
  if (hadSupabaseBlobAttached) {
    useWavePeaksStore.getState().resetPeaks();
  }
  clearSupabaseAudioSource();
  if (!hadSupabaseBlobAttached) return;
  blobUrlRef.current = null;
  clearPlaybackTrustedDurationSec();
  audioPlayer.clearMediaSource();
}

export function teardownFlowAudioWhenDetached() {
  revokePersistedFlowAudioBlob();
}
