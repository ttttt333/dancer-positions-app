/**
 * 前隊列 → 次テンプレ位置への最小総移動距離マッチング（Hungarian）
 */

import { minCostBipartiteAssignment } from "../minCostAssignment";
import type { Formation, Position } from "./types";

function dist2(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function genId(): string {
  return (
    crypto.randomUUID?.() ??
    `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

/**
 * prev の各パフォーマーを nextTemplatePositions に最小総移動で割り当てる。
 * 人数が違う場合は少ない側に合わせ、余剰スロットは仮 id で埋める。
 */
export function assignPerformers(
  prev: Formation,
  nextTemplatePositions: Position[]
): Formation {
  const nPrev = prev.performers.length;
  const nNext = nextTemplatePositions.length;
  if (nNext === 0) {
    return { id: genId(), performers: [] };
  }
  if (nPrev === 0) {
    return {
      id: genId(),
      performers: nextTemplatePositions.map((position, i) => ({
        id: `p${i}`,
        position: { ...position },
      })),
    };
  }

  const nRows = Math.min(nPrev, nNext);
  const cost: number[][] = [];
  for (let i = 0; i < nRows; i++) {
    const from = prev.performers[i]!.position;
    const row: number[] = [];
    for (let j = 0; j < nNext; j++) {
      row.push(dist2(from, nextTemplatePositions[j]!));
    }
    cost.push(row);
  }

  const assignment = minCostBipartiteAssignment(cost);
  const usedSlots = new Set<number>();
  const performers: Formation["performers"] = nextTemplatePositions.map(
    (position, j) => ({
      id: `__slot_${j}`,
      position: { ...position },
    })
  );

  for (let i = 0; i < assignment.length; i++) {
    const slot = assignment[i]!;
    if (slot < 0 || slot >= nNext) continue;
    usedSlots.add(slot);
    const src = prev.performers[i]!;
    performers[slot] = {
      id: src.id,
      position: { ...nextTemplatePositions[slot]! },
    };
  }

  // 余った prev を未使用スロットへ
  let pi = nRows;
  for (let j = 0; j < nNext; j++) {
    if (usedSlots.has(j)) continue;
    const src = prev.performers[pi++];
    if (!src) break;
    performers[j] = {
      id: src.id,
      position: { ...nextTemplatePositions[j]! },
    };
    usedSlots.add(j);
  }

  return { id: genId(), performers };
}

/**
 * 左→右の並び順を保った割り当て（実践的な隊列転換向け）。
 * Hungarian の入れ替えを避け、誰が端か中央かが崩れにくい。
 */
export function assignPerformersOrdered(
  prev: Formation,
  nextTemplatePositions: Position[]
): Formation {
  const n = Math.min(prev.performers.length, nextTemplatePositions.length);
  if (n === 0) {
    return { id: genId(), performers: [] };
  }
  const sortedPeople = [...prev.performers].sort(
    (a, b) =>
      a.position.x - b.position.x || a.position.y - b.position.y
  );
  const sortedSlots = [...nextTemplatePositions]
    .slice(0, n)
    .sort((a, b) => a.x - b.x || a.y - b.y);

  return {
    id: genId(),
    performers: sortedPeople.slice(0, n).map((p, i) => ({
      id: p.id,
      position: { ...sortedSlots[i]! },
    })),
  };
}

/** 同一 id 同士の総移動距離(m) */
export function totalTravelMeters(prev: Formation, next: Formation): number {
  const byId = new Map(next.performers.map((p) => [p.id, p] as const));
  let sum = 0;
  for (const a of prev.performers) {
    const b = byId.get(a.id);
    if (!b) continue;
    sum += Math.hypot(
      a.position.x - b.position.x,
      a.position.y - b.position.y
    );
  }
  return sum;
}

/** 各パフォーマーの最大移動距離(m) */
export function maxTravelMeters(prev: Formation, next: Formation): number {
  const byId = new Map(next.performers.map((p) => [p.id, p] as const));
  let max = 0;
  for (const a of prev.performers) {
    const b = byId.get(a.id);
    if (!b) continue;
    const d = Math.hypot(
      a.position.x - b.position.x,
      a.position.y - b.position.y
    );
    if (d > max) max = d;
  }
  return max;
}
