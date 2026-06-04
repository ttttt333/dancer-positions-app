import type { MutableRefObject } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  persistedServerAudioBlobUrl,
  persistedSupabaseAudioBlobUrl,
  persistedFlowAudioBlobUrl,
} from "./timelineAudioBlobPersist";
import { verifyBlobUrl } from "./verifyBlobUrl";

/** セッション内で有効な blob / 現在の `<audio>` src を優先順に探す */
export async function resolveEditorPlaybackBlobUrl(
  blobUrlRef: MutableRefObject<string | null>
): Promise<string | null> {
  const candidates = [
    blobUrlRef.current,
    playbackEngine.getMediaSourceUrl(),
    persistedServerAudioBlobUrl,
    persistedSupabaseAudioBlobUrl,
    persistedFlowAudioBlobUrl,
  ].filter((u): u is string => typeof u === "string" && u.length > 0);

  const seen = new Set<string>();
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    if (await verifyBlobUrl(url)) return url;
  }
  return null;
}

/**
 * レイアウト切替・タブ復帰・`<audio>` 再マウント後に blob URL を `<audio>` へ再接続。
 * @returns `"reload"` のときリモート音源の再取得が必要
 */
export async function resyncEditorPlaybackMedia(
  blobUrlRef: MutableRefObject<string | null>,
  opts?: { force?: boolean }
): Promise<"ok" | "reload"> {
  const url = await resolveEditorPlaybackBlobUrl(blobUrlRef);
  if (!url) return "reload";

  blobUrlRef.current = url;

  const el = playbackEngine.getMediaElement();
  const engineUrl = playbackEngine.getMediaSourceUrl();
  const broken =
    el != null &&
    (el.error != null ||
      (engineUrl.length > 0 && el.readyState === HTMLMediaElement.HAVE_NOTHING));
  const needsReload =
    opts?.force === true ||
    broken ||
    engineUrl.length === 0 ||
    engineUrl !== url;

  if (needsReload) {
    playbackEngine.setMediaSourceUrl(url, { force: true });
  }

  return "ok";
}
