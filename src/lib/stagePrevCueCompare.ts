import type { Cue, DancerSpot, Formation } from "../types/choreography";
import { cueNumberById, sortCuesByStart } from "./cueInterval";
import { classifyMovementCostPct } from "./stageMovementGrade";
import { movementCostPct } from "./stageShapeGenerator";

/** この距離未満（ステージ%）は静止とみなして ○ を出さない */
export const PREV_CUE_COMPARE_MOVE_EPS_PCT = 1.2;

export type PrevCueCompareMark = {
  dancerId: string;
  colorIndex: number;
  fromXPct: number;
  fromYPct: number;
  toXPct: number;
  toYPct: number;
};

/** 選択中 Cue の直前 Cue の dancers。先頭 Cue / 不明なら null。配列は参照のみ。 */
export function resolvePreviousCueDancers(
  cues: Cue[],
  formations: Formation[],
  currentCueId: string | null | undefined
): DancerSpot[] | null {
  if (!currentCueId) return null;
  const sorted = sortCuesByStart(cues);
  const i = sorted.findIndex((c) => c.id === currentCueId);
  if (i <= 0) return null;
  const prev = sorted[i - 1]!;
  const f = formations.find((x) => x.id === prev.formationId);
  return f?.dancers ?? null;
}

/** 直前 Cue の 1 始まり番号。先頭 Cue / 不明なら null。 */
export function resolvePreviousCueOrdinal(
  cues: Cue[],
  currentCueId: string | null | undefined
): number | null {
  const n = cueNumberById(cues, currentCueId);
  if (n == null || n <= 1) return null;
  return n - 1;
}

/**
 * 前 Cue と現 Cue を dancer id で対応付ける。
 * dancers[] の順番は見ない。入力配列は変更しない。
 */
export function buildPrevCueCompareMarks(opts: {
  prevDancers: readonly DancerSpot[];
  currentDancers: readonly DancerSpot[];
  moveEpsPct?: number;
}): PrevCueCompareMark[] {
  const eps = opts.moveEpsPct ?? PREV_CUE_COMPARE_MOVE_EPS_PCT;
  const currentById = new Map(opts.currentDancers.map((d) => [d.id, d] as const));
  const marks: PrevCueCompareMark[] = [];
  for (const prev of opts.prevDancers) {
    const cur = currentById.get(prev.id);
    if (!cur) continue;
    const dist = movementCostPct(
      { xPct: prev.xPct, yPct: prev.yPct },
      { xPct: cur.xPct, yPct: cur.yPct }
    );
    if (dist < eps) continue;
    marks.push({
      dancerId: prev.id,
      colorIndex: cur.colorIndex,
      fromXPct: prev.xPct,
      fromYPct: prev.yPct,
      toXPct: cur.xPct,
      toYPct: cur.yPct,
    });
  }
  return marks;
}

export type PrevCueCompareSummary = {
  matchedCount: number;
  movedCount: number;
  stillCount: number;
  smallCount: number;
  mediumCount: number;
  largeCount: number;
  maxMovePct: number;
};

/**
 * 前 Cue との差分サマリー。座標は既存 movementCostPct。
 * 小/中/大 は classifyMovementCostPct（表示用・将来変更可）。
 */
export function summarizePrevCueCompare(opts: {
  prevDancers: readonly DancerSpot[];
  currentDancers: readonly DancerSpot[];
  moveEpsPct?: number;
}): PrevCueCompareSummary {
  const eps = opts.moveEpsPct ?? PREV_CUE_COMPARE_MOVE_EPS_PCT;
  const currentById = new Map(
    opts.currentDancers.map((d) => [d.id, d] as const)
  );
  let matchedCount = 0;
  let movedCount = 0;
  let stillCount = 0;
  let smallCount = 0;
  let mediumCount = 0;
  let largeCount = 0;
  let maxMovePct = 0;
  for (const prev of opts.prevDancers) {
    const cur = currentById.get(prev.id);
    if (!cur) continue;
    matchedCount += 1;
    const cost = movementCostPct(
      { xPct: prev.xPct, yPct: prev.yPct },
      { xPct: cur.xPct, yPct: cur.yPct }
    );
    if (cost < eps) {
      stillCount += 1;
      continue;
    }
    movedCount += 1;
    if (cost > maxMovePct) maxMovePct = cost;
    const grade = classifyMovementCostPct(cost);
    if (grade === "小") smallCount += 1;
    else if (grade === "中") mediumCount += 1;
    else largeCount += 1;
  }
  return {
    matchedCount,
    movedCount,
    stillCount,
    smallCount,
    mediumCount,
    largeCount,
    maxMovePct,
  };
}
