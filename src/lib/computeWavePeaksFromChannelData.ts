/** 尺不明時のデフォルトピーク本数 */
export const WAVE_PEAK_BIN_COUNT = 8192;

/** 1 秒あたりのピーク本数（ズームイン時の細部表示向け） */
export const WAVE_PEAK_BINS_PER_SEC = 384;

export const WAVE_PEAK_BIN_MIN = 8192;
export const WAVE_PEAK_BIN_MAX = 32768;

/** 保存済みピークがこの解像度未満なら再生成を試みる */
export const WAVE_PEAK_STALE_RATIO = 0.75;

/** 曲尺からタイムライン用ピーク本数を決める */
export function resolveWavePeakBinCount(durationSec?: number | null): number {
  if (!durationSec || !Number.isFinite(durationSec) || durationSec <= 0) {
    return WAVE_PEAK_BIN_COUNT;
  }
  const scaled = Math.ceil(durationSec * WAVE_PEAK_BINS_PER_SEC);
  return Math.min(WAVE_PEAK_BIN_MAX, Math.max(WAVE_PEAK_BIN_MIN, scaled));
}

/** 旧キャッシュ（400 点等）が表示要件を満たさないか */
export function isWavePeaksResolutionStale(
  peaks: number[],
  durationSec?: number | null
): boolean {
  if (!peaks.length) return true;
  const target = resolveWavePeakBinCount(durationSec);
  return peaks.length < target * WAVE_PEAK_STALE_RATIO;
}

/** ステレオ等をミックスダウンしてピーク計算用のモノラル PCM を返す */
export function mixDownAudioBufferForPeaks(audioBuf: AudioBuffer): Float32Array {
  const len = audioBuf.length;
  const nCh = audioBuf.numberOfChannels;
  if (nCh <= 1) return audioBuf.getChannelData(0);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (let c = 0; c < nCh; c++) {
      sum += audioBuf.getChannelData(c)[i] ?? 0;
    }
    out[i] = sum / nCh;
  }
  return out;
}

/** PCM チャンネルから正規化済みピーク配列を生成する（各ビンは最大振幅） */
export function computeWavePeaksFromChannelData(
  ch: Float32Array,
  binCount?: number
): number[] {
  const len = Math.max(32, Math.min(WAVE_PEAK_BIN_MAX, binCount ?? WAVE_PEAK_BIN_COUNT));
  const out = new Array<number>(len);
  let max = 1e-6;
  for (let i = 0; i < len; i++) {
    const start = Math.floor((i / len) * ch.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / len) * ch.length));
    let peak = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(ch[j] ?? 0);
      if (abs > peak) peak = abs;
    }
    out[i] = peak;
    if (peak > max) max = peak;
  }
  for (let i = 0; i < len; i++) out[i]! /= max;
  return out;
}

export function computeWavePeaksFromAudioBuffer(
  audioBuf: AudioBuffer,
  binCount?: number
): number[] {
  const count = binCount ?? resolveWavePeakBinCount(audioBuf.duration);
  return computeWavePeaksFromChannelData(mixDownAudioBufferForPeaks(audioBuf), count);
}

/** 低解像度ピーク（旧 400 点キャッシュ等）をタイムライン表示用に拡張（各ビンは最大振幅） */
export function upsampleWavePeaks(peaks: number[], targetCount: number): number[] {
  if (peaks.length >= targetCount || peaks.length <= 1) return peaks;
  const out = new Array<number>(targetCount);
  const srcLen = peaks.length;
  for (let i = 0; i < targetCount; i++) {
    const srcStart = (i / targetCount) * srcLen;
    const srcEnd = ((i + 1) / targetCount) * srcLen;
    const i0 = Math.floor(srcStart);
    const i1 = Math.min(srcLen - 1, Math.ceil(srcEnd) - 1);
    let peak = 0;
    for (let j = i0; j <= i1; j++) {
      const v = peaks[j]!;
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  return out;
}

/** 保存済みピークをタイムライン描画向けに整える */
export function refinePeaksForTimeline(
  peaks: number[],
  durationSec?: number | null
): number[] {
  const target = resolveWavePeakBinCount(durationSec);
  if (peaks.length >= target * 0.85) return peaks;
  return upsampleWavePeaks(peaks, target);
}
