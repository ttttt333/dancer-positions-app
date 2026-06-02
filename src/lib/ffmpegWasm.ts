/** FFmpeg.wasm の共有ローダー（動画抽出・ステージ動画書き出しで共用） */

export type FfmpegWasmProgress = {
  ratio: number;
  message: string;
};

type FFmpegInstance = {
  loaded: boolean;
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<void>;
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array | string>;
  deleteFile: (name: string) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
};

let ffmpegSingleton: FFmpegInstance | null = null;
let ffmpegLoadPromise: Promise<FFmpegInstance> | null = null;

const FFMPEG_CORE_CDN =
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

export async function loadFFmpegWasm(
  onProgress?: (p: FfmpegWasmProgress) => void
): Promise<FFmpegInstance> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;
  ffmpegLoadPromise = (async () => {
    onProgress?.({ ratio: 0, message: "FFmpeg を準備中…" });
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);
    const ff = new FFmpeg() as unknown as FFmpegInstance;
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${FFMPEG_CORE_CDN}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${FFMPEG_CORE_CDN}/ffmpeg-core.wasm`, "application/wasm"),
    ]);
    await ff.load({ coreURL, wasmURL });
    ffmpegSingleton = ff;
    onProgress?.({ ratio: 1, message: "準備完了" });
    return ff;
  })();
  try {
    return await ffmpegLoadPromise;
  } catch (e) {
    ffmpegLoadPromise = null;
    ffmpegSingleton = null;
    throw e;
  }
}

export function preloadFFmpegWasm(): Promise<void> {
  if (ffmpegSingleton?.loaded || ffmpegLoadPromise) return Promise.resolve();
  return loadFFmpegWasm().then(() => undefined);
}
