/** @typedef {{ peaks: number[]; durationSec: number; binCount: number }} WavePeaksPayload */

export const WAVE_PEAK_BIN_COUNT = 400;

/**
 * @param {Float32Array | Float64Array | readonly number[]} ch
 * @returns {number[]}
 */
export function computeWavePeaksFromChannelData(ch) {
  const len = WAVE_PEAK_BIN_COUNT;
  const block = Math.floor(ch.length / len) || 1;
  const out = new Array(len);
  let max = 1e-6;
  for (let i = 0; i < len; i++) {
    let s = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      s += Math.abs(ch[start + j] ?? 0);
    }
    const v = s / block;
    out[i] = v;
    if (v > max) max = v;
  }
  for (let i = 0; i < len; i++) out[i] /= max;
  return out;
}

/**
 * @param {Buffer | Uint8Array | ArrayBuffer} input
 * @returns {Promise<WavePeaksPayload>}
 */
export async function computeWavePeaksFromBuffer(input) {
  const { default: decode } = await import("audio-decode");
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const audioBuf = await decode(buf);
  const ch = audioBuf.getChannelData(0);
  const peaks = computeWavePeaksFromChannelData(ch);
  const durationSec =
    typeof audioBuf.duration === "number" && Number.isFinite(audioBuf.duration)
      ? audioBuf.duration
      : audioBuf.length / (audioBuf.sampleRate || 44100);
  return { peaks, durationSec, binCount: WAVE_PEAK_BIN_COUNT };
}

/**
 * @param {string} filePath
 * @returns {Promise<WavePeaksPayload>}
 */
export async function computeWavePeaksFromFilePath(filePath) {
  const { readFile } = await import("fs/promises");
  const buf = await readFile(filePath);
  return computeWavePeaksFromBuffer(buf);
}
