/** 縦画面波形用: 音源から高解像度ピーク配列を生成 */

export const PORTRAIT_WAVE_PEAK_BINS = 4096;

const FALLBACK_LEN = 128;

function fallbackPeaks(): number[] {
  const raw = [
    20, 35, 15, 45, 30, 50, 25, 40, 18, 42, 32, 48, 22, 38, 28, 52,
    20, 36, 24, 44, 30, 46, 18, 40, 26, 48, 22, 34, 28, 50, 20, 38,
    24, 42, 30, 46, 18, 36, 26, 44, 22, 48, 20, 40, 28, 50, 24, 38,
  ];
  const out: number[] = [];
  for (let i = 0; i < PORTRAIT_WAVE_PEAK_BINS; i++) {
    out.push(raw[i % raw.length]!);
  }
  return out;
}

export async function computePortraitWavePeaks(url: string): Promise<number[]> {
  const res = await fetch(url, { mode: "cors" });
  const buf = await res.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(buf);
  ctx.close();

  const ch = decoded.getChannelData(0);
  const bins = PORTRAIT_WAVE_PEAK_BINS;
  const blockSize = Math.max(1, Math.floor(ch.length / bins));
  const peaks: number[] = [];
  for (let i = 0; i < bins; i++) {
    let sum = 0;
    const start = i * blockSize;
    const end = Math.min(ch.length, start + blockSize);
    for (let j = start; j < end; j++) {
      sum += ch[j]! ** 2;
    }
    peaks.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  const max = Math.max(...peaks, 0.001);
  return peaks.map((p) => p / max);
}

export function getFallbackPortraitWavePeaks(): number[] {
  return fallbackPeaks();
}

/** 表示範囲のピークを width ピクセル分のバー幅で描画用に間引き */
export function slicePeaksForView(
  peaks: number[],
  viewStartSec: number,
  viewDurationSec: number,
  totalDurationSec: number,
  pixelWidth: number
): number[] {
  if (peaks.length === 0 || pixelWidth <= 0 || totalDurationSec <= 0) return [];
  const startIdx = Math.floor((viewStartSec / totalDurationSec) * peaks.length);
  const endIdx = Math.ceil(((viewStartSec + viewDurationSec) / totalDurationSec) * peaks.length);
  const span = Math.max(1, endIdx - startIdx);
  const out: number[] = [];
  for (let px = 0; px < pixelWidth; px++) {
    const rel = px / Math.max(1, pixelWidth - 1);
    const idx = startIdx + Math.floor(rel * (span - 1));
    out.push(peaks[Math.min(peaks.length - 1, Math.max(0, idx))] ?? 0);
  }
  return out;
}

export { FALLBACK_LEN };
