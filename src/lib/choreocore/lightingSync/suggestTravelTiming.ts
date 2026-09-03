/**
 * AI 提案のキュー間隔。再生は [tStart, tEnd] で静止し、
 * 次の tStart までの隙間だけ移動する。
 * 立ち位置の移動は変化の 4 カウント前から始め、変化点で新隊形に着く。
 */

export const FORMATION_TRAVEL_COUNTS = 4;
export const FORMATION_MIN_HOLD_COUNTS = 4;

export function secPerCount(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

export function travelDurationSec(bpm: number): number {
  return secPerCount(bpm) * FORMATION_TRAVEL_COUNTS;
}

export function minHoldDurationSec(bpm: number): number {
  return secPerCount(bpm) * FORMATION_MIN_HOLD_COUNTS;
}

/** 変化点同士の最短間隔（キープ 4 + 移動 4） */
export function minHitGapSec(bpm: number): number {
  return secPerCount(bpm) * (FORMATION_TRAVEL_COUNTS + FORMATION_MIN_HOLD_COUNTS);
}

export type CueTimeWindow = {
  tStartSec: number;
  tEndSec: number;
};

function roundCueSec(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 変化点の時刻列 → キープ区間。
 * 各隊形は hit で着き、次の hit の 4 カウント前までキープする。
 */
export function cueWindowsForHits(
  hitTimes: number[],
  durationSec: number,
  bpm: number
): CueTimeWindow[] {
  const duration = Math.max(0, durationSec);
  const travel = travelDurationSec(bpm);
  const minHold = minHoldDurationSec(bpm);
  return hitTimes.map((raw, i) => {
    const tStart = roundCueSec(Math.min(duration, Math.max(0, raw)));
    const next = hitTimes[i + 1];
    const tEndRaw =
      next == null
        ? Math.max(tStart + minHold, duration)
        : Math.max(tStart + minHold, next - travel);
    const tEnd = roundCueSec(Math.min(duration, Math.max(tStart + 0.5, tEndRaw)));
    return { tStartSec: tStart, tEndSec: tEnd };
  });
}

/**
 * 隣り合うキューが移動 4 カウントを食わないよう、終端を押し戻す。
 */
export function ensureTravelGaps<T extends { tStartSec: number; tEndSec: number }>(
  cues: T[],
  bpm: number
): T[] {
  const travel = travelDurationSec(bpm);
  const out = cues.map((c) => ({ ...c }));
  for (let i = 0; i < out.length - 1; i += 1) {
    const cur = out[i]!;
    const next = out[i + 1]!;
    const maxEnd = roundCueSec(next.tStartSec - travel);
    if (cur.tEndSec > maxEnd + 1e-6) {
      cur.tEndSec = Math.max(roundCueSec(cur.tStartSec + 0.5), maxEnd);
    }
  }
  return out.filter((c) => c.tEndSec > c.tStartSec + 1e-6);
}
