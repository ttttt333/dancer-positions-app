/**
 * 解析で得た多数の変化点から、目標キュー数に収まるよう重要点を選定する。
 * 生成側は「開始 + 変化点」でキューを作るため、選定数 = targetCueCount - 1。
 */

import type { ChangePoint, ChangeTier } from "./types";

const TIER_WEIGHT: Record<ChangeTier, number> = {
  major: 3,
  medium: 2,
  minor: 1,
};

export const AI_SUGGEST_CUE_PRESETS = [6, 8, 12, 16, 20] as const;
export const AI_SUGGEST_CUE_MIN = 3;
export const AI_SUGGEST_CUE_MAX = 40;

/** 曲長からおすすめキュー数（開始含む） */
export function suggestedCueCountForDuration(durationSec: number): number {
  const sec = Math.max(30, durationSec || 180);
  // だいたい 20〜25 秒に1キュー
  const raw = Math.round(sec / 22);
  const clamped = Math.min(
    AI_SUGGEST_CUE_MAX,
    Math.max(AI_SUGGEST_CUE_MIN, raw)
  );
  // 近いプリセットへ寄せる
  let best: number = AI_SUGGEST_CUE_PRESETS[0]!;
  let bestDist = Math.abs(best - clamped);
  for (const p of AI_SUGGEST_CUE_PRESETS) {
    const d = Math.abs(p - clamped);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function clampTargetCueCount(n: number): number {
  if (!Number.isFinite(n)) return suggestedCueCountForDuration(180);
  return Math.min(
    AI_SUGGEST_CUE_MAX,
    Math.max(AI_SUGGEST_CUE_MIN, Math.round(n))
  );
}

function importance(cp: ChangePoint): number {
  return TIER_WEIGHT[cp.tier] * 10 + (Number.isFinite(cp.score) ? cp.score : 0);
}

function samePoint(a: ChangePoint, b: ChangePoint): boolean {
  return a.eight_index === b.eight_index && Math.abs(a.time - b.time) < 0.05;
}

/**
 * 目標キュー数（開始含む）に合わせて変化点を間引く。
 * major / 高スコアを優先し、曲全体にばらけさせる。
 */
export function selectChangePointsForCueCount(
  changePoints: ChangePoint[],
  targetCueCount: number,
  durationSec: number
): ChangePoint[] {
  const target = clampTargetCueCount(targetCueCount);
  const want = Math.max(0, target - 1); // 開始キューを除く
  if (want === 0 || changePoints.length === 0) return [];

  const sorted = [...changePoints].sort((a, b) => a.time - b.time);
  if (sorted.length <= want) return sorted;

  const duration = Math.max(
    durationSec,
    sorted[sorted.length - 1]!.time + 1,
    30
  );
  const minGap = Math.max(3.5, (duration / (want + 1)) * 0.55);

  const ranked = [...sorted].sort((a, b) => importance(b) - importance(a));

  const pickWithGap = (gap: number): ChangePoint[] => {
    const picked: ChangePoint[] = [];
    for (const p of ranked) {
      if (picked.length >= want) break;
      if (picked.some((q) => Math.abs(q.time - p.time) < gap)) continue;
      picked.push(p);
    }
    return picked;
  };

  let picked = pickWithGap(minGap);
  if (picked.length < want) {
    picked = pickWithGap(minGap * 0.45);
  }
  if (picked.length < want) {
    for (const p of ranked) {
      if (picked.length >= want) break;
      if (picked.some((q) => samePoint(q, p))) continue;
      picked.push(p);
    }
  }

  return picked.sort((a, b) => a.time - b.time);
}
