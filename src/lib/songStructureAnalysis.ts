/**
 * 楽曲構造解析（ブラウザ実装）。
 * Spec: song-structure-analysis-spec.md
 *
 * librosa 版（Fly.io）が未接続のときのフォールバック。
 * 波形ピークからエイトグリッド・変化点・tier・song_dynamism を推定する。
 */

export type ChangeTier = "major" | "medium" | "minor";

export type EightGridEntry = {
  index: number;
  start_time: number;
};

export type ChangePoint = {
  eight_index: number;
  time: number;
  score: number;
  tier: ChangeTier;
};

export type SongStructureAnalysis = {
  bpm: number;
  duration: number;
  eight_grid: EightGridEntry[];
  change_points: ChangePoint[];
  song_dynamism: number;
  analyzer_version: string;
  source: "browser" | "remote";
};

export const BROWSER_ANALYZER_VERSION = "browser-v1.0.0";

function smooth(arr: number[], windowSize = 8): number[] {
  const out: number[] = [];
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    for (
      let j = Math.max(0, i - half);
      j < Math.min(arr.length, i + half + 1);
      j++
    ) {
      sum += arr[j]!;
      count++;
    }
    out.push(sum / Math.max(1, count));
  }
  return out;
}

function normalize(x: number[]): number[] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of x) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min + 1e-8;
  return x.map((v) => (v - min) / span);
}

/** BPM推定: オートコリレーション (60〜200) */
export function estimateBpmFromPeaks(
  peaks: number[],
  durationSec: number
): number {
  const n = peaks.length;
  if (n < 8 || durationSec <= 0) return 120;
  const secPerSample = durationSec / n;
  let bestBpm = 120;
  let bestCorr = -Infinity;

  for (let bpm = 60; bpm <= 200; bpm++) {
    const lagSamples = Math.round(60 / bpm / secPerSample);
    if (lagSamples < 1 || lagSamples >= n) continue;
    let corr = 0;
    let count = 0;
    for (let i = 0; i < n - lagSamples; i++) {
      corr += peaks[i]! * peaks[i + lagSamples]!;
      count++;
    }
    corr /= Math.max(1, count);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestBpm = bpm;
    }
  }
  return Math.round(bestBpm / 5) * 5;
}

function buildEightGrid(bpm: number, durationSec: number): EightGridEntry[] {
  const secPerBeat = 60 / Math.max(1, bpm);
  const secPerEight = secPerBeat * 8;
  const eights: EightGridEntry[] = [];
  let t = 0;
  let index = 0;
  // 曲末の不完全エイトは捨てる（spec と同じ）
  while (t + secPerEight <= durationSec + 1e-6) {
    eights.push({ index, start_time: Math.round(t * 1000) / 1000 });
    t += secPerEight;
    index += 1;
  }
  if (eights.length === 0) {
    eights.push({ index: 0, start_time: 0 });
  }
  return eights;
}

/** エネルギー曲線の局所差（簡易 novelty） */
function energyNovelty(peaks: number[]): number[] {
  const s = smooth(peaks, 12);
  const out = new Array(s.length).fill(0) as number[];
  const w = 16;
  for (let i = w; i < s.length - w; i++) {
    let left = 0;
    let right = 0;
    for (let j = 0; j < w; j++) {
      left += s[i - j - 1]!;
      right += s[i + j]!;
    }
    out[i] = Math.abs(right - left) / w;
  }
  return smooth(out, 6);
}

/** Foote 風: 自己相似の対角チェッカーボード近似（1D エネルギー版） */
function structuralNoveltyApprox(peaks: number[]): number[] {
  const s = smooth(normalize(peaks), 10);
  const n = s.length;
  const out = new Array(n).fill(0) as number[];
  const half = 24;
  for (let i = half; i < n - half; i++) {
    let score = 0;
    for (let a = 0; a < half; a++) {
      for (let b = 0; b < half; b++) {
        const past = s[i - half + a]!;
        const future = s[i + b]!;
        // 同側は正、異側は負（チェッカーボード近似）
        score += past * past + future * future - 2 * past * future;
      }
    }
    out[i] = Math.max(0, score);
  }
  return smooth(out, 8);
}

function gaussianSmooth1d(x: number[], sigma = 2): number[] {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel: number[] = [];
  let ksum = 0;
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(w);
    ksum += w;
  }
  return x.map((_, i) => {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = Math.min(x.length - 1, Math.max(0, i + k));
      sum += x[j]! * kernel[k + radius]!;
    }
    return sum / ksum;
  });
}

function peakPick(
  curve: number[],
  opts: { preMax: number; postMax: number; delta: number; wait: number }
): number[] {
  const { preMax, postMax, delta, wait } = opts;
  const peaks: number[] = [];
  let last = -wait - 1;
  const mean =
    curve.reduce((a, b) => a + b, 0) / Math.max(1, curve.length);
  for (let i = preMax; i < curve.length - postMax; i++) {
    const v = curve[i]!;
    if (v < mean + delta) continue;
    if (i - last < wait) continue;
    let isMax = true;
    for (let j = i - preMax; j <= i + postMax; j++) {
      if (j === i) continue;
      if (curve[j]! > v) {
        isMax = false;
        break;
      }
    }
    if (isMax) {
      peaks.push(i);
      last = i;
    }
  }
  return peaks;
}

/** 1D k-means (k=3) → minor/medium/major */
function scoreToTier(peakScores: number[]): ChangeTier[] {
  if (peakScores.length === 0) return [];
  if (peakScores.length < 3) {
    return peakScores.map(() => "major" as const);
  }

  const sorted = [...peakScores].sort((a, b) => a - b);
  let c0 = sorted[Math.floor(sorted.length * 0.2)]!;
  let c1 = sorted[Math.floor(sorted.length * 0.5)]!;
  let c2 = sorted[Math.floor(sorted.length * 0.8)]!;

  const labels = new Array(peakScores.length).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    const sums = [0, 0, 0];
    const counts = [0, 0, 0];
    for (let i = 0; i < peakScores.length; i++) {
      const s = peakScores[i]!;
      const d0 = Math.abs(s - c0);
      const d1 = Math.abs(s - c1);
      const d2 = Math.abs(s - c2);
      const lab = d0 <= d1 && d0 <= d2 ? 0 : d1 <= d2 ? 1 : 2;
      labels[i] = lab;
      sums[lab]! += s;
      counts[lab]! += 1;
    }
    if (counts[0]) c0 = sums[0]! / counts[0]!;
    if (counts[1]) c1 = sums[1]! / counts[1]!;
    if (counts[2]) c2 = sums[2]! / counts[2]!;
  }

  const centers = [c0, c1, c2];
  const order = [0, 1, 2].sort((a, b) => centers[a]! - centers[b]!);
  const map: Record<number, ChangeTier> = {
    [order[0]!]: "minor",
    [order[1]!]: "medium",
    [order[2]!]: "major",
  };
  return labels.map((c) => map[c]!);
}

function computeSongDynamism(curve: number[]): number {
  if (curve.length === 0) return 0.5;
  const mean = curve.reduce((a, b) => a + b, 0) / curve.length;
  let varSum = 0;
  for (const v of curve) varSum += (v - mean) ** 2;
  const std = Math.sqrt(varSum / curve.length);
  const cv = std / (mean + 1e-8);
  return Math.min(1, Math.max(0, cv / 1.5));
}

function snapToEight(
  timeSec: number,
  eightStarts: number[]
): { eight_index: number; time: number } {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < eightStarts.length; i++) {
    const d = Math.abs(eightStarts[i]! - timeSec);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return { eight_index: best, time: eightStarts[best]! };
}

/**
 * 波形ピークから楽曲構造を解析する（ブラウザ実装）。
 */
export function analyzeSongStructureFromPeaks(
  peaks: number[],
  durationSec: number
): SongStructureAnalysis {
  const duration = Math.max(0.1, durationSec);
  const bpm = estimateBpmFromPeaks(peaks, duration);
  const eight_grid = buildEightGrid(bpm, duration);
  const eightStarts = eight_grid.map((e) => e.start_time);

  const structural = structuralNoveltyApprox(peaks);
  const energetic = energyNovelty(peaks);
  // 長さを揃える
  const n = Math.min(structural.length, energetic.length);
  const sN = normalize(structural.slice(0, n));
  const eN = normalize(energetic.slice(0, n));
  let combined = sN.map((v, i) => 0.6 * v + 0.4 * eN[i]!);
  combined = gaussianSmooth1d(combined, 2);

  const sampleRate = n / duration; // samples per sec
  const waitSamples = Math.max(8, Math.round(sampleRate * (60 / bpm) * 4)); // ~4拍
  const peakIdx = peakPick(combined, {
    preMax: 8,
    postMax: 8,
    delta: 0.08,
    wait: waitSamples,
  });

  const peakTimes = peakIdx.map((i) => (i / Math.max(1, n - 1)) * duration);
  const peakScores = peakIdx.map((i) => combined[i]!);
  const tiers = scoreToTier(peakScores);
  const song_dynamism = computeSongDynamism(combined);

  const seen = new Set<number>();
  const change_points: ChangePoint[] = [];
  for (let i = 0; i < peakTimes.length; i++) {
    const snapped = snapToEight(peakTimes[i]!, eightStarts);
    if (seen.has(snapped.eight_index)) continue;
    // 曲頭の微小変化は無視
    if (snapped.time < (60 / bpm) * 4) continue;
    seen.add(snapped.eight_index);
    change_points.push({
      eight_index: snapped.eight_index,
      time: snapped.time,
      score: peakScores[i]!,
      tier: tiers[i]!,
    });
  }

  change_points.sort((a, b) => a.time - b.time);

  // 変化点が少なすぎる場合は 4 エイトごとに medium を補う
  if (change_points.length < 2 && eight_grid.length >= 2) {
    for (let i = 4; i < eight_grid.length; i += 4) {
      const e = eight_grid[i]!;
      if (change_points.some((c) => c.eight_index === e.index)) continue;
      change_points.push({
        eight_index: e.index,
        time: e.start_time,
        score: 0.4,
        tier: "medium",
      });
    }
    change_points.sort((a, b) => a.time - b.time);
  }

  return {
    bpm,
    duration: Math.round(duration * 10) / 10,
    eight_grid,
    change_points,
    song_dynamism,
    analyzer_version: BROWSER_ANALYZER_VERSION,
    source: "browser",
  };
}
