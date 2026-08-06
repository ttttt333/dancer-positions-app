/**
 * 解析で得た多数の変化点から、目標キュー数に収まるよう重要点を選定する。
 * セクション境界を優先して曲の切れ目に合わせる。
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

export type SectionAnchor = {
  startSec: number;
  endSec: number;
  avgEnergy: number;
  label?: string;
};

/** 曲長からおすすめキュー数（開始含む） */
export function suggestedCueCountForDuration(durationSec: number): number {
  const sec = Math.max(30, durationSec || 180);
  const raw = Math.round(sec / 22);
  const clamped = Math.min(
    AI_SUGGEST_CUE_MAX,
    Math.max(AI_SUGGEST_CUE_MIN, raw)
  );
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
  let w = TIER_WEIGHT[cp.tier] * 10 + (Number.isFinite(cp.score) ? cp.score : 0);
  if (cp.section_type === "CHORUS_START") w += 40;
  else if (cp.section_type === "CHORUS") w += 15;
  // 4エイト境界を優遇
  if (cp.eight_index % 4 === 0) w += 5;
  return w;
}

function samePoint(a: ChangePoint, b: ChangePoint): boolean {
  return a.eight_index === b.eight_index && Math.abs(a.time - b.time) < 0.05;
}

function tierFromEnergy(e: number): ChangeTier {
  if (e >= 0.62) return "major";
  if (e >= 0.38) return "medium";
  return "minor";
}

/** セクション開始を変化点候補として合成（t=0 は開始キューがあるので除外） */
function sectionBoundaryPoints(
  sections: SectionAnchor[],
  durationSec: number
): ChangePoint[] {
  const out: ChangePoint[] = [];
  for (const s of sections) {
    const t = s.startSec;
    if (t < 2.5 || t > durationSec - 1.5) continue;
    out.push({
      eight_index: Math.max(0, Math.round(t / 4)),
      time: t,
      score: Math.min(1, 0.45 + s.avgEnergy * 0.55),
      tier: tierFromEnergy(s.avgEnergy),
    });
  }
  return out;
}

/**
 * 目標キュー数（開始含む）に合わせて変化点を間引く。
 * セクション境界を最優先し、残りを novelty 高スコアで埋める。
 */
export function selectChangePointsForCueCount(
  changePoints: ChangePoint[],
  targetCueCount: number,
  durationSec: number,
  sections?: SectionAnchor[]
): ChangePoint[] {
  const target = clampTargetCueCount(targetCueCount);
  const want = Math.max(0, target - 1);
  if (want === 0) return [];

  const duration = Math.max(durationSec, 30);
  const minGap = Math.max(4, (duration / (want + 1)) * 0.6);

  const boundary = sections?.length
    ? sectionBoundaryPoints(sections, duration)
    : [];
  const merged = [...boundary, ...changePoints];
  if (merged.length === 0) return [];

  // 近い時刻を統合（境界側を優先）
  const byTime = [...merged].sort((a, b) => a.time - b.time);
  const dedup: ChangePoint[] = [];
  for (const p of byTime) {
    const near = dedup.find((q) => Math.abs(q.time - p.time) < 2.0);
    if (!near) {
      dedup.push(p);
      continue;
    }
    // 境界由来（score 高め or 既存より important）なら置換
    if (importance(p) > importance(near)) {
      const idx = dedup.indexOf(near);
      dedup[idx] = p;
    }
  }

  if (dedup.length <= want) return dedup.sort((a, b) => a.time - b.time);

  const picked: ChangePoint[] = [];

  // 1) セクション境界を先に確保
  const boundariesRanked = [...boundary].sort(
    (a, b) => importance(b) - importance(a)
  );
  for (const p of boundariesRanked) {
    if (picked.length >= want) break;
    if (picked.some((q) => Math.abs(q.time - p.time) < minGap)) continue;
    // dedup に残っているものだけ
    if (!dedup.some((d) => Math.abs(d.time - p.time) < 0.5)) continue;
    picked.push(p);
  }

  // 2) 残りを novelty で埋める
  const ranked = [...dedup].sort((a, b) => importance(b) - importance(a));
  for (const gap of [minGap, minGap * 0.5, 2.5]) {
    for (const p of ranked) {
      if (picked.length >= want) break;
      if (picked.some((q) => Math.abs(q.time - p.time) < gap || samePoint(q, p))) {
        continue;
      }
      picked.push(p);
    }
    if (picked.length >= want) break;
  }

  return picked.sort((a, b) => a.time - b.time).slice(0, want);
}
