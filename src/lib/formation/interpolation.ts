/**
 * 再生補間ユーティリティ。
 * キュー区間は「立ち位置ホールド」、隣接キュー間は移動（明示ギャップ or 暗黙遷移）。
 */

import type { DancerSpot } from "../../types/choreography";

/** 既定の移動カウント（8カウント） */
export const DEFAULT_MOVE_COUNTS = 8;

/** これ未満の明示ギャップは「ほぼ隣接」とみなし、ホールド末尾から暗黙遷移を切る */
export const IMPLICIT_TRANSITION_GAP_EPS_SEC = 0.15;

/** 線形補間の進行度（0..1） */
export function clamp01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

export function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** progress = (currentTime - t1) / (t2 - t1) */
export function progressBetween(
  currentTime: number,
  t1: number,
  t2: number
): number {
  const span = t2 - t1;
  if (!(span > 1e-6)) return 1;
  return clamp01((currentTime - t1) / span);
}

/**
 * ホールド末尾から切り出す移動秒数。
 * - `moveInSec` があれば優先
 * - なければ BPM×8カウント（既定 BPM 120）
 * - ホールドの 45% を超えないようクランプ
 */
export function resolveMoveInSec(opts: {
  holdDurationSec: number;
  moveInSec?: number | null;
  bpm?: number | null;
}): number {
  const hold = Math.max(0, opts.holdDurationSec);
  if (!(hold > 1e-6)) return 0.35;
  const bpm =
    opts.bpm != null && Number.isFinite(opts.bpm) && opts.bpm! > 0
      ? opts.bpm!
      : 120;
  const fromCounts = (60 / bpm) * DEFAULT_MOVE_COUNTS;
  const preferred =
    opts.moveInSec != null &&
    Number.isFinite(opts.moveInSec) &&
    opts.moveInSec! > 0
      ? opts.moveInSec!
      : fromCounts;
  const maxFromHold = Math.max(0.35, hold * 0.45);
  return Math.min(Math.max(0.35, preferred), maxFromHold, 6);
}

export type TransitionWindow = {
  /** ホールド終了（＝移動開始） */
  holdEndSec: number;
  /** 次フォーメーション到着時刻 */
  arrivalSec: number;
  /** 明示ギャップか暗黙切出しか */
  kind: "explicit-gap" | "implicit-carve";
};

/**
 * 前キュー → 次キューの遷移窓。
 * 明示ギャップが十分あればそれを使い、隣接/微小ギャップなら前ホールド末尾を削る。
 */
export function resolveTransitionWindow(opts: {
  prevStartSec: number;
  prevEndSec: number;
  nextStartSec: number;
  moveInSec?: number | null;
  bpm?: number | null;
}): TransitionWindow {
  const arrival = opts.nextStartSec;
  const gapSpan = arrival - opts.prevEndSec;
  if (gapSpan > IMPLICIT_TRANSITION_GAP_EPS_SEC) {
    return {
      holdEndSec: opts.prevEndSec,
      arrivalSec: arrival,
      kind: "explicit-gap",
    };
  }
  const holdDur = Math.max(0, opts.prevEndSec - opts.prevStartSec);
  const moveIn = resolveMoveInSec({
    holdDurationSec: holdDur,
    moveInSec: opts.moveInSec,
    bpm: opts.bpm,
  });
  // 到着は次キュー開始。重なり時も nextStart に合わせる
  const holdEnd = Math.max(
    opts.prevStartSec + Math.min(0.08, holdDur * 0.2),
    arrival - moveIn
  );
  return {
    holdEndSec: Math.min(holdEnd, Math.max(opts.prevStartSec, arrival - 0.05)),
    arrivalSec: arrival,
    kind: "implicit-carve",
  };
}

/** 座標だけ線形補間（ID 対応）。経路ルートは gapDancerInterpolation 側。 */
export function lerpSpotsLinear(
  from: DancerSpot[],
  to: DancerSpot[],
  progress: number
): DancerSpot[] {
  const t = clamp01(progress);
  const toById = new Map(to.map((d) => [d.id, d] as const));
  const used = new Set<string>();
  const out: DancerSpot[] = [];
  for (const a of from) {
    const b = toById.get(a.id);
    if (!b) {
      out.push({ ...a });
      continue;
    }
    used.add(a.id);
    out.push({
      ...a,
      xPct: lerpNum(a.xPct, b.xPct, t),
      yPct: lerpNum(a.yPct, b.yPct, t),
      label: t < 0.5 ? a.label : b.label,
      colorIndex: t < 0.5 ? a.colorIndex : b.colorIndex,
    });
  }
  for (const b of to) {
    if (!used.has(b.id)) out.push({ ...b });
  }
  return out;
}
