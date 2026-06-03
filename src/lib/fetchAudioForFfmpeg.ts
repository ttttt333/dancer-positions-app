import { fetchFile } from "@ffmpeg/util";
import { readResponseArrayBufferWithProgress } from "./fetchWithProgress";

function isSameOriginUrl(url: string): boolean {
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
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
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`音源の取得に失敗しました（HTTP ${res.status}）`);
  }
  const buf = await readResponseArrayBufferWithProgress(res, onProgress);
  return new Uint8Array(buf);
}

/**
 * 音源 URL を FFmpeg.wasm の仮想 FS 用バイナリにする。
 * COEP 下は同一オリジン / blob のみ確実。クロスオリジンは CORP 不足で失敗しやすい。
 */
export async function fetchAudioForFfmpeg(
  audioUrl: string,
  onProgress?: (ratio: number) => void
): Promise<Uint8Array> {
  if (isSameOriginUrl(audioUrl)) {
    try {
      onProgress?.(0);
      const data = await fetchFile(audioUrl);
      onProgress?.(1);
      return data;
    } catch {
      return fetchUrlBytes(audioUrl, onProgress);
    }
  }

  try {
    onProgress?.(0);
    const data = await fetchFile(audioUrl);
    onProgress?.(1);
    return data;
  } catch {
    try {
      return await fetchUrlBytes(audioUrl, onProgress);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "音源の取得に失敗しました";
      const coep =
        /NotSameOriginAfterDefaultedToSameOriginByCoep|COEP|blocked/i.test(msg);
      throw new Error(
        coep
          ? `${msg}（音源はこのサイトと同じドメインで配信する必要があります）`
          : `${msg}。別タブで開き直すか、音源を再取り込みしてからお試しください。`
      );
    }
  }
}
