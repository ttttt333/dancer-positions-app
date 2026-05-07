/**
 * audioAnalyze.ts
 * 既存の波形ピーク配列（useTimelineWaveDecode が生成する peaks: number[]）から
 * BPM・セクション・エネルギー曲線を推定する。
 *
 * AudioContext を再度開かずに peaks だけで処理するため、軽量・同期的。
 */

export interface Section {
  /** "イントロ" | "Aメロ" | "Bメロ" | "サビ" | "間奏" | "アウトロ" など */
  label: string;
  startSec: number;
  endSec: number;
  avgEnergy: number; // 0〜1
}

export interface AudioAnalysis {
  durationSec: number;
  bpm: number;
  sections: Section[];
  energyCurve: number[]; // 元の peaks をそのまま渡す（0〜1、400点）
}

/**
 * peaks: useTimelineWaveDecode が生成する 400点の正規化振幅配列（0〜1）
 * durationSec: 曲の長さ（秒）
 */
export function analyzeAudio(peaks: number[], durationSec: number): AudioAnalysis {
  const bpm = estimateBpm(peaks, durationSec);
  const sections = detectSections(peaks, durationSec);
  return {
    durationSec,
    bpm,
    sections,
    energyCurve: peaks,
  };
}

// ---------------------------------------------------------------------------
// BPM 推定（オートコリレーション法）
// ---------------------------------------------------------------------------

function estimateBpm(peaks: number[], durationSec: number): number {
  if (peaks.length < 10 || durationSec <= 0) return 120;

  const secPerSample = durationSec / peaks.length;

  // BPM 60〜200 の範囲でオートコリレーション
  let bestBpm = 120;
  let bestScore = -Infinity;

  for (let bpm = 60; bpm <= 200; bpm += 1) {
    const periodSamples = (60 / bpm) / secPerSample;
    const lag = Math.round(periodSamples);
    if (lag >= peaks.length) continue;

    let score = 0;
    const n = peaks.length - lag;
    for (let i = 0; i < n; i++) {
      score += (peaks[i] ?? 0) * (peaks[i + lag] ?? 0);
    }
    score /= n;

    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  // 5の倍数に丸める（より自然な表示）
  return Math.round(bestBpm / 5) * 5 || bestBpm;
}

// ---------------------------------------------------------------------------
// セクション検出（エネルギー変化の境界を探す）
// ---------------------------------------------------------------------------

function detectSections(peaks: number[], durationSec: number): Section[] {
  if (peaks.length === 0 || durationSec <= 0) {
    return [{ label: "全体", startSec: 0, endSec: durationSec, avgEnergy: 0.5 }];
  }

  // 8点窓で平滑化したエネルギー曲線
  const smoothed = smoothPeaks(peaks, 8);

  // 全体の平均・標準偏差
  const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
  const std = Math.sqrt(
    smoothed.reduce((a, b) => a + (b - mean) ** 2, 0) / smoothed.length
  );

  // 変化点検出: 隣接する16点ブロック間のエネルギー差が閾値を超えたら境界
  const blockSize = Math.max(1, Math.floor(peaks.length / 16));
  const boundaries: number[] = [0]; // インデックス（peaksのインデックス）

  for (let i = blockSize; i < peaks.length - blockSize; i += blockSize) {
    const before = avg(smoothed, Math.max(0, i - blockSize), i);
    const after = avg(smoothed, i, Math.min(smoothed.length, i + blockSize));
    if (Math.abs(after - before) > std * 0.6) {
      // 前の境界と近すぎる場合はスキップ（最低でも曲全体の8%以上離す）
      const minGap = Math.floor(peaks.length * 0.08);
      if (i - (boundaries[boundaries.length - 1] ?? 0) >= minGap) {
        boundaries.push(i);
      }
    }
  }
  boundaries.push(peaks.length);

  // セクション数が多すぎる場合はマージ（最大8セクション）
  const maxSections = 8;
  while (boundaries.length - 1 > maxSections) {
    // 最も小さいセクションを隣とマージ
    let minIdx = 1;
    let minLen = Infinity;
    for (let i = 1; i < boundaries.length - 1; i++) {
      const len = (boundaries[i] ?? 0) - (boundaries[i - 1] ?? 0);
      if (len < minLen) {
        minLen = len;
        minIdx = i;
      }
    }
    boundaries.splice(minIdx, 1);
  }

  // セクションオブジェクトに変換
  const sections: Section[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startIdx = boundaries[i] ?? 0;
    const endIdx = boundaries[i + 1] ?? peaks.length;
    const startSec = (startIdx / peaks.length) * durationSec;
    const endSec = (endIdx / peaks.length) * durationSec;
    const energy = avg(smoothed, startIdx, endIdx);

    sections.push({
      label: sectionLabel(i, sections.length > 0 ? sections : [], energy, mean),
      startSec: Math.round(startSec * 10) / 10,
      endSec: Math.round(endSec * 10) / 10,
      avgEnergy: Math.round(energy * 100) / 100,
    });
  }

  return sections;
}

function smoothPeaks(peaks: number[], windowSize: number): number[] {
  return peaks.map((_, i) => {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(peaks.length, i + windowSize + 1);
    return avg(peaks, start, end);
  });
}

function avg(arr: number[], start: number, end: number): number {
  if (end <= start) return 0;
  let s = 0;
  for (let i = start; i < end; i++) s += arr[i] ?? 0;
  return s / (end - start);
}

function sectionLabel(
  index: number,
  prevSections: Section[],
  energy: number,
  meanEnergy: number
): string {
  const isFirst = index === 0;
  const isHigh = energy > meanEnergy * 1.2;
  const isMid = energy >= meanEnergy * 0.8 && energy <= meanEnergy * 1.2;

  if (isFirst) return "イントロ";

  // 前のセクションと比較
  const prev = prevSections[prevSections.length - 1];
  const prevEnergy = prev?.avgEnergy ?? meanEnergy;

  if (isHigh && energy > prevEnergy * 1.15) return "サビ";
  if (!isHigh && energy < prevEnergy * 0.85) return "間奏";
  if (isMid && prevSections.some((s) => s.label === "Aメロ")) return "Bメロ";
  if (isMid) return "Aメロ";

  // 末尾付近（曲全体の85%以降）はアウトロ候補
  return "アウトロ";
}
