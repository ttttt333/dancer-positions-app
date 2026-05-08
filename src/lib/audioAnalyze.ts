/**
 * audioAnalyze.ts — ブラウザ内の波形ピーク配列から BPM・セクション・エネルギー曲線を推定
 * AudioContext は使わず peaks(400点) だけで処理するため軽量・同期的
 */

export interface Section {
  label: string;
  startSec: number;
  endSec: number;
  avgEnergy: number;
}

export interface AudioAnalysis {
  durationSec: number;
  bpm: number;
  sections: Section[];
  energyCurve: number[];
}

/* ─── Helpers ─── */

/** 8点窓で平滑化 */
function smooth(arr: number[], windowSize = 8): number[] {
  const out: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - Math.floor(windowSize / 2)); j < Math.min(arr.length, i + Math.ceil(windowSize / 2)); j++) {
      sum += arr[j]!;
      count++;
    }
    out.push(sum / count);
  }
  return out;
}

/** BPM推定: オートコリレーション法 (60〜200 BPM) */
function estimateBpm(peaks: number[], durationSec: number): number {
  const n = peaks.length;
  const secPerSample = durationSec / n;
  let bestBpm = 120;
  let bestCorr = -Infinity;

  for (let bpm = 60; bpm <= 200; bpm++) {
    const lagSamples = Math.round((60 / bpm) / secPerSample);
    if (lagSamples < 1 || lagSamples >= n) continue;

    let corr = 0;
    let count = 0;
    for (let i = 0; i < n - lagSamples; i++) {
      corr += peaks[i]! * peaks[i + lagSamples]!;
      count++;
    }
    corr /= count;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestBpm = bpm;
    }
  }

  // 5の倍数に丸め
  return Math.round(bestBpm / 5) * 5;
}

/** セクション名を付与 */
function assignSectionLabel(index: number, total: number, avgEnergy: number): string {
  if (index === 0) return "イントロ";
  if (index === total - 1 && avgEnergy < 0.3) return "アウトロ";

  // 中間セクション: エネルギーに基づく
  if (avgEnergy > 0.65) return "サビ";
  if (avgEnergy > 0.45) return "Bメロ";
  if (avgEnergy < 0.25) return "間奏";
  return "Aメロ";
}

/** セクション検出 */
function detectSections(peaks: number[], durationSec: number): Section[] {
  const smoothed = smooth(peaks);
  const n = smoothed.length;
  const secPerSample = durationSec / n;

  // 全体の平均・標準偏差
  let mean = 0;
  for (const v of smoothed) mean += v;
  mean /= n;

  let variance = 0;
  for (const v of smoothed) variance += (v - mean) ** 2;
  const std = Math.sqrt(variance / n);

  const threshold = std * 0.6;
  const minGapSamples = Math.floor(n * 0.08);

  // 16点ブロック間のエネルギー差で境界検出
  const blockSize = 16;
  const boundaries: number[] = [0];
  let lastBoundary = 0;

  for (let i = blockSize; i < n - blockSize; i++) {
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let j = 0; j < blockSize; j++) {
      leftEnergy += smoothed[i - j - 1]!;
      rightEnergy += smoothed[i + j]!;
    }
    leftEnergy /= blockSize;
    rightEnergy /= blockSize;

    const diff = Math.abs(rightEnergy - leftEnergy);
    if (diff > threshold && (i - lastBoundary) >= minGapSamples) {
      boundaries.push(i);
      lastBoundary = i;
    }
  }
  boundaries.push(n);

  // 最大8セクション: 差が小さい境界をマージ
  while (boundaries.length > 9) {
    let minDiff = Infinity;
    let minIdx = 1;
    for (let i = 1; i < boundaries.length - 1; i++) {
      const span = boundaries[i + 1]! - boundaries[i - 1]!;
      if (span < minDiff) {
        minDiff = span;
        minIdx = i;
      }
    }
    boundaries.splice(minIdx, 1);
  }

  // Section配列を生成
  const sections: Section[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startIdx = boundaries[i]!;
    const endIdx = boundaries[i + 1]!;
    const startSec = startIdx * secPerSample;
    const endSec = endIdx * secPerSample;

    let sum = 0;
    for (let j = startIdx; j < endIdx; j++) sum += smoothed[j]!;
    const avgEnergy = sum / (endIdx - startIdx);

    sections.push({
      label: assignSectionLabel(i, boundaries.length - 1, avgEnergy),
      startSec: Math.round(startSec * 10) / 10,
      endSec: Math.round(endSec * 10) / 10,
      avgEnergy: Math.round(avgEnergy * 100) / 100,
    });
  }

  return sections;
}

/* ─── Main ─── */

export function analyzeAudio(peaks: number[], durationSec: number): AudioAnalysis {
  const bpm = estimateBpm(peaks, durationSec);
  const sections = detectSections(peaks, durationSec);

  return {
    durationSec: Math.round(durationSec * 10) / 10,
    bpm,
    sections,
    energyCurve: peaks,
  };
}
