/** COEP 下でも読める同一オリジンの FFmpeg.wasm コア URL */

export type FfmpegCoreAsset =
  | "ffmpeg-core.js"
  | "ffmpeg-core.wasm"
  | "ffmpeg-class-worker.js"
  | "const.js"
  | "errors.js";

function normalizeBase(base: string): string {
  if (!base || base === "/") return "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export function getFfmpegCoreBaseUrl(): string {
  return `${normalizeBase(import.meta.env.BASE_URL)}ffmpeg-core/`;
}

export function ffmpegCoreAssetUrl(file: FfmpegCoreAsset): string {
  return `${getFfmpegCoreBaseUrl()}${file}`;
}

/** Worker 生成用の絶対 URL */
export function ffmpegCoreAbsoluteUrl(file: FfmpegCoreAsset): string {
  if (typeof window === "undefined") {
    return ffmpegCoreAssetUrl(file);
  }
  return new URL(ffmpegCoreAssetUrl(file), window.location.href).href;
}
