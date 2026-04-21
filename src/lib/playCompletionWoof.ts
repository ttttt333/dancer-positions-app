/**
 * 処理完了のフィードバック用。短い「ワン」風の合成音（音声ファイルは使わない）。
 * ユーザー操作後のコンテキストでないと鳴らない環境では無音になる。
 */
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AC();
  }
  return sharedCtx;
}

export function playCompletionWoof(): void {
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().then(() => {
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.34;
    master.connect(ctx.destination);

    /** メインの「ワ」— 短く下がる三角波 */
    const o1 = ctx.createOscillator();
    o1.type = "triangle";
    const g1 = ctx.createGain();
    o1.connect(g1);
    g1.connect(master);
    o1.frequency.setValueAtTime(560, t0);
    o1.frequency.exponentialRampToValueAtTime(210, t0 + 0.058);
    g1.gain.setValueAtTime(0, t0);
    g1.gain.linearRampToValueAtTime(0.55, t0 + 0.012);
    g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    o1.start(t0);
    o1.stop(t0 + 0.11);

    /** 軽い「ン」寄りの尾 — 正弦で短く */
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(master);
    o2.frequency.setValueAtTime(340, t0 + 0.038);
    o2.frequency.exponentialRampToValueAtTime(160, t0 + 0.095);
    g2.gain.setValueAtTime(0, t0 + 0.035);
    g2.gain.linearRampToValueAtTime(0.2, t0 + 0.045);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    o2.start(t0 + 0.035);
    o2.stop(t0 + 0.13);
  }).catch(() => {});
}
