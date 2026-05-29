/** 保持中の blob: URL が revoke 済みでないか確認する */
export async function verifyBlobUrl(url: string): Promise<boolean> {
  if (!url.startsWith("blob:")) return true;
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}
