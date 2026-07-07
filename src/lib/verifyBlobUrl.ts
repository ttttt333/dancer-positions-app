import {
  isRegisteredActiveBlobUrl,
  unregisterActiveBlobUrl,
} from "./activeBlobUrlRegistry";

/** 保持中の blob: URL が revoke 済みでないか確認する */
export async function verifyBlobUrl(url: string): Promise<boolean> {
  if (!url.startsWith("blob:")) return true;
  if (!isRegisteredActiveBlobUrl(url)) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      unregisterActiveBlobUrl(url);
      return false;
    }
    return true;
  } catch {
    unregisterActiveBlobUrl(url);
    return false;
  }
}
