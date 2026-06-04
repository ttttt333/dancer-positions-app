import { supabaseDownloadProjectAudioWithCache } from "./supabaseAudio";
import {
  getCachedAudioBlob,
  putCachedAudioBlob,
  waveMediaCacheKeyForSupabase,
} from "./waveMediaCache";
import {
  revokeEphemeralSupabaseBlobUrl,
  setPersistedSupabaseAudio,
  persistedSupabaseAudioPath,
} from "./timelineAudioBlobPersist";
import { usePlaybackAudioStore } from "../store/playbackAudioStore";

/**
 * Cache API から ArrayBuffer を取り出し、再生用の短命 blob URL を新規生成する。
 * 以前の blob URL は revoke する（正は cacheKey / supabasePath）。
 */
export async function materializeSupabasePlaybackUrl(
  path: string,
  onProgress?: (ratio: number) => void
): Promise<string | null> {
  const trimmed = path.trim();
  if (!trimmed) return null;

  revokeEphemeralSupabaseBlobUrl();

  const cacheKey = waveMediaCacheKeyForSupabase(trimmed);
  let buffer: ArrayBuffer;
  let mime = "audio/mpeg";

  const cached = await getCachedAudioBlob(cacheKey);
  if (cached?.blob.size) {
    onProgress?.(1);
    buffer = await cached.blob.arrayBuffer();
    mime = cached.mime || cached.blob.type || mime;
  } else {
    const downloaded = await supabaseDownloadProjectAudioWithCache(
      trimmed,
      onProgress
    );
    buffer = downloaded.buffer;
    mime = downloaded.mime || mime;
    void putCachedAudioBlob(
      cacheKey,
      new Blob([buffer], { type: mime }),
      mime
    );
  }

  const blobUrl = URL.createObjectURL(new Blob([buffer], { type: mime }));
  setPersistedSupabaseAudio(blobUrl, trimmed);
  usePlaybackAudioStore.getState().setSupabaseSource(trimmed);
  usePlaybackAudioStore.getState().setEphemeralBlobUrl(blobUrl);
  return blobUrl;
}

/** キャッシュに音源があるか（ネットワーク不要） */
export async function hasSupabaseAudioInCache(path: string): Promise<boolean> {
  const cached = await getCachedAudioBlob(
    waveMediaCacheKeyForSupabase(path.trim())
  );
  return Boolean(cached?.blob.size);
}

export function getKnownSupabaseAudioPath(): string | null {
  const fromStore = usePlaybackAudioStore.getState().source;
  if (fromStore?.kind === "supabase") return fromStore.path;
  return persistedSupabaseAudioPath?.trim() || null;
}
