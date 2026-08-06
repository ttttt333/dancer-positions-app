/**
 * 楽曲構造解析（ブラウザ実装）。
 * Fly.io librosa 版と同じ思想:
 * - peak_pick 廃止
 * - 4エイト（32ビート）固定ブロック
 * - 波形エネルギー近似でサビ（上位35%連続）判定
 */

export type ChangeTier = "major" | "medium" | "minor";
export type SectionType = "CHORUS_START" | "CHORUS" | "VERSE";

export type EightGridEntry = {
  index: number;
  start_time: number;
};

export type ChangePoint = {
  eight_index: number;
  time: number;
  score: number;
  tier: ChangeTier;
  section_type?: SectionType;
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

export const BROWSER_ANALYZER_VERSION = "browser-v1.1.0";

const BEATS_PER_EIGHT = 8;
const EIGHTS_PER_BLOCK = 4;

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
      count += 1;
    }
    out.push(sum / Math.max(1, count));
  }
  return out;
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
      count += 1;
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
  const secPerEight = secPerBeat * BEATS_PER_EIGHT;
  const eights: EightGridEntry[] = [];
  let t = 0;
  let index = 0;
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

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const w = idx - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

function markChorusBlocks(blockEnergy: number[], topRatio = 0.35): SectionType[] {
  const n = blockEnergy.length;
  if (n === 0) return [];
  if (n === 1) return ["CHORUS_START"];
  const sorted = [...blockEnergy].sort((a, b) => a - b);
  const thr = percentile(sorted, 1 - topRatio);
  const loud = blockEnergy.map((e) => e >= thr);
  const section: SectionType[] = Array.from({ length: n }, () => "VERSE");
  let i = 0;
  while (i < n) {
    if (!loud[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && loud[j]) j += 1;
    section[i] = "CHORUS_START";
    for (let k = i + 1; k < j; k++) section[k] = "CHORUS";
    i = j;
  }
  return section;
}

function meanInRange(peaks: number[], startSec: number, endSec: number, duration: number): number {
  const n = peaks.length;
  if (n === 0 || duration <= 0) return 0;
  const a = Math.max(0, Math.floor((startSec / duration) * n));
  const b = Math.min(n, Math.ceil((endSec / duration) * n));
  if (b <= a) return peaks[Math.min(n - 1, a)] ?? 0;
  let sum = 0;
  for (let i = a; i < b; i++) sum += peaks[i]!;
  return sum / (b - a);
}

/**
 * 波形ピークから楽曲構造を解析する（ブラウザ実装・4エイト固定）。
 */
export function analyzeSongStructureFromPeaks(
  peaks: number[],
  durationSec: number
): SongStructureAnalysis {
  const duration = Math.max(0.1, durationSec);
  const bpm = estimateBpmFromPeaks(peaks, duration);
  const eight_grid = buildEightGrid(bpm, duration);
  const smoothed = smooth(peaks, 12);

  type Block = {
    eight_index: number;
    time: number;
    end_time: number;
    mean_energy: number;
  };

  const blocks: Block[] = [];
  for (let ei = 0; ei < eight_grid.length; ei += EIGHTS_PER_BLOCK) {
    const start = eight_grid[ei]!;
    const endEight = eight_grid[ei + EIGHTS_PER_BLOCK];
    const end_time = endEight?.start_time ?? duration;
    const mean_energy = meanInRange(
      smoothed,
      start.start_time,
      end_time,
      duration
    );
    blocks.push({
      eight_index: start.index,
      time: start.start_time,
      end_time,
      mean_energy,
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      eight_index: 0,
      time: 0,
      end_time: duration,
      mean_energy: 0.5,
    });
  }

  const energies = blocks.map((b) => b.mean_energy);
  const eMin = Math.min(...energies);
  const eMax = Math.max(...energies);
  const span = eMax - eMin + 1e-8;
  const scores = energies.map((e) => (e - eMin) / span);
  const sectionTypes = markChorusBlocks(energies, 0.35);

  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  const variance =
    energies.reduce((a, b) => a + (b - mean) ** 2, 0) / energies.length;
  const cv = Math.sqrt(variance) / (mean + 1e-8);
  const song_dynamism = Math.min(1, Math.max(0, cv / 1.5));

  let verseCounter = 0;
  const change_points: ChangePoint[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.eight_index === 0) continue;
    const stype = sectionTypes[i]!;
    const score = scores[i]!;
    let tier: ChangeTier;
    if (stype === "CHORUS_START") {
      tier = "major";
    } else if (stype === "CHORUS") {
      tier = score >= 0.75 ? "major" : "medium";
    } else {
      tier = verseCounter % 2 === 0 ? "medium" : "minor";
      verseCounter += 1;
    }
    change_points.push({
      eight_index: b.eight_index,
      time: b.time,
      score,
      tier,
      section_type: stype,
    });
  }
  change_points.sort((a, b) => a.time - b.time);

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
