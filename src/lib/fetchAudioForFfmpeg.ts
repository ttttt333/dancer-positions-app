import { fetchFile } from "@ffmpeg/util";
import { readResponseArrayBufferWithProgress } from "./fetchWithProgress";

function isBlobOrDataUrl(url: string): boolean {
  return url.startsWith("blob:") || url.startsWith("data:");
}

function isSameOriginUrl(url: string): boolean {
  if (isBlobOrDataUrl(url)) return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

async function fetchUrlBytes(
  audioUrl: string,
  onProgress?: (ratio: number) => void
): Promise<Uint8Array> {
  const res = await fetch(audioUrl, {
    mode: isSameOriginUrl(audioUrl) ? "same-origin" : "cors",
    credentials: isSameOriginUrl(audioUrl) ? "same-origin" : "include",
  });
  if (!res.ok) {
    throw new Error(`音源の取得に失敗しました（HTTP ${res.status}）`);
  }
  const buf = await readResponseArrayBufferWithProgress(res, onProgress);
  return new Uint8Array(buf);
}

/**
 * 音源 URL を FFmpeg.wasm の仮想 FS 用バイナリにする。
 * 失敗時は null（COEP 等）。呼び出し側は映像のみ書き出しにフォールバックする。
 */
export async function fetchAudioForFfmpeg(
  audioUrl: string,
  onProgress?: (ratio: number) => void
): Promise<Uint8Array | null> {
  try {
    onProgress?.(0);
    if (isBlobOrDataUrl(audioUrl) || isSameOriginUrl(audioUrl)) {
      try {
        const data = await fetchFile(audioUrl);
        onProgress?.(1);
        return data;
      } catch {
        const data = await fetchUrlBytes(audioUrl, onProgress);
        onProgress?.(1);
        return data;
      }
    }

    const data = await fetchUrlBytes(audioUrl, onProgress);
    onProgress?.(1);
    return data;
  } catch (e) {
    console.warn("[fetchAudioForFfmpeg] 音源取得をスキップ:", e);
    return null;
  }
}
