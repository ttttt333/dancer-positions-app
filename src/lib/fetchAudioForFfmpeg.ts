import { fetchFile } from "@ffmpeg/util";

/**
 * 音源 URL を FFmpeg.wasm の仮想 FS 用バイナリにする。
 * CORS 失敗時は分かりやすいエラーにする。
 */
export async function fetchAudioForFfmpeg(audioUrl: string): Promise<Uint8Array> {
  try {
    return await fetchFile(audioUrl);
  } catch {
    try {
      const res = await fetch(audioUrl, { mode: "cors", credentials: "include" });
      if (!res.ok) {
        throw new Error(`音源の取得に失敗しました（HTTP ${res.status}）`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "音源の取得に失敗しました";
      throw new Error(
        `${msg}。別タブで開き直すか、音源を再取り込みしてからお試しください。`
      );
    }
  }
}
