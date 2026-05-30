/// <reference lib="webworker" />
/**
 * Worker では AudioContext が使えない環境（iOS Safari 等）があるため、
 * デコード済み PCM のピーク計算のみ行う。
 */
import { computeWavePeaksFromChannelData, resolveWavePeakBinCount } from "../lib/computeWavePeaksFromChannelData";

declare const self: DedicatedWorkerGlobalScope;

type WorkerRequest = {
  id: number;
  channelData: Float32Array;
  durationSec: number;
};
type WorkerSuccess = { id: number; peaks: number[]; durationSec: number };
type WorkerFailure = { id: number; error: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, channelData, durationSec } = event.data;
  try {
    const peaks = computeWavePeaksFromChannelData(
      channelData,
      resolveWavePeakBinCount(durationSec)
    );
    const msg: WorkerSuccess = { id, peaks, durationSec };
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
