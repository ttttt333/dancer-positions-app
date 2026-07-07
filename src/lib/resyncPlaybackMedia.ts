import type { MutableRefObject } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  persistedServerAudioBlobUrl,
  persistedSupabaseAudioBlobUrl,
  persistedFlowAudioBlobUrl,
  persistedSupabaseAudioPath,
  revokeEphemeralSupabaseBlobUrl,
  revokePersistedFlowAudioBlob,
  revokePersistedServerAudioBlob,
} from "./timelineAudioBlobPersist";
import { verifyBlobUrl } from "./verifyBlobUrl";
import {
  restorePlaybackBlobUrl,
  type PlaybackAudioRestoreContext,
} from "./restorePlaybackAudio";
import { waitForAudioElementReady } from "./audioElementReady";

export type ResolvePlaybackBlobOptions = PlaybackAudioRestoreContext;

function discardDeadPersistedBlobUrl(url: string): void {
  if (url === persistedSupabaseAudioBlobUrl) revokeEphemeralSupabaseBlobUrl();
  else if (url === persistedServerAudioBlobUrl) revokePersistedServerAudioBlob();
  else if (url === persistedFlowAudioBlobUrl) revokePersistedFlowAudioBlob();
}

/** セッション内で有効な blob / 現在の `<audio>` src を優先順に探す */
export async function resolveEditorPlaybackBlobUrl(
  blobUrlRef: MutableRefObject<string | null>,
  opts?: ResolvePlaybackBlobOptions
): Promise<string | null> {
  const candidates = [
    blobUrlRef.current,
    persistedSupabaseAudioBlobUrl,
    persistedServerAudioBlobUrl,
    persistedFlowAudioBlobUrl,
    playbackEngine.getMediaSourceUrl(),
  ].filter((u): u is string => typeof u === "string" && u.length > 0);

  const seen = new Set<string>();
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    if (await verifyBlobUrl(url)) return url;
    if (url.startsWith("blob:")) discardDeadPersistedBlobUrl(url);
    if (blobUrlRef.current === url) blobUrlRef.current = null;
  }

  return restorePlaybackBlobUrl({
    audioSupabasePath:
      opts?.audioSupabasePath ?? persistedSupabaseAudioPath ?? null,
    audioAssetId: opts?.audioAssetId ?? null,
    flowLocalAudioKey: opts?.flowLocalAudioKey ?? null,
  });
}

/**
 * レイアウト切替・タブ復帰・`<audio>` 再マウント後に blob URL を `<audio>` へ再接続。
 * @returns `"reload"` のときリモート音源の再取得が必要
 */
export async function resyncEditorPlaybackMedia(
  blobUrlRef: MutableRefObject<string | null>,
  opts?: { force?: boolean } & ResolvePlaybackBlobOptions
): Promise<"ok" | "reload"> {
  const url = await resolveEditorPlaybackBlobUrl(blobUrlRef, opts);
  if (!url) return "reload";

  blobUrlRef.current = url;

  const el = playbackEngine.getMediaElement();
  const appliedOnEl = Boolean(
    el && (el.currentSrc === url || el.src === url)
  );
  const broken =
    el != null &&
    (el.error != null ||
      (appliedOnEl && el.readyState === HTMLMediaElement.HAVE_NOTHING));
  const needsReload = opts?.force === true || !appliedOnEl || broken;

  if (needsReload) {
    playbackEngine.setMediaSourceUrl(url, { force: true });
    await waitForAudioElementReady(el).catch(() => {});
  }

  return "ok";
}
