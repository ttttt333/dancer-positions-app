import { supabaseDownloadProjectAudioWithCache } from "./supabaseAudio";
import {
  setPersistedSupabaseAudio,
  persistedSupabaseAudioPath,
} from "./timelineAudioBlobPersist";
import { waveMediaCacheKeyForSupabase } from "./waveMediaCache";
import { verifyBlobUrl } from "./verifyBlobUrl";

export type PlaybackAudioRestoreContext = {
  audioSupabasePath?: string | null;
  audioAssetId?: number | null;
  flowLocalAudioKey?: string | null;
};

/** Supabase 音源パスから blob URL を再生成（Cache API → ネットワーク） */
export async function rebuildSupabasePlaybackBlob(
  path: string,
  onProgress?: (ratio: number) => void
): Promise<string | null> {
  const trimmed = path.trim();
  if (!trimmed) return null;
  try {
    const { buffer, mime } = await supabaseDownloadProjectAudioWithCache(
      trimmed,
      onProgress
    );
    const blobUrl = URL.createObjectURL(
      new Blob([buffer], { type: mime || "audio/mpeg" })
    );
    setPersistedSupabaseAudio(blobUrl, trimmed);
    return blobUrl;
  } catch (e) {
    console.warn("[restorePlaybackAudio] supabase rebuild failed:", e);
    return null;
  }
}

/**
 * 無効化された blob URL のあと、Supabase パスから再生用 URL を復元する。
 */
export async function restorePlaybackBlobUrl(
  ctx: PlaybackAudioRestoreContext,
  onProgress?: (ratio: number) => void
): Promise<string | null> {
  const path =
    (typeof ctx.audioSupabasePath === "string" &&
    ctx.audioSupabasePath.trim().length > 0
      ? ctx.audioSupabasePath.trim()
      : null) ??
    (persistedSupabaseAudioPath?.trim() || null);

  if (path) {
    return rebuildSupabasePlaybackBlob(path, onProgress);
  }
  return null;
}

/** blob URL が生きているか（失効時は false） */
export async function isPlaybackBlobAlive(url: string | null | undefined): Promise<boolean> {
  if (!url || typeof url !== "string") return false;
  if (!url.startsWith("blob:")) return true;
  return verifyBlobUrl(url);
}

export { waveMediaCacheKeyForSupabase };
