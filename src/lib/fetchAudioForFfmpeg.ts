import { fetchFile } from "@ffmpeg/util";

function isSameOriginUrl(url: string): boolean {
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * 音源 URL を FFmpeg.wasm の仮想 FS 用バイナリにする。
 * COEP 下は同一オリジン / blob のみ確実。クロスオリジンは CORP 不足で失敗しやすい。
 */
export async function fetchAudioForFfmpeg(audioUrl: string): Promise<Uint8Array> {
  if (isSameOriginUrl(audioUrl)) {
    try {
      return await fetchFile(audioUrl);
    } catch {
      const res = await fetch(audioUrl);
      if (!res.ok) {
        throw new Error(`音源の取得に失敗しました（HTTP ${res.status}）`);
      }
      return new Uint8Array(await res.arrayBuffer());
    }
  }

  try {
    return await fetchFile(audioUrl);
  } catch {
    try {
      const res = await fetch(audioUrl, { mode: "cors", credentials: "include" });
      if (!res.ok) {
        throw new Error(`音源の取得に失敗しました（HTTP ${res.status}）`);
      }
      return new Uint8Array(await res.arrayBuffer());
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
