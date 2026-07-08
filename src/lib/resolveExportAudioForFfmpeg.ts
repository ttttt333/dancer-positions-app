import { fetchAuthorizedAudio, getToken } from "../api/client";
import type { ChoreographyProjectJson } from "../types/choreography";
import { getFlowLibraryAudio } from "./flowLibraryLocalAudio";
import { fetchAudioForFfmpeg } from "./fetchAudioForFfmpeg";
import { isSupabaseBackend } from "./supabaseClient";
import { supabaseDownloadProjectAudioWithCache } from "./supabaseAudio";
import { resolvePlaybackAudioUrlForExport } from "./resolvePlaybackAudioUrlForExport";
import { verifyBlobUrl } from "./verifyBlobUrl";
import {
  getCachedAudioBlob,
  waveMediaCacheKeyForServerAsset,
  waveMediaCacheKeyForSupabase,
} from "./waveMediaCache";

export type ExportAudioFallback = Pick<
  ChoreographyProjectJson,
  "audioAssetId" | "audioSupabasePath" | "flowLocalAudioKey"
>;

async function bytesFromMediaCache(cacheKey: string): Promise<Uint8Array | null> {
  const cached = await getCachedAudioBlob(cacheKey);
  if (!cached?.blob.size) return null;
  return new Uint8Array(await cached.blob.arrayBuffer());
}

/**
 * 動画書き出し用の音源バイナリ。
 * 再生中 blob URL → Cache API → リモート再取得 → フロー保存、の順で試す。
 */
export async function resolveExportAudioBytesForFfmpeg(
  fallback: ExportAudioFallback,
  onProgress?: (ratio: number) => void
): Promise<Uint8Array | null> {
  const playbackUrl = resolvePlaybackAudioUrlForExport();
  if (playbackUrl) {
    const usable =
      !playbackUrl.startsWith("blob:") || (await verifyBlobUrl(playbackUrl));
    if (usable) {
      const fromUrl = await fetchAudioForFfmpeg(playbackUrl, (r) =>
        onProgress?.(r * 0.85)
      );
      if (fromUrl?.byteLength) return fromUrl;
    }
  }

  const aid = fallback.audioAssetId;
  const rawPath = fallback.audioSupabasePath;
  const path =
    typeof rawPath === "string" && rawPath.trim().length > 0
      ? rawPath.trim()
      : null;

  // Cache API は端末ローカルなので認証トークン不要。匿名の共有閲覧でも
  // 再生時にダウンロード済みの音源をここから読めるよう、トークン判定の外で試す。
  if (aid != null) {
    const fromCache = await bytesFromMediaCache(
      waveMediaCacheKeyForServerAsset(aid)
    );
    if (fromCache?.byteLength) {
      onProgress?.(1);
      return fromCache;
    }
  }
  if (path) {
    const fromCache = await bytesFromMediaCache(
      waveMediaCacheKeyForSupabase(path)
    );
    if (fromCache?.byteLength) {
      onProgress?.(1);
      return fromCache;
    }
  }

  // リモート再取得は認証が要るためトークンがある場合のみ。
  if (aid != null && getToken()) {
    try {
      const { buffer } = await fetchAuthorizedAudio(aid, (r) =>
        onProgress?.(0.88 + r * 0.12)
      );
      if (buffer.byteLength) return new Uint8Array(buffer);
    } catch (e) {
      console.warn("[resolveExportAudioBytesForFfmpeg] server asset:", e);
    }
  }

  if (path && isSupabaseBackend() && getToken()) {
    try {
      const { buffer } = await supabaseDownloadProjectAudioWithCache(path, (r) =>
        onProgress?.(0.88 + r * 0.12)
      );
      if (buffer.byteLength) return new Uint8Array(buffer);
    } catch (e) {
      console.warn("[resolveExportAudioBytesForFfmpeg] supabase:", e);
    }
  }

  const flowKey = fallback.flowLocalAudioKey;
  if (typeof flowKey === "string" && flowKey.length > 0) {
    try {
      const blob = await getFlowLibraryAudio(flowKey);
      if (blob?.size) {
        onProgress?.(1);
        return new Uint8Array(await blob.arrayBuffer());
      }
    } catch (e) {
      console.warn("[resolveExportAudioBytesForFfmpeg] flow:", e);
    }
  }

  return null;
}
