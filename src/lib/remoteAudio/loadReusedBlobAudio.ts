import type { DecodePeaksOptions } from "../../hooks/useTimelineWaveDecode";
import { arrayBufferFromBlobUrl } from "../timelineAudioBlobPersist";
import { reportWaveLoadProgress } from "../waveLoadProgress";
import { syncPlaybackUrl } from "./playbackBlobSync";
import { markPlaybackReadyForWaveFetch } from "./remoteAudioUi";
import type { RemoteAudioLoadContext } from "./types";

export type LoadReusedBlobAudioParams = RemoteAudioLoadContext & {
  reuseUrl: string;
  cacheKey: string;
  decodeOptions?: Pick<DecodePeaksOptions, "supabaseAudioPath">;
  /** 音源バッファが空のときの波形フォールバック */
  onEmptyBufferFallback?: () => Promise<void>;
  progressMessage?: string;
};

/**
 * 検証済み blob URL を再生へ載せ、音源バイトから波形を同期する共通経路。
 * Server / Supabase / Flow の reuse パスで共有する。
 */
export async function loadReusedBlobAudio(
  params: LoadReusedBlobAudioParams
): Promise<void> {
  const {
    blobUrlRef,
    decodePeaksRef,
    clearPlaybackTrustedDurationSec,
    publicShareView,
    isCancelled,
    audioPlayer,
    reuseUrl,
    cacheKey,
    decodeOptions,
    onEmptyBufferFallback,
    progressMessage = "波形を音源から同期中…",
  } = params;

  syncPlaybackUrl(
    blobUrlRef,
    reuseUrl,
    clearPlaybackTrustedDurationSec,
    audioPlayer,
    { revokePrevious: true }
  );
  reportWaveLoadProgress(0.35, progressMessage);

  const audioBuf = await arrayBufferFromBlobUrl(reuseUrl);
  if (!isCancelled() && audioBuf.byteLength > 0) {
    await decodePeaksRef.current(audioBuf, { cacheKey, ...decodeOptions });
  } else if (!isCancelled() && onEmptyBufferFallback) {
    await onEmptyBufferFallback();
  }

  markPlaybackReadyForWaveFetch(publicShareView, blobUrlRef, audioPlayer);
}
