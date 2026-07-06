import { verifyBlobUrl } from "../verifyBlobUrl";

/** 再利用候補の blob URL を検証し、無効なら復旧処理へ委譲する */
export async function resolveVerifiedReuseUrl(
  reuseUrl: string | null,
  onInvalid: () => Promise<string | null>
): Promise<string | null> {
  if (!reuseUrl) return null;
  const valid = await verifyBlobUrl(reuseUrl);
  if (valid) return reuseUrl;
  return onInvalid();
}
