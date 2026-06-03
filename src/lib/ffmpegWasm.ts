/** FFmpeg.wasm の共有ローダー（動画抽出・ステージ動画書き出しで共用） */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { ffmpegCoreAssetUrl } from "./ffmpegCoreUrls";

export type FfmpegWasmProgress = {
  ratio: number;
  message: string;
};

let ffmpegSingleton: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

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

export async function loadFFmpegWasm(
  onProgress?: (p: FfmpegWasmProgress) => void
): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) {
    onProgress?.({ ratio: 1, message: "準備完了" });
    return ffmpegSingleton;
  }
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  if (typeof window !== "undefined" && !window.crossOriginIsolated) {
    throw new Error(
      "FFmpeg を利用するには crossOriginIsolated が必要です（COOP/COEP ヘッダー）。管理者にご連絡ください。"
    );
  }

  ffmpegLoadPromise = (async () => {
    onProgress?.({ ratio: 0, message: "FFmpeg を準備中…" });
    const ff = new FFmpeg();
    /** 同一オリジン（public/ffmpeg-core）。CDN は COEP でブロックされる */
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(ffmpegCoreAssetUrl("ffmpeg-core.js"), "text/javascript"),
      toBlobURL(ffmpegCoreAssetUrl("ffmpeg-core.wasm"), "application/wasm"),
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
    throw wrapFfmpegError("FFmpeg の読み込み", e);
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
