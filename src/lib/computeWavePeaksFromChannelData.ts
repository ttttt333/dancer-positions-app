/** タイムライン波形用のピーク本数（全長をこの数にダウンサンプル） */
export const WAVE_PEAK_BIN_COUNT = 400;

/** PCM チャンネルから正規化済みピーク配列を生成する */
export function computeWavePeaksFromChannelData(ch: Float32Array): number[] {
  const len = WAVE_PEAK_BIN_COUNT;
  const block = Math.floor(ch.length / len) || 1;
  const out = new Array<number>(len);
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
  for (let i = 0; i < len; i++) out[i]! /= max;
  return out;
}

export function computeWavePeaksFromAudioBuffer(audioBuf: AudioBuffer): number[] {
  return computeWavePeaksFromChannelData(audioBuf.getChannelData(0));
}
