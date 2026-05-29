/** レスポンス本文を ArrayBuffer として取得し、Content-Length があれば進捗を報告 */
export async function readResponseArrayBufferWithProgress(
  res: Response,
  onProgress?: (ratio: number) => void
): Promise<ArrayBuffer> {
  const total = Number(res.headers.get("Content-Length") || 0);
  if (!res.body || total <= 0 || !onProgress) {
    onProgress?.(1);
    return res.arrayBuffer();
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress(Math.min(0.98, received / total));
    }
  }
  onProgress(1);
  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out.buffer;
}
