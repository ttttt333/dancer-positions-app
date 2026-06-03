/** FFmpeg.wasm の共有ローダー（動画抽出・ステージ動画書き出しで共用） */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { ffmpegCoreAssetUrl } from "./ffmpegCoreUrls";
import { readResponseArrayBufferWithProgress } from "./fetchWithProgress";

export type FfmpegWasmProgress = {
  ratio: number;
  message: string;
};

let ffmpegSingleton: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;
const loadProgressListeners = new Set<(p: FfmpegWasmProgress) => void>();

function emitLoadProgress(p: FfmpegWasmProgress): void {
  for (const listener of loadProgressListeners) {
    listener(p);
  }
}

function wrapFfmpegError(step: string, cause: unknown): Error {
  const detail =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "不明なエラー";
  if (
    /sharedarraybuffer|crossOriginIsolated|COOP|COEP|NotSameOriginAfterDefaultedToSameOriginByCoep/i.test(
      detail
    )
  ) {
    return new Error(
      `${step}: ブラウザのセキュリティ設定（COOP/COEP）により FFmpeg を起動できません。ページを再読み込みしてください。`
    );
  }
  return new Error(`${step}: ${detail}`);
}

async function fetchAsBlobUrl(
  url: string,
  mime: string,
  onProgress: (ratio: number) => void
): Promise<string> {
  onProgress(0);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = await readResponseArrayBufferWithProgress(res, onProgress);
  const blob = new Blob([buf], { type: mime });
  return URL.createObjectURL(blob);
}

export async function loadFFmpegWasm(
  onProgress?: (p: FfmpegWasmProgress) => void
): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) {
    onProgress?.({ ratio: 1, message: "FFmpeg 準備完了" });
    return ffmpegSingleton;
  }

  if (onProgress) {
    loadProgressListeners.add(onProgress);
  }

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      emitLoadProgress({ ratio: 0, message: "FFmpeg コア (JS) を取得中…" });
      const ff = new FFmpeg();
      const coreURL = await fetchAsBlobUrl(
        ffmpegCoreAssetUrl("ffmpeg-core.js"),
        "text/javascript",
        (r) => {
          emitLoadProgress({
            ratio: r * 0.12,
            message: "FFmpeg コア (JS) を取得中…",
          });
        }
      );

      emitLoadProgress({
        ratio: 0.12,
        message: "FFmpeg コア (WASM) を取得中…（初回は 20〜40 秒）",
      });
      const wasmURL = await fetchAsBlobUrl(
        ffmpegCoreAssetUrl("ffmpeg-core.wasm"),
        "application/wasm",
        (r) => {
          emitLoadProgress({
            ratio: 0.12 + r * 0.78,
            message: "FFmpeg コア (WASM) を取得中…（初回は 20〜40 秒）",
          });
        }
      );

      emitLoadProgress({ ratio: 0.92, message: "FFmpeg を起動中…" });
      await ff.load({ coreURL, wasmURL });
      ffmpegSingleton = ff;
      emitLoadProgress({ ratio: 1, message: "FFmpeg 準備完了" });
      return ff;
    })();
  }

  try {
    return await ffmpegLoadPromise;
  } catch (e) {
    ffmpegLoadPromise = null;
    ffmpegSingleton = null;
    throw wrapFfmpegError("FFmpeg の読み込み", e);
  } finally {
    if (onProgress) {
      loadProgressListeners.delete(onProgress);
    }
  }
}

/** exec 失敗時にログ末尾を含めて throw */
export async function ffmpegExecChecked(
  ffmpeg: FFmpeg,
  args: string[]
): Promise<void> {
  const logs: string[] = [];
  const onLog = ({ message }: { message: string }) => {
    logs.push(message);
  };
  ffmpeg.on("log", onLog);
  try {
    const code = await ffmpeg.exec(args);
    if (code !== 0) {
      const tail = logs.slice(-6).join("\n").trim();
      throw new Error(
        tail
          ? `FFmpeg が終了コード ${code} で失敗しました: ${tail}`
          : `FFmpeg が終了コード ${code} で失敗しました`
      );
    }
  } catch (e) {
    const tail = logs.slice(-6).join("\n").trim();
    if (e instanceof Error && /終了コード/.test(e.message)) {
      throw e;
    }
    throw new Error(
      tail
        ? `FFmpeg 変換エラー: ${tail}`
        : e instanceof Error
          ? e.message
          : "FFmpeg 変換に失敗しました"
    );
  } finally {
    ffmpeg.off("log", onLog);
  }
}

export function preloadFFmpegWasm(): Promise<void> {
  if (ffmpegSingleton?.loaded || ffmpegLoadPromise) {
    return Promise.resolve();
  }
  return loadFFmpegWasm()
    .then(() => undefined)
    .catch(() => undefined);
}
