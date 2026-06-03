import { playbackEngine } from "../core/playbackEngine";
import { isCoepSafeMediaUrl } from "./coepMedia";
import {
  persistedServerAudioBlobUrl,
  persistedSupabaseAudioBlobUrl,
} from "./timelineAudioBlobPersist";

/** 動画書き出し用: COEP 下でも読める blob / 同一オリジン URL を優先 */
export function resolvePlaybackAudioUrlForExport(): string | null {
  const candidates = [
    persistedSupabaseAudioBlobUrl,
    persistedServerAudioBlobUrl,
    playbackEngine.getMediaSourceUrl(),
  ].filter((u): u is string => typeof u === "string" && u.length > 0);

  const seen = new Set<string>();
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    if (isCoepSafeMediaUrl(url)) return url;
  }
  return null;
}
