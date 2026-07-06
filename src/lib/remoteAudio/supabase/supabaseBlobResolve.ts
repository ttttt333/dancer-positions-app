import { supabaseDownloadProjectAudioWithCache } from "../../supabaseAudio";
import {
  persistedSupabaseAudioBlobUrl,
  revokeEphemeralSupabaseBlobUrl,
  setPersistedSupabaseAudio,
} from "../../timelineAudioBlobPersist";
import { reportWaveLoadProgress } from "../../waveLoadProgress";
import { verifyBlobUrl } from "../../verifyBlobUrl";
import { restorePlaybackBlobUrl } from "../../restorePlaybackAudio";
import { mountBlobUrlToPlayback } from "../playbackBlobSync";
import type { LoadSupabaseAudioParams } from "../loadSupabaseAudio";

export async function recoverInvalidSupabaseReuseUrl(
  effectivePath: string
): Promise<string | null> {
  const rebuilt = await restorePlaybackBlobUrl({
    audioSupabasePath: effectivePath,
  });
  if (rebuilt) return rebuilt;
  revokeEphemeralSupabaseBlobUrl();
  return null;
}

export async function resolveActiveSupabaseBlobUrl(
  effectivePath: string
): Promise<string | null> {
  const activeBlobUrl = persistedSupabaseAudioBlobUrl;
  if (!activeBlobUrl) return null;

  const valid = await verifyBlobUrl(activeBlobUrl);
  if (valid) return activeBlobUrl;

  const rebuilt = await restorePlaybackBlobUrl({
    audioSupabasePath: effectivePath,
  });
  if (rebuilt) return rebuilt;

  revokeEphemeralSupabaseBlobUrl();
  return null;
}

export async function downloadAndMountSupabaseAudio(
  params: LoadSupabaseAudioParams,
  effectivePath: string
): Promise<string> {
  const {
    blobUrlRef,
    clearPlaybackTrustedDurationSec,
    audioPlayer,
    loadAbort,
    blobUrls,
  } = params;

  reportWaveLoadProgress(0.2, "音源を再取得中…");
  const audio = await supabaseDownloadProjectAudioWithCache(
    effectivePath,
    undefined,
    loadAbort.signal
  );
  loadAbort.throwIfAborted();

  const activeBlobUrl = blobUrls.create(
    new Blob([audio.buffer], { type: audio.mime })
  );
  setPersistedSupabaseAudio(activeBlobUrl, effectivePath);
  blobUrls.commit(activeBlobUrl);
  mountBlobUrlToPlayback(
    blobUrlRef,
    activeBlobUrl,
    clearPlaybackTrustedDurationSec,
    audioPlayer,
    { revokePrevious: true, forceEngine: true }
  );
  return activeBlobUrl;
}
