import { computeWavePeaksFromAudioBuffer } from "./computeWavePeaksFromChannelData";

type DecodeResult = { peaks: number[]; durationSec: number };

type PendingJob = {
  resolve: (value: DecodeResult) => void;
  reject: (reason?: unknown) => void;
};

let worker: Worker | null = null;
let nextJobId = 0;
const pending = new Map<number, PendingJob>();

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(
      new URL("../workers/wavePeakDecodeWorker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { id: number; peaks: number[]; durationSec: number }
        | { id: number; error: string };
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if ("error" in data) {
        job.reject(new Error(data.error));
        return;
      }
      job.resolve({ peaks: data.peaks, durationSec: data.durationSec });
    };
    worker.onerror = (err) => {
      for (const job of pending.values()) {
        job.reject(err.error ?? new Error("wave decode worker failed"));
      }
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

async function decodeOnMainThread(buf: ArrayBuffer): Promise<DecodeResult> {
  const ctx = new AudioContext();
  let audioBuf: AudioBuffer;
  try {
    audioBuf = await ctx.decodeAudioData(buf.slice(0));
  } catch (err) {
    await ctx.close().catch(() => {});
    throw err instanceof Error ? err : new Error("音声のデコードに失敗しました");
  }
  try {
    const peaks = computeWavePeaksFromAudioBuffer(audioBuf);
    return { peaks, durationSec: audioBuf.duration };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** 音声バッファを Worker（不可ならメインスレッド）でデコードしてピークを返す */
export async function decodeWavePeaksFromBuffer(
  buf: ArrayBuffer
): Promise<DecodeResult> {
  const w = getWorker();
  if (!w) return decodeOnMainThread(buf);

  return new Promise<DecodeResult>((resolve, reject) => {
    const id = ++nextJobId;
    pending.set(id, { resolve, reject });
    const decodeBuf = buf.slice(0);
    try {
      w.postMessage({ id, buffer: decodeBuf }, [decodeBuf]);
    } catch {
      pending.delete(id);
      decodeOnMainThread(buf).then(resolve).catch(reject);
    }
  });
}
