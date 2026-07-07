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

let sharedDecodeCtx: AudioContext | null = null;
let gestureUnlockInstalled = false;

function getSharedDecodeAudioContext(): AudioContext {
  if (!sharedDecodeCtx || sharedDecodeCtx.state === "closed") {
    sharedDecodeCtx = createAudioContext();
  }
  return sharedDecodeCtx;
}

/** 初回クリック／キー入力で AudioContext を解放（自動再生ポリシー対策） */
export function installAudioContextGestureUnlock(): void {
  if (gestureUnlockInstalled || typeof window === "undefined") return;
  gestureUnlockInstalled = true;
  const unlock = () => {
    void getSharedDecodeAudioContext().resume().catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export async function ensureAudioContextRunning(): Promise<AudioContext> {
  installAudioContextGestureUnlock();
  const ctx = getSharedDecodeAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {});
  }
  if (ctx.state === "suspended") {
    throw new Error(
      "音声の解析には画面を一度タップしてください（ブラウザの自動再生制限）"
    );
  }
  return ctx;
}

/** decodeAudioData（コピー渡し・共有コンテキストで resume） */
export async function decodeArrayBufferToAudioBuffer(
  buf: ArrayBuffer
): Promise<AudioBuffer> {
  if (!buf.byteLength) {
    throw new Error("音声データが空です");
  }
  const ctx = await ensureAudioContextRunning();
  return ctx.decodeAudioData(buf.slice(0));
}
