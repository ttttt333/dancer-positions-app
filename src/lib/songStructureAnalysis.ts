/**
 * 楽曲構造解析（ブラウザ実装）。
 * Fly.io librosa 版と同じ思想:
 * - peak_pick 廃止
 * - 4エイト（32ビート）でイントロ／Aメロ／サビ／アウトロをラベル
 * - Aメロ終わりはサビの 2 エイト前（PRE_CHORUS）
 */

export type ChangeTier = "major" | "medium" | "minor";
export type SectionType =
  | "CHORUS_START"
  | "CHORUS"
  | "VERSE"
  | "INTRO"
  | "OUTRO"
  | "DROP"
  | "PRE_CHORUS"
  | "SE_TRIGGER";

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

export const BROWSER_ANALYZER_VERSION = "browser-v1.2.0";

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

function markSectionBlocks(blockEnergy: number[]): SectionType[] {
  const n = blockEnergy.length;
  if (n === 0) return [];
  const sorted = [...blockEnergy].sort((a, b) => a - b);
  const median = percentile(sorted, 0.5);
  const p65 = percentile(sorted, 0.65);
  const mean = blockEnergy.reduce((a, b) => a + b, 0) / n;
  const span = Math.max(
    1e-8,
    Math.max(...blockEnergy) - Math.min(...blockEnergy)
  );

  const loud = blockEnergy.map((e, i) => {
    const prev = i > 0 ? blockEnergy[i - 1]! : e;
    const jump = (e - prev) / span;
    return e >= p65 || (e > median && jump >= 0.18) || e >= mean + 0.12 * span;
  });

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
  if (section[0] === "VERSE") section[0] = "INTRO";
  for (let oi = Math.max(0, n - 2); oi < n; oi++) {
    if (section[oi] === "VERSE") section[oi] = "OUTRO";
  }
  for (let k = 1; k < n; k++) {
    const rise = (blockEnergy[k]! - blockEnergy[k - 1]!) / span;
    if (
      rise >= 0.28 &&
      section[k] !== "CHORUS_START" &&
      section[k] !== "INTRO"
    ) {
      section[k] = "DROP";
    }
  }
  return section;
}

function emitStructuralChangePoints(
  blocks: Array<{ eight_index: number; time: number; mean_energy: number }>,
  sectionTypes: SectionType[],
  scores: number[],
  eightGrid: EightGridEntry[],
  bpm: number
): ChangePoint[] {
  const secPerEight = (60 / Math.max(1, bpm)) * BEATS_PER_EIGHT;
  const eightTime = new Map(eightGrid.map((e) => [e.index, e.start_time]));
  const out: ChangePoint[] = [];
  const seen = new Set<number>();

  const push = (
    eight_index: number,
    time: number,
    score: number,
    tier: ChangeTier,
    section_type: SectionType
  ) => {
    if (!Number.isFinite(time) || time < 0.4) return;
    const key = Math.round(time * 10);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      eight_index: Math.max(0, eight_index),
      time: Math.round(time * 1000) / 1000,
      score,
      tier,
      section_type,
    });
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const stype = sectionTypes[i] ?? "VERSE";
    const score = scores[i] ?? 0;
    const prevType = i > 0 ? sectionTypes[i - 1] : undefined;

    if (stype === "CHORUS_START") {
      if (
        prevType === "VERSE" ||
        prevType === "INTRO" ||
        prevType === "OUTRO"
      ) {
        const preEight = b.eight_index - 2;
        push(
          preEight,
          eightTime.get(preEight) ?? b.time - 2 * secPerEight,
          Math.min(1, score * 0.85),
          "medium",
          "PRE_CHORUS"
        );
      }
      push(b.eight_index, b.time, score, "major", "CHORUS_START");
      continue;
    }
    if (stype === "DROP") {
      push(b.eight_index, b.time, score, "major", "DROP");
      continue;
    }
    if (stype === "CHORUS") {
      const run =
        i > 0 && (sectionTypes[i - 1] === "CHORUS" || sectionTypes[i - 1] === "CHORUS_START")
          ? 1
          : 0;
      // 長いサビの中盤だけ絵を変える（毎回は変えない）
      if (run && i % 2 === 1) {
        push(b.eight_index, b.time, score, score >= 0.75 ? "major" : "medium", "CHORUS");
      }
      continue;
    }
    if (stype === "OUTRO" && prevType !== "OUTRO") {
      push(b.eight_index, b.time, score, "medium", "OUTRO");
      continue;
    }
    if (
      stype === "VERSE" &&
      (prevType === "CHORUS" ||
        prevType === "CHORUS_START" ||
        prevType === "DROP")
    ) {
      push(b.eight_index, b.time, score, "medium", "VERSE");
    }
  }

  out.sort((a, b) => a.time - b.time);
  return out;
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
  const sectionTypes = markSectionBlocks(energies);

  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  const variance =
    energies.reduce((a, b) => a + (b - mean) ** 2, 0) / energies.length;
  const cv = Math.sqrt(variance) / (mean + 1e-8);
  const song_dynamism = Math.min(1, Math.max(0, cv / 1.5));

  const change_points = emitStructuralChangePoints(
    blocks,
    sectionTypes,
    scores,
    eight_grid,
    bpm
  );

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
