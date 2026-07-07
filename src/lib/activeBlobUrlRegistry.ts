/** このセッションで createObjectURL した blob URL。reload 後の失効 URL への fetch を避ける */
const activeBlobUrls = new Set<string>();

export function registerActiveBlobUrl(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) activeBlobUrls.add(url);
}

export function unregisterActiveBlobUrl(url: string | null | undefined): void {
  if (url) activeBlobUrls.delete(url);
}

export function isRegisteredActiveBlobUrl(url: string): boolean {
  return url.startsWith("blob:") && activeBlobUrls.has(url);
}
