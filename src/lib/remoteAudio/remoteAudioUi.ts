import type { MutableRefObject } from "react";
import { waitForAudioElementReady } from "../audioElementReady";
import { fulfillViewerPendingPlay } from "../playbackViewerIntent";
import {
  clearWaveLoadProgress,
  reportWaveLoadError,
  reportWaveLoadProgress,
} from "../waveLoadProgress";
import { resyncEditorPlaybackMedia } from "../resyncPlaybackMedia";
import { useShareViewAudioLoadStore } from "../../store/shareViewAudioLoadStore";
import type { IAudioPlayer } from "./audioPlayer";
import { defaultAudioPlayer } from "./audioPlayer";

export function reportAudioLoadProgress(
  publicShareView: boolean,
  ratio: number,
  message?: string
) {
  reportWaveLoadProgress(ratio, message);
  if (publicShareView) {
    useShareViewAudioLoadStore.getState().setLoading(ratio, message ?? "");
  }
}

export function reportAudioLoadError(publicShareView: boolean, message: string) {
  reportWaveLoadError(message);
  if (publicShareView) {
    useShareViewAudioLoadStore.getState().setError(message);
  }
}

/** 音源 URL 設定後: ブラウザが再生可能になったら UI を解放 */
function scheduleMarkPlaybackReady(
  publicShareView: boolean,
  audioPlayer: IAudioPlayer
) {
  void waitForAudioElementReady(audioPlayer.getMediaElement())
    .then(() => {
      clearWaveLoadProgress();
      if (publicShareView) {
        useShareViewAudioLoadStore.getState().setReady();
      }
      fulfillViewerPendingPlay();
    })
    .catch((e) => {
      const msg =
        e instanceof Error ? e.message : "音源の読み込みに失敗しました";
      reportAudioLoadError(publicShareView, msg);
    });
}

export function markPlaybackReadyForWaveFetch(
  publicShareView: boolean,
  blobUrlRef: MutableRefObject<string | null>,
  audioPlayer: IAudioPlayer = defaultAudioPlayer
) {
  scheduleMarkPlaybackReady(publicShareView, audioPlayer);
  void resyncEditorPlaybackMedia(blobUrlRef, { force: true }).catch(() => {});
}
