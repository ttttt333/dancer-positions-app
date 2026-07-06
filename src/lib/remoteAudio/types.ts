import type { MutableRefObject } from "react";
import type { DecodePeaksOptions } from "../../hooks/useTimelineWaveDecode";
import type { IAudioPlayer } from "./audioPlayer";
import type { LoadAbort } from "./loadAbort";
import { LoadScopedBlobUrls } from "./blobUrlManager";

export type DecodePeaksFn = (
  buf: ArrayBuffer,
  options?: DecodePeaksOptions
) => Promise<void>;

export type IsCancelled = () => boolean;

export type RemoteAudioLoadContext = {
  blobUrlRef: MutableRefObject<string | null>;
  decodePeaksRef: MutableRefObject<DecodePeaksFn>;
  clearPlaybackTrustedDurationSec: () => void;
  publicShareView: boolean;
  loadAbort: LoadAbort;
  /** @deprecated loadAbort.isAborted と同等。既存ローダー互換用 */
  isCancelled: IsCancelled;
  audioPlayer: IAudioPlayer;
  /** ロード中のみ有効な blob URL スコープ（abort 時に未コミット URL を revoke） */
  blobUrls: LoadScopedBlobUrls;
};
