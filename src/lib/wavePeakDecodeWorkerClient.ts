import { decodeArrayBufferToAudioBuffer } from "./audioContext";
import {
  computeWavePeaksFromAudioBuffer,
  computeWavePeaksFromChannelData,
  mixDownAudioBufferForPeaks,
  resolveWavePeakBinCount,
} from "./computeWavePeaksFromChannelData";

type DecodeResult = { peaks: number[]; durationSec: number };

type PendingJob = {
  resolve: (value: DecodeResult) => void;
  reject: (reason?: unknown) => void;
  fallback: () => DecodeResult;
};

let worker: Worker | null = null;
let nextJobId = 0;
const pending = new Map<number, PendingJob>();

/** Worker はピーク計算のみ（AudioContext はメインスレッド） */
function getPeakWorker(): Worker | null {
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
    worker.onerror = () => {
      for (const job of pending.values()) {
        try {
          job.resolve(job.fallback());
        } catch (err) {
          job.reject(err);
        }
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

function computePeaksViaWorker(
  channelData: Float32Array,
  durationSec: number
): Promise<DecodeResult> {
  const w = getPeakWorker();
  if (!w) {
    return Promise.resolve({
      peaks: computeWavePeaksFromChannelData(
        channelData,
        resolveWavePeakBinCount(durationSec)
      ),
      durationSec,
    });
  }

  return new Promise<DecodeResult>((resolve, reject) => {
    const id = ++nextJobId;
    const fallback = (): DecodeResult => ({
      peaks: computeWavePeaksFromChannelData(
        channelData,
        resolveWavePeakBinCount(durationSec)
      ),
      durationSec,
    });
    pending.set(id, { resolve, reject, fallback });
    const copy = new Float32Array(channelData);
    try {
      w.postMessage({ id, channelData: copy, durationSec }, [copy.buffer]);
    } catch {
      pending.delete(id);
      resolve({
        peaks: computeWavePeaksFromChannelData(
          channelData,
          resolveWavePeakBinCount(durationSec)
        ),
        durationSec,
      });
    }
  });
}

/** 音声バッファをデコードして波形ピークを返す（iOS 対応・Worker はピーク計算のみ） */
export async function decodeWavePeaksFromBuffer(
  buf: ArrayBuffer
): Promise<DecodeResult> {
  const audioBuf = await decodeArrayBufferToAudioBuffer(buf);
  const channelData = mixDownAudioBufferForPeaks(audioBuf);
  const durationSec = audioBuf.duration;

  /** サンプル数閾値（約45秒@44.1kHz）。CLIENT_DECODE_TIMEOUT_MS とは無関係 */
  if (channelData.length > 44100 * 45) {
    try {
      return await computePeaksViaWorker(channelData, durationSec);
    } catch {
      /* Worker 失敗時はメインスレッドへ */
    }
  }

  return {
    peaks: computeWavePeaksFromAudioBuffer(audioBuf),
    durationSec,
  };
}
