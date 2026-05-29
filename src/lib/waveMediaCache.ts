/** 音源バイナリと波形 JSON を Cache API に永続化（IndexedDB ピークと併用） */

const AUDIO_CACHE = "choreocore-audio-v1";
const PEAKS_CACHE = "choreocore-peaks-v1";

async function openNamedCache(name: string): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(name);
  } catch {
    return null;
  }
}

export function waveMediaCacheKeyForServerAsset(assetId: number): string {
  return `/media/audio/server/${assetId}`;
}

export function waveMediaCacheKeyForSupabase(path: string): string {
  return `/media/audio/supabase/${encodeURIComponent(path.trim())}`;
}

export function wavePeaksMediaCacheKey(cacheKey: string): string {
  return `/media/peaks/${encodeURIComponent(cacheKey)}`;
}

export async function getCachedAudioBlob(
  cacheKey: string
): Promise<{ blob: Blob; mime: string } | null> {
  const cache = await openNamedCache(AUDIO_CACHE);
  if (!cache) return null;
  const res = await cache.match(cacheKey);
  if (!res) return null;
  const blob = await res.blob();
  if (!blob.size) return null;
  const mime = res.headers.get("content-type") || blob.type || "audio/mpeg";
  return { blob, mime };
}

export async function putCachedAudioBlob(
  cacheKey: string,
  blob: Blob,
  mime?: string
): Promise<void> {
  if (!blob.size) return;
  const cache = await openNamedCache(AUDIO_CACHE);
  if (!cache) return;
  const type = mime || blob.type || "audio/mpeg";
  try {
    await cache.put(
      cacheKey,
      new Response(blob, {
        headers: { "Content-Type": type },
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export type CachedPeaksPayload = {
  peaks: number[];
  durationSec: number;
};

export async function getCachedPeaksPayload(
  cacheKey: string
): Promise<CachedPeaksPayload | null> {
  const cache = await openNamedCache(PEAKS_CACHE);
  if (!cache) return null;
  const url = wavePeaksMediaCacheKey(cacheKey);
  const res = await cache.match(url);
  if (!res) return null;
  try {
    const data = (await res.json()) as CachedPeaksPayload;
    if (!Array.isArray(data.peaks) || data.peaks.length === 0) return null;
    if (!Number.isFinite(data.durationSec)) return null;
    return { peaks: data.peaks, durationSec: data.durationSec };
  } catch {
    return null;
  }
}

export async function putCachedPeaksPayload(
  cacheKey: string,
  peaks: number[],
  durationSec: number
): Promise<void> {
  if (!peaks.length) return;
  const cache = await openNamedCache(PEAKS_CACHE);
  if (!cache) return;
  const url = wavePeaksMediaCacheKey(cacheKey);
  const body = JSON.stringify({ peaks, durationSec });
  try {
    await cache.put(
      url,
      new Response(body, {
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch {
    /* quota / private mode */
  }
}
