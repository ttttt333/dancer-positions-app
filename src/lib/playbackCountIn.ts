/**
 * 練習用カウントイン（5・6・7・8 相当の 4 拍ビープ）。
 * Web Audio オシレータのみ（音声ファイル不要）。
 */

let activeAbort: AbortController | null = null;

export function cancelPlaybackCountIn(): void {
  activeAbort?.abort();
  activeAbort = null;
}

export function isPlaybackCountInActive(): boolean {
  return activeAbort != null && !activeAbort.signal.aborted;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  return new AC();
}

function scheduleBeep(
  ctx: AudioContext,
  when: number,
  freqHz: number,
  durSec: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freqHz, when);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.22, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, when + durSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + durSec + 0.02);
}

/**
 * BPM に合わせた 4 拍カウントインを再生する。
 * 完了時 `'completed'`、中断時 `'aborted'`。
 */
export async function runPlaybackCountIn(opts: {
  bpm: number;
  /** 拍数（既定 4 = 5,6,7,8） */
  beats?: number;
  signal?: AbortSignal;
}): Promise<"completed" | "aborted"> {
  cancelPlaybackCountIn();
  const local = new AbortController();
  activeAbort = local;

  const external = opts.signal;
  const onExternalAbort = () => local.abort();
  external?.addEventListener("abort", onExternalAbort);

  const bpm = Number.isFinite(opts.bpm) && opts.bpm > 0 ? opts.bpm : 120;
  const beats = Math.max(1, Math.min(8, Math.floor(opts.beats ?? 4)));
  const interval = 60 / bpm;

  const ctx = getAudioContext();
  if (!ctx) {
    external?.removeEventListener("abort", onExternalAbort);
    if (activeAbort === local) activeAbort = null;
    return local.signal.aborted ? "aborted" : "completed";
  }

  try {
    await ctx.resume();
    if (local.signal.aborted) return "aborted";

    const t0 = ctx.currentTime + 0.04;
    for (let i = 0; i < beats; i += 1) {
      const when = t0 + i * interval;
      const isLast = i === beats - 1;
      scheduleBeep(ctx, when, isLast ? 1320 : 880, isLast ? 0.12 : 0.08);
    }

    const waitMs = (beats * interval + 0.08) * 1000;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => resolve(), waitMs);
      local.signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    });

    return local.signal.aborted ? "aborted" : "completed";
  } catch {
    return "aborted";
  } finally {
    external?.removeEventListener("abort", onExternalAbort);
    try {
      void ctx.close();
    } catch {
      /* ignore */
    }
    if (activeAbort === local) activeAbort = null;
  }
}

/** テスト用: 間隔秒を返す */
export function countInIntervalSec(bpm: number): number {
  const b = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
  return 60 / b;
}
