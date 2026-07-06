import type { MutableRefObject } from "react";
import { revokeBlobUrlUnlessCloudPersisted } from "../timelineAudioBlobPersist";
import { resyncEditorPlaybackMedia } from "../resyncPlaybackMedia";
import type { IAudioPlayer } from "./audioPlayer";
import { defaultAudioPlayer } from "./audioPlayer";

export function assignBlobUrlRef(
  blobUrlRef: MutableRefObject<string | null>,
  url: string,
  revokePrevious: boolean
) {
  const cur = blobUrlRef.current;
  if (revokePrevious && cur && cur !== url) {
    revokeBlobUrlUnlessCloudPersisted(cur);
  }
  blobUrlRef.current = url;
}

/** 再生 URL を設定（同一 URL・再生中は load() しない） */
export function syncPlaybackUrl(
  blobUrlRef: MutableRefObject<string | null>,
  url: string,
  clearPlaybackTrustedDurationSec: () => void,
  audioPlayer: IAudioPlayer = defaultAudioPlayer,
  opts?: { revokePrevious?: boolean; skipEngineIfSame?: boolean }
) {
  assignBlobUrlRef(blobUrlRef, url, opts?.revokePrevious ?? false);
  const el = audioPlayer.getMediaElement();
  const applied = Boolean(el && (el.currentSrc === url || el.src === url));
  if (opts?.skipEngineIfSame !== false && applied) {
    return;
  }
  clearPlaybackTrustedDurationSec();
  audioPlayer.setMediaSourceUrl(url, { force: true });
  void resyncEditorPlaybackMedia(blobUrlRef).catch(() => {});
}

/** blob URL を ref に載せ、必要なら engine へ反映（新規ダウンロード経路向け） */
export function mountBlobUrlToPlayback(
  blobUrlRef: MutableRefObject<string | null>,
  blobUrl: string,
  clearPlaybackTrustedDurationSec: () => void,
  audioPlayer: IAudioPlayer = defaultAudioPlayer,
  opts?: { revokePrevious?: boolean; forceEngine?: boolean }
) {
  assignBlobUrlRef(blobUrlRef, blobUrl, opts?.revokePrevious ?? false);
  const curEngine = audioPlayer.getMediaSourceUrl();
  if (
    opts?.forceEngine ||
    curEngine !== blobUrl ||
    !audioPlayer.getMediaElement()?.src
  ) {
    clearPlaybackTrustedDurationSec();
    audioPlayer.setMediaSourceUrl(blobUrl, { force: true });
  }
}
