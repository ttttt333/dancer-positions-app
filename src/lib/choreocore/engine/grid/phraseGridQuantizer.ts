/**
 * 枠数選定済みキューの rawTime を、8カウント頭（1カウント目）へスナップする。
 * promote / 枠数選定の後に掛け、プロモート近傍マッチを壊さない。
 */

import type { FormationCue } from "../types/CueTypes";

export type QuantizeCueTimingsInput = {
  cues: FormationCue[];
  bpm: number;
  durationSec: number;
  /** Phase1 の拍時刻（秒）。あれば優先して格子を作る */
  beats?: number[];
  /** 何拍ごとにスナップするか（既定: 8 = 8カウント頭） */
  phraseBeats?: number;
  /** 最短間隔拍数（既定: 16 = 2エイト） */
  minGapBeats?: number;
};

const SECTIONISH = /SECTION|PROMOTED|BOUNDARY|PRE_CHORUS|CHORUS|TENSION_CONTRACT/;

function isSectionBoundaryCue(cue: FormationCue): boolean {
  if (cue.isMajor) return true;
  return cue.reasonCodes.some((r) => SECTIONISH.test(r));
}

/**
 * 8カウント頭（1カウント目）のタイムスタンプ一覧を作成。
 */
export function buildPhraseTimestamps(params: {
  beats?: number[];
  bpm: number;
  durationSec: number;
  phraseBeats: number;
}): number[] {
  const { beats, bpm, durationSec, phraseBeats } = params;
  const step = Math.max(1, Math.round(phraseBeats));

  if (beats && beats.length > 0) {
    const sorted = [...beats]
      .filter((t) => Number.isFinite(t) && t >= 0)
      .sort((a, b) => a - b);
    const timestamps: number[] = [];
    for (let i = 0; i < sorted.length; i += step) {
      const t = sorted[i]!;
      if (t <= durationSec + 1e-6) timestamps.push(t);
    }
    if (timestamps.length === 0 || timestamps[0]! > 0.05) {
      timestamps.unshift(0);
    }
    return uniqueSorted(timestamps);
  }

  const secPerBeat = 60 / Math.max(30, bpm);
  const phraseSec = step * secPerBeat;
  const timestamps: number[] = [];
  for (let t = 0; t <= durationSec + 1e-9; t += phraseSec) {
    timestamps.push(Number(t.toFixed(4)));
  }
  return timestamps;
}

/**
 * 枠数選定済みキューの rawTime をフレーズ頭へスナップし、
 * 同一格子／最短2エイト未満の重複を整理する。
 */
export function quantizeCueTimings(
  input: QuantizeCueTimingsInput
): FormationCue[] {
  const {
    cues,
    bpm,
    durationSec,
    beats,
    phraseBeats = 8,
    minGapBeats = 16,
  } = input;

  if (!cues.length) return [];

  const validBpm = Math.max(30, bpm || 120);
  const secPerBeat = 60 / validBpm;
  const minGapSec = Math.max(0, minGapBeats) * secPerBeat;
  const duration = Math.max(0, durationSec);

  const phraseTimestamps = buildPhraseTimestamps({
    beats,
    bpm: validBpm,
    durationSec: duration,
    phraseBeats,
  });
  if (phraseTimestamps.length === 0) return cues.map((c) => ({ ...c }));

  const unsuppressed = cues
    .filter((c) => !c.suppressed)
    .sort((a, b) => a.rawTime - b.rawTime || a.id.localeCompare(b.id));
  const suppressed = cues.filter((c) => c.suppressed);

  const processed: FormationCue[] = [];
  let lastAcceptedTime = -Infinity;

  for (const cue of unsuppressed) {
    let snappedTime: number;
    if (cue.rawTime <= 0.5) {
      snappedTime = 0;
    } else {
      snappedTime = findClosestTimestamp(cue.rawTime, phraseTimestamps);
    }
    snappedTime = clamp(snappedTime, 0, duration);

    const timeFromLast = snappedTime - lastAcceptedTime;
    const boundary = isSectionBoundaryCue(cue);
    const sameSlot = timeFromLast < 1e-3;

    if (sameSlot) {
      if (!boundary && !cue.isMajor) continue;
      // 同一格子に重要キューが重なったら、直前を置き換える
      if (processed.length > 0) {
        processed.pop();
      }
    } else if (timeFromLast < minGapSec && !boundary) {
      continue;
    }

    processed.push({
      ...cue,
      rawTime: snappedTime,
      beatTime: snappedTime,
      reasonCodes: uniqueReasons([...cue.reasonCodes, "PHRASE_GRID_SNAP"]),
    });
    lastAcceptedTime = snappedTime;
  }

  return [...processed, ...suppressed].sort(
    (a, b) => a.rawTime - b.rawTime || a.id.localeCompare(b.id)
  );
}

export function findClosestTimestamp(target: number, list: number[]): number {
  if (list.length === 0) return target;
  let left = 0;
  let right = list.length - 1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    const v = list[mid]!;
    if (v === target) return v;
    if (v < target) left = mid + 1;
    else right = mid - 1;
  }
  const l = Math.max(0, right);
  const r = Math.min(list.length - 1, left);
  const a = list[l]!;
  const b = list[r]!;
  return Math.abs(a - target) <= Math.abs(b - target) ? a : b;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function uniqueSorted(xs: number[]): number[] {
  const out: number[] = [];
  for (const x of xs) {
    if (out.length === 0 || Math.abs(out[out.length - 1]! - x) > 1e-6) {
      out.push(x);
    }
  }
  return out;
}

function uniqueReasons(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}
