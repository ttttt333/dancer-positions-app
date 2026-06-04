import { materializeSupabasePlaybackUrl } from "./audioPlaybackCache";
import {
  persistedSupabaseAudioPath,
  revokeEphemeralSupabaseBlobUrl,
} from "./timelineAudioBlobPersist";
import { verifyBlobUrl } from "./verifyBlobUrl";

export type PlaybackAudioRestoreContext = {
  audioSupabasePath?: string | null;
  audioAssetId?: number | null;
  flowLocalAudioKey?: string | null;
};

/** Supabase 音源パスから Cache API 経由で短命 blob URL を新規生成 */
export async function rebuildSupabasePlaybackBlob(
  path: string,
  onProgress?: (ratio: number) => void
): Promise<string | null> {
  return materializeSupabasePlaybackUrl(path, onProgress);
}

/**
 * blob URL 失効後: Cache API → Supabase から再生 URL を再マテリアライズ。
 */
export async function restorePlaybackBlobUrl(
  ctx: PlaybackAudioRestoreContext,
  onProgress?: (ratio: number) => void
): Promise<string | null> {
  const path =
    (typeof ctx.audioSupabasePath === "string" &&
    ctx.audioSupabasePath.trim().length > 0
      ? ctx.audioSupabasePath.trim()
      : null) ?? persistedSupabaseAudioPath?.trim() ?? null;

  if (path) {
    return materializeSupabasePlaybackUrl(path, onProgress);
  }
  return null;
}

/** blob URL が生きているか（失効時は false） */
export async function isPlaybackBlobAlive(
  url: string | null | undefined
): Promise<boolean> {
  if (!url || typeof url !== "string") return false;
  if (!url.startsWith("blob:")) return true;
  return verifyBlobUrl(url);
}

/** 失効した blob だけ破棄（Supabase パス / Cache は保持） */
export function discardDeadEphemeralBlob(url: string | null | undefined): void {
  if (!url?.startsWith("blob:")) return;
  void verifyBlobUrl(url).then((alive) => {
    if (!alive) revokeEphemeralSupabaseBlobUrl();
  });
}
