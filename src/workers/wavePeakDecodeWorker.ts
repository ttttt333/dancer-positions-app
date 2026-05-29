/// <reference lib="webworker" />
import { computeWavePeaksFromChannelData } from "../lib/computeWavePeaksFromChannelData";

declare const self: DedicatedWorkerGlobalScope;

type WorkerRequest = { id: number; buffer: ArrayBuffer };
type WorkerSuccess = { id: number; peaks: number[]; durationSec: number };
type WorkerFailure = { id: number; error: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, buffer } = event.data;
  try {
    const ctx = new AudioContext();
    let audioBuf: AudioBuffer;
    try {
      audioBuf = await ctx.decodeAudioData(buffer);
    } finally {
      await ctx.close().catch(() => {});
    }
    const peaks = computeWavePeaksFromChannelData(audioBuf.getChannelData(0));
    const msg: WorkerSuccess = {
      id,
      peaks,
      durationSec: audioBuf.duration,
    };
    self.postMessage(msg);
  } catch (err) {
    const msg: WorkerFailure = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(msg);
  }
};

export {};
