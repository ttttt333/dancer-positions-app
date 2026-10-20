/**
 * BPM × 第1ダウンビートから数学的に均等な BeatInfo[] を生成する。
 * 局所ピークや不揃いな eight_times をそのまま使わない。
 */

import type { BeatInfo } from "../../types/audioAnalysis";

export type EvenBeatGridOpts = {
  bpm: number;
  duration: number;
  /** 最初のカウント1（秒）。省略時は 0 */
  firstDownbeatTime?: number;
  /** ダウンビート周期（ダンスは 8） */
  beatsPerCycle?: number;
};

/** 1拍の秒数 */
export function secondsPerBeat(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

/** 8カウント（1サイクル）の秒数 */
export function secondsPerEightCount(bpm: number): number {
  return secondsPerBeat(bpm) * 8;
}

/**
 * firstDownbeat から曲末まで等間隔、さらに曲頭まで逆方向に埋める。
 * グローバル index % 8 === 0 がダウンビート（カウント1）。
 */
export function buildEvenBeatGrid(opts: EvenBeatGridOpts): BeatInfo[] {
  const bpm = Number.isFinite(opts.bpm) && opts.bpm > 0 ? opts.bpm : 120;
  const duration = opts.duration;
  if (!(duration > 0)) return [];

  const spb = secondsPerBeat(bpm);
  const cycle = Math.max(1, Math.floor(opts.beatsPerCycle ?? 8));
  let t0 = opts.firstDownbeatTime ?? 0;
  if (!Number.isFinite(t0)) t0 = 0;
  // 負なら周期を足して最初の非負ダウンビートへ
  while (t0 < 0) t0 += spb * cycle;
  // duration より後ろなら引き戻す
  while (t0 > duration && t0 > 0) t0 -= spb * cycle;
  if (t0 < 0) t0 = 0;

  type Row = { timestamp: number; index: number };
  const rows: Row[] = [];

  // 前方（ダウンビート index 0, 1, 2...）
  for (let i = 0; ; i += 1) {
    const timestamp = t0 + i * spb;
    if (timestamp > duration + 1e-6) break;
    rows.push({ timestamp, index: i });
  }
  // 後方（曲頭まで）
  for (let i = -1; ; i -= 1) {
    const timestamp = t0 + i * spb;
    if (timestamp < -1e-9) break;
    rows.push({ timestamp, index: i });
  }

  rows.sort((a, b) => a.timestamp - b.timestamp);

  return rows
    .filter((r) => r.timestamp >= -1e-9 && r.timestamp <= duration + 1e-6)
    .map((r) => {
      const mod = ((r.index % cycle) + cycle) % cycle;
      return {
        timestamp: Math.round(r.timestamp * 1000) / 1000,
        isDownbeat: mod === 0,
        beatNumber: mod + 1,
      };
    });
}

/**
 * 不揃いな eight_times から平均BPMと最初のダウンビートを推定。
 * 間隔の中央値を 8カウント長とみなす。
 */
export function inferTempoFromEightTimes(eightTimes: number[]): {
  bpm: number;
  firstDownbeatTime: number;
} | null {
  const sorted = [...eightTimes]
    .filter((t) => Number.isFinite(t) && t >= 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const firstDownbeatTime = sorted[0]!;
  if (sorted.length < 2) {
    return { bpm: 120, firstDownbeatTime };
  }

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const g = sorted[i]! - sorted[i - 1]!;
    if (g > 0.4 && g < 20) gaps.push(g);
  }
  if (gaps.length === 0) return { bpm: 120, firstDownbeatTime };

  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  const bpm = Math.round((60 * 8) / median / 5) * 5;
  return {
    bpm: Math.min(200, Math.max(60, bpm || 120)),
    firstDownbeatTime,
  };
}

/** 解析ログ用 */
export function logAudioAnalysisEngine(info: {
  engine: string;
  bpm: number;
  beatsCount: number;
  sectionsCount: number;
  sourceLabel?: string | null;
}): void {
  const isRemote = /fly|remote|structure-v2|cache|direct/i.test(info.engine);
  console.log(
    `[AudioAnalysis] Engine: ${isRemote ? "Fly.io AI" : "Browser Peak Fallback"} (${info.engine}), BPM: ${info.bpm}, Beats count: ${info.beatsCount}, Sections: ${info.sectionsCount}${info.sourceLabel ? `, source=${info.sourceLabel}` : ""}`
  );
}
