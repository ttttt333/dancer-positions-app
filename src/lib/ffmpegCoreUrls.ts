/** COEP 下でも読める同一オリジンの FFmpeg.wasm コア URL */

function normalizeBase(base: string): string {
  if (!base || base === "/") return "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export function getFfmpegCoreBaseUrl(): string {
  return `${normalizeBase(import.meta.env.BASE_URL)}ffmpeg-core/`;
}

export function ffmpegCoreAssetUrl(
  file: "ffmpeg-core.js" | "ffmpeg-core.wasm"
): string {
  return `${getFfmpegCoreBaseUrl()}${file}`;
}
