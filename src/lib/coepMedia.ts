/** COOP/COEP 有効時（FFmpeg.wasm 用）に `<audio>` / `<video>` で安全な URL か */
export function isCrossOriginIsolatedPage(): boolean {
  return Boolean(
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated
  );
}

export function isCoepSafeMediaUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}
