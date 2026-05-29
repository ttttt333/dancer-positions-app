/** iOS Safari 等: webkitAudioContext フォールバック付き AudioContext 生成 */
export function createAudioContext(): AudioContext {
  if (typeof window === "undefined") {
    throw new Error("AudioContext はブラウザ環境でのみ利用できます");
  }
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) {
    throw new Error("このブラウザは AudioContext に対応していません");
  }
  return new AC();
}

/** decodeAudioData（コピー渡し・iOS 向け resume） */
export async function decodeArrayBufferToAudioBuffer(
  buf: ArrayBuffer
): Promise<AudioBuffer> {
  if (!buf.byteLength) {
    throw new Error("音声データが空です");
  }
  const ctx = createAudioContext();
  try {
    await ctx.resume().catch(() => {});
    return await ctx.decodeAudioData(buf.slice(0));
  } finally {
    await ctx.close().catch(() => {});
  }
}
