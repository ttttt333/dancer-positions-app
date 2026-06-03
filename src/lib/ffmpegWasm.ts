/** FFmpeg.wasm の共有ローダー（動画抽出・ステージ動画書き出しで共用） */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  ffmpegCoreAssetUrl,
} from "./ffmpegCoreUrls";
import { readResponseArrayBufferWithProgress } from "./fetchWithProgress";

export type FfmpegWasmProgress = {
  ratio: number;
  message: string;
};

const FFMPEG_LOAD_TIMEOUT_MS = 180_000;

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
  if (/タイムアウト|timeout/i.test(detail)) {
    return new Error(
      `${step}: ${detail} メモリ不足の可能性があります。タブを閉じて再試行するか、短い尺で書き出してください。`
    );
  }
  return new Error(`${step}: ${detail}`);
}

/** 同一オリジン取得 → Blob URL（Worker 内 import で COEP を回避） */
async function prefetchAsBlobUrl(
  url: string,
  mime: string,
  onProgress: (ratio: number) => void
): Promise<string> {
  onProgress(0);
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = await readResponseArrayBufferWithProgress(res, onProgress);
  onProgress(1);
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

async function instantiateFFmpeg(): Promise<FFmpeg> {
  emitLoadProgress({ ratio: 0, message: "FFmpeg コア (JS) を取得中…" });
  const coreBlobUrl = await prefetchAsBlobUrl(
    ffmpegCoreAssetUrl("ffmpeg-core.js"),
    "text/javascript",
    (r) => {
      emitLoadProgress({
        ratio: r * 0.1,
        message: "FFmpeg コア (JS) を取得中…",
      });
    }
  );

  emitLoadProgress({
    ratio: 0.1,
    message: "FFmpeg コア (WASM) を取得中…（初回は 20〜40 秒）",
  });
  const wasmBlobUrl = await prefetchAsBlobUrl(
    ffmpegCoreAssetUrl("ffmpeg-core.wasm"),
    "application/wasm",
    (r) => {
      emitLoadProgress({
        ratio: 0.1 + r * 0.55,
        message: "FFmpeg コア (WASM) を取得中…（初回は 20〜40 秒）",
      });
    }
  );

  emitLoadProgress({
    ratio: 0.68,
    message: "FFmpeg を起動中…（30秒〜2分かかることがあります）",
  });

  const ff = new FFmpeg();
  const loadStarted = Date.now();
  const bootTimer = window.setInterval(() => {
    const elapsed = Date.now() - loadStarted;
    const simulated = 0.68 + Math.min(0.28, (elapsed / FFMPEG_LOAD_TIMEOUT_MS) * 0.28);
    emitLoadProgress({
      ratio: simulated,
      message:
        elapsed > 45_000
          ? "FFmpeg を起動中…（まだ処理中です。しばらくお待ちください）"
          : "FFmpeg を起動中…（30秒〜2分かかることがあります）",
    });
  }, 1200);

  try {
    await Promise.race([
      ff.load({
        classWorkerURL: ffmpegCoreAssetUrl("ffmpeg-class-worker.js"),
        coreURL: coreBlobUrl,
        wasmURL: wasmBlobUrl,
      }),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              `FFmpeg 起動が ${Math.round(FFMPEG_LOAD_TIMEOUT_MS / 1000)} 秒でタイムアウトしました`
            )
          );
        }, FFMPEG_LOAD_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    try {
      ff.terminate();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    window.clearInterval(bootTimer);
  }

  ffmpegSingleton = ff;
  emitLoadProgress({ ratio: 1, message: "FFmpeg 準備完了" });
  return ff;
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
    ffmpegLoadPromise = instantiateFFmpeg();
  }

  try {
    return await ffmpegLoadPromise;
  } catch (e) {
    ffmpegLoadPromise = null;
    const dead = ffmpegSingleton;
    ffmpegSingleton = null;
    try {
      dead?.terminate();
    } catch {
      /* ignore */
    }
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

export function resetFFmpegWasm(): void {
  try {
    ffmpegSingleton?.terminate();
  } catch {
    /* ignore */
  }
  ffmpegSingleton = null;
  ffmpegLoadPromise = null;
}
