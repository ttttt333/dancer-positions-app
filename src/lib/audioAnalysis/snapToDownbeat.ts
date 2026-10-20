/**
 * セクション境界をビート／ダウンビートへ吸着するユーティリティ。
 */

import type {
  AudioAnalysisResult,
  BeatInfo,
  MusicSection,
} from "../../types/audioAnalysis";

/** 最も近いダウンビート（1拍目）へスナップ。無い場合は raw を返す。 */
export function snapToNearestDownbeat(
  rawTime: number,
  beats: BeatInfo[]
): number {
  if (!Number.isFinite(rawTime)) return rawTime;
  const downbeats = beats.filter((b) => b.isDownbeat);
  if (downbeats.length === 0) return rawTime;

  return downbeats.reduce((prev, curr) =>
    Math.abs(curr.timestamp - rawTime) < Math.abs(prev.timestamp - rawTime)
      ? curr
      : prev
  ).timestamp;
}

/** 手動ドラッグ用: 任意ビートへマグネット吸着 */
export function snapToNearestBeat(rawTime: number, beats: BeatInfo[]): number {
  if (!Number.isFinite(rawTime) || beats.length === 0) return rawTime;
  return beats.reduce((prev, curr) =>
    Math.abs(curr.timestamp - rawTime) < Math.abs(prev.timestamp - rawTime)
      ? curr
      : prev
  ).timestamp;
}

/** タイムスタンプ配列（eight_times 等）へ吸着 */
export function snapToNearestTimestamp(
  rawTime: number,
  timestamps: number[]
): number {
  if (!Number.isFinite(rawTime) || timestamps.length === 0) return rawTime;
  let best = timestamps[0]!;
  let bestD = Math.abs(best - rawTime);
  for (let i = 1; i < timestamps.length; i += 1) {
    const t = timestamps[i]!;
    const d = Math.abs(t - rawTime);
    if (d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

const MIN_SECTION_SPAN_SEC = 0.05;

/**
 * 各セクションの start/end をダウンビートへ補正。
 * end が start 以下にならないよう、必要なら次のダウンビートへ押し出す。
 */
export function snapSectionsToDownbeats(
  sections: MusicSection[],
  beats: BeatInfo[],
  duration: number
): MusicSection[] {
  if (sections.length === 0) return sections;
  const downbeats = beats
    .filter((b) => b.isDownbeat)
    .map((b) => b.timestamp)
    .sort((a, b) => a - b);

  const snap = (t: number) =>
    downbeats.length > 0
      ? snapToNearestTimestamp(t, downbeats)
      : snapToNearestDownbeat(t, beats);

  const out: MusicSection[] = [];
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i]!;
    let start = Math.max(0, snap(s.startTime));
    let end = Math.min(duration > 0 ? duration : Number.POSITIVE_INFINITY, snap(s.endTime));

    if (end <= start + MIN_SECTION_SPAN_SEC) {
      const nextDb = downbeats.find((t) => t > start + MIN_SECTION_SPAN_SEC);
      end = nextDb ?? Math.min(duration || start + 0.5, start + 0.5);
    }

    // 前セクションと重ならないよう開始を押し出し
    const prev = out[out.length - 1];
    if (prev && start < prev.endTime) {
      start = prev.endTime;
      if (end <= start + MIN_SECTION_SPAN_SEC) {
        const nextDb = downbeats.find((t) => t > start + MIN_SECTION_SPAN_SEC);
        end = nextDb ?? Math.min(duration || start + 0.5, start + 0.5);
      }
    }

    out.push({ ...s, startTime: start, endTime: end });
  }
  return out;
}

/** AudioAnalysisResult 全体にセクション・スナップを適用 */
export function applyDownbeatSnapToAnalysis(
  analysis: AudioAnalysisResult
): AudioAnalysisResult {
  return {
    ...analysis,
    sections: snapSectionsToDownbeats(
      analysis.sections,
      analysis.beats,
      analysis.duration
    ),
  };
}
