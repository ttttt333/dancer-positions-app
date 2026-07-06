import {
  persistedSupabaseAudioBlobUrl,
  persistedSupabaseAudioPath,
  revokePersistedFlowAudioBlob,
  revokePersistedServerAudioBlob,
} from "../../timelineAudioBlobPersist";
import { reportAudioLoadError } from "../remoteAudioUi";
import { resolveVerifiedReuseUrl } from "../reuseBlobUrl";
import type { RemoteAudioLoadContext } from "../types";
import { loadSupabaseAlreadyPlaying } from "./supabase/loadSupabaseAlreadyPlaying";
import { loadSupabaseFreshDownload } from "./supabase/loadSupabaseFreshDownload";
import { loadSupabaseReusePath } from "./supabase/loadSupabaseReuse";
import { recoverInvalidSupabaseReuseUrl } from "./supabase/supabaseBlobResolve";

export type LoadSupabaseAudioParams = RemoteAudioLoadContext & {
  effectivePath: string;
};

export async function loadSupabaseAudio(
  params: LoadSupabaseAudioParams
): Promise<void> {
  const { audioPlayer, loadAbort, effectivePath } = params;

  revokePersistedServerAudioBlob();
  revokePersistedFlowAudioBlob();

  const reuseUrlRaw =
    persistedSupabaseAudioPath === effectivePath
      ? persistedSupabaseAudioBlobUrl
      : null;

  const reuseUrl = await resolveVerifiedReuseUrl(reuseUrlRaw, () =>
    recoverInvalidSupabaseReuseUrl(effectivePath)
  );
  loadAbort.throwIfAborted();

  if (reuseUrl) {
    await loadSupabaseReusePath(params, reuseUrl);
    return;
  }

  const engineUrl = audioPlayer.getMediaSourceUrl();
  const alreadyPlayingThisPath =
    persistedSupabaseAudioPath === effectivePath &&
    engineUrl.length > 0 &&
    engineUrl === persistedSupabaseAudioBlobUrl;

  if (alreadyPlayingThisPath) {
    await loadSupabaseAlreadyPlaying(params);
    return;
  }

  await loadSupabaseFreshDownload(params);
}

export function reportSupabaseAudioLoadError(
  publicShareView: boolean,
  err: unknown
): void {
  if (err instanceof DOMException && err.name === "AbortError") return;
  const msg =
    err instanceof Error ? err.message : "音源の読み込みに失敗しました";
  reportAudioLoadError(publicShareView, msg);
  console.error(err);
}
