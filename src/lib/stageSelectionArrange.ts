import type { DancerSpot } from "../types/choreography";
import { gradeSortKey, skillSortKey } from "./rosterSortKeys";
import { minCostBipartiteAssignment } from "./minCostAssignment";
import {
  clusterSelectionByDepthRows,
  clusterSelectionByVerticalColumns,
} from "./stageColumnSwap";

export type PositionSortAxis = "height" | "grade" | "skill";
export type PositionSortScope = "all" | "row" | "col";
export type PositionSortDirection = "asc" | "desc";

export type PositionSortRequest = {
  axis: PositionSortAxis;
  scope: PositionSortScope;
  direction: PositionSortDirection;
};

function clampPct(v: number): number {
  return Math.max(0.25, Math.min(99.75, v));
}

function bboxOf(spots: DancerSpot[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const d of spots) {
    minX = Math.min(minX, d.xPct);
    maxX = Math.max(maxX, d.xPct);
    minY = Math.min(minY, d.yPct);
    maxY = Math.max(maxY, d.yPct);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 50, maxX: 50, minY: 50, maxY: 50, cx: 50, cy: 50 };
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

/** 右クリック対象と現在の選択から、操作の対象となる id 一覧 */
export function resolveArrangeTargetIds(
  clickedId: string,
  selectedIds: string[]
): string[] {
  if (selectedIds.includes(clickedId) && selectedIds.length > 0) {
    return [...selectedIds];
  }
  return [clickedId];
}

/**
 * 選んだちょうど 2 人の立ち位置（xPct / yPct）を交換する。
 * 人の属性（名前・色・向きなど）はそのまま、座標だけ入れ替える。
 */
export function swapTwoDancerPositions(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  if (targetIds.length !== 2) return dancers;
  const [idA, idB] = targetIds;
  if (!idA || !idB || idA === idB) return dancers;
  const a = dancers.find((d) => d.id === idA);
  const b = dancers.find((d) => d.id === idB);
  if (!a || !b) return dancers;
  const ax = clampPct(a.xPct);
  const ay = clampPct(a.yPct);
  const bx = clampPct(b.xPct);
  const by = clampPct(b.yPct);
  return dancers.map((d) => {
    if (d.id === idA) return { ...d, xPct: bx, yPct: by };
    if (d.id === idB) return { ...d, xPct: ax, yPct: ay };
    return d;
  });
}

/**
 * いまの立ち位置（スロット）はそのままに、誰がどこに立つかを入れ替える。
 * 各人の「前の立ち位置」から割当スロットまでの移動距離の総和が最小になるよう
 * 最小費用マッチングで割り当てる（前 Cue が無い人は現在位置を起点にする）。
 */
export function permuteSlotsMinimizeTravelFromPrev(
  dancers: DancerSpot[],
  targetIds: string[],
  prevDancers: readonly DancerSpot[] | null | undefined
): DancerSpot[] {
  if (!prevDancers || prevDancers.length === 0) return dancers;
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length < 2) return dancers;

  const prevById = new Map(prevDancers.map((d) => [d.id, d] as const));
  const slots = subset.map((d) => ({ xPct: d.xPct, yPct: d.yPct }));
  const cost: number[][] = subset.map((person) => {
    const from = prevById.get(person.id) ?? person;
    return slots.map((slot) => {
      const dx = from.xPct - slot.xPct;
      const dy = from.yPct - slot.yPct;
      return dx * dx + dy * dy;
    });
  });
  const assignment = minCostBipartiteAssignment(cost);
  const newPos = new Map<string, { xPct: number; yPct: number }>();
  for (let i = 0; i < subset.length; i++) {
    const slotIndex = assignment[i]!;
    if (slotIndex < 0) continue;
    const slot = slots[slotIndex]!;
    newPos.set(subset[i]!.id, {
      xPct: clampPct(slot.xPct),
      yPct: clampPct(slot.yPct),
    });
  }
  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

/**
 * 選択メンバーを重心まわりの角度で並べ、各スロットを右回り／左回りに 1 つずつずらす。
 */
export function rotateDancerRingOneStep(
  dancers: DancerSpot[],
  targetIds: string[],
  direction: "cw" | "ccw"
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length < 2) return dancers;

  const { cx, cy } = bboxOf(subset);
  const sorted = [...subset].sort((a, b) => {
    const ta = Math.atan2(a.yPct - cy, a.xPct - cx);
    const tb = Math.atan2(b.yPct - cy, b.xPct - cx);
    return ta - tb;
  });

  const slots = sorted.map((d) => ({ xPct: d.xPct, yPct: d.yPct }));
  const n = sorted.length;
  const newPos = new Map<string, { xPct: number; yPct: number }>();

  for (let i = 0; i < n; i++) {
    const id = sorted[i]!.id;
    const from =
      direction === "cw"
        ? slots[(i + 1) % n]!
        : slots[(i - 1 + n) % n]!;
    newPos.set(id, {
      xPct: clampPct(from.xPct),
      yPct: clampPct(from.yPct),
    });
  }

  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

function heightCmp(a: DancerSpot, b: DancerSpot): number {
  const ha = a.heightCm;
  const hb = b.heightCm;
  if (ha == null && hb == null) return 0;
  if (ha == null) return 1;
  if (hb == null) return -1;
  return ha - hb;
}

/** いまの印の座標を左→右、上（奥）→下（手前）の順で並べたときの「位置スロット」順 */
function slotOrderCmp(a: DancerSpot, b: DancerSpot): number {
  const dx = a.xPct - b.xPct;
  if (Math.abs(dx) > 1e-6) return dx;
  const dy = a.yPct - b.yPct;
  if (Math.abs(dy) > 1e-6) return dy;
  return a.id.localeCompare(b.id);
}

/**
 * 一段内のスロットをセンター寄り順に並べる。
 * - センター（段の x 中点）に近いほど先
 * - 距離が同じ（センター割れ）なら下手（x 小）側を先
 */
function orderSlotsCenterOutInRow(row: DancerSpot[]): DancerSpot[] {
  if (row.length <= 1) return [...row];
  const { cx } = bboxOf(row);
  return [...row].sort((a, b) => {
    const da = Math.abs(a.xPct - cx);
    const db = Math.abs(b.xPct - cx);
    if (Math.abs(da - db) > 1e-6) return da - db;
    const dx = a.xPct - b.xPct;
    if (Math.abs(dx) > 1e-6) return dx;
    return a.id.localeCompare(b.id);
  });
}

/**
 * スキル用スロット順: 一列目（手前）から、各段はセンター寄り（割れは下手）。
 * 先頭スロットにスキル番号が小さい人が入る。
 */
function orderSlotsForSkill(subset: DancerSpot[]): DancerSpot[] {
  if (subset.length <= 1) return [...subset];
  const rows = clusterSelectionByDepthRows(
    subset,
    subset.map((d) => d.id)
  );
  const ordered: DancerSpot[] = [];
  for (const row of rows) {
    ordered.push(...orderSlotsCenterOutInRow(row));
  }
  return ordered;
}

/**
 * 選択メンバーの **位置の集合** はそのままに、誰がどの座標に立つかだけ入れ替える。
 * `sortPeople` で並べた人を、スロット順の位置に順に割り当てる。
 */
function permutePreservingSlotPositions(
  dancers: DancerSpot[],
  targetIds: string[],
  sortPeople: (a: DancerSpot, b: DancerSpot) => number,
  slotCmp: (a: DancerSpot, b: DancerSpot) => number = slotOrderCmp,
  orderSlots?: (subset: DancerSpot[]) => DancerSpot[]
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length <= 1) return dancers;

  const slotsOrdered = orderSlots
    ? orderSlots(subset)
    : [...subset].sort(slotCmp);
  const peopleOrdered = [...subset].sort(sortPeople);
  const newPos = new Map<string, { xPct: number; yPct: number }>();
  for (let i = 0; i < subset.length; i++) {
    const slot = slotsOrdered[i]!;
    const person = peopleOrdered[i]!;
    newPos.set(person.id, {
      xPct: clampPct(slot.xPct),
      yPct: clampPct(slot.yPct),
    });
  }
  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

/** 今の位置のまま・身長の低い人が左寄りの位置へ */
export function permuteSlotsByHeightAsc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  return permutePreservingSlotPositions(dancers, targetIds, (a, b) => {
    const h = heightCmp(a, b);
    if (h !== 0) return h;
    return a.label.localeCompare(b.label, "ja");
  });
}

export function permuteSlotsByHeightDesc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  return permutePreservingSlotPositions(dancers, targetIds, (a, b) => {
    const h = heightCmp(a, b);
    if (h !== 0) return -h;
    return a.label.localeCompare(b.label, "ja");
  });
}

/** 今の位置のまま・学年が若い順（名簿の学年キー昇順） */
export function permuteSlotsByGradeAsc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  return permutePreservingSlotPositions(dancers, targetIds, (a, b) =>
    gradeSortKey(a.gradeLabel) - gradeSortKey(b.gradeLabel) ||
    a.label.localeCompare(b.label, "ja")
  );
}

export function permuteSlotsByGradeDesc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  return permutePreservingSlotPositions(dancers, targetIds, (a, b) =>
    gradeSortKey(b.gradeLabel) - gradeSortKey(a.gradeLabel) ||
    a.label.localeCompare(b.label, "ja")
  );
}

/** 今の位置のまま・スキル数字が小さい人を一列目センター寄りへ */
export function permuteSlotsBySkillAsc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  return permutePreservingSlotPositions(
    dancers,
    targetIds,
    (a, b) =>
      skillSortKey(a.skillRankLabel) - skillSortKey(b.skillRankLabel) ||
      a.label.localeCompare(b.label, "ja"),
    slotOrderCmp,
    orderSlotsForSkill
  );
}

export function permuteSlotsBySkillDesc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  return permutePreservingSlotPositions(
    dancers,
    targetIds,
    (a, b) =>
      skillSortKey(b.skillRankLabel) - skillSortKey(a.skillRankLabel) ||
      a.label.localeCompare(b.label, "ja"),
    slotOrderCmp,
    orderSlotsForSkill
  );
}

/** 身長の低い順（未入力は後ろ）で横一列（平均 y） */
export function lineUpByHeightAsc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length === 0) return dancers;

  const sorted = [...subset].sort(heightCmp);
  const { minX, maxX, cy } = bboxOf(subset);
  const n = sorted.length;
  const newPos = new Map<string, { xPct: number; yPct: number }>();

  if (n === 1) {
    newPos.set(sorted[0]!.id, {
      xPct: clampPct((minX + maxX) / 2),
      yPct: clampPct(cy),
    });
  } else {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const x = minX + (maxX - minX) * t;
      newPos.set(sorted[i]!.id, {
        xPct: clampPct(x),
        yPct: clampPct(cy),
      });
    }
  }

  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

/** 身長の高い順で横一列 */
export function lineUpByHeightDesc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length === 0) return dancers;

  const sorted = [...subset].sort((a, b) => -heightCmp(a, b));
  const { minX, maxX, cy } = bboxOf(subset);
  const n = sorted.length;
  const newPos = new Map<string, { xPct: number; yPct: number }>();

  if (n === 1) {
    newPos.set(sorted[0]!.id, {
      xPct: clampPct((minX + maxX) / 2),
      yPct: clampPct(cy),
    });
  } else {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = minX + (maxX - minX) * t;
      newPos.set(sorted[i]!.id, {
        xPct: clampPct(x),
        yPct: clampPct(cy),
      });
    }
  }

  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

/** 学年が低い（若い）順で横一列（平均 y）。未入力は後方 */
export function lineUpByGradeAsc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length === 0) return dancers;

  const sorted = [...subset].sort(
    (a, b) =>
      gradeSortKey(a.gradeLabel) - gradeSortKey(b.gradeLabel) ||
      a.label.localeCompare(b.label, "ja")
  );
  const { minX, maxX, cy } = bboxOf(subset);
  const n = sorted.length;
  const newPos = new Map<string, { xPct: number; yPct: number }>();

  if (n === 1) {
    newPos.set(sorted[0]!.id, {
      xPct: clampPct((minX + maxX) / 2),
      yPct: clampPct(cy),
    });
  } else {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = minX + (maxX - minX) * t;
      newPos.set(sorted[i]!.id, {
        xPct: clampPct(x),
        yPct: clampPct(cy),
      });
    }
  }

  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

/** 学年が高い順（キー大きい方が左）で横一列 */
export function lineUpByGradeDesc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length === 0) return dancers;

  const sorted = [...subset].sort(
    (a, b) =>
      gradeSortKey(b.gradeLabel) - gradeSortKey(a.gradeLabel) ||
      a.label.localeCompare(b.label, "ja")
  );
  const { minX, maxX, cy } = bboxOf(subset);
  const n = sorted.length;
  const newPos = new Map<string, { xPct: number; yPct: number }>();

  if (n === 1) {
    newPos.set(sorted[0]!.id, {
      xPct: clampPct((minX + maxX) / 2),
      yPct: clampPct(cy),
    });
  } else {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = minX + (maxX - minX) * t;
      newPos.set(sorted[i]!.id, {
        xPct: clampPct(x),
        yPct: clampPct(cy),
      });
    }
  }

  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

/**
 * スキル表記の数字が小さい人を奥（y が小さい＝画面上側）へ。
 * 数字が大きいほど手前（客席側＝y 大）。未入力は手前寄り。
 */
export function lineUpBySkillSmallToBack(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length === 0) return dancers;

  const sorted = [...subset].sort(
    (a, b) =>
      skillSortKey(a.skillRankLabel) - skillSortKey(b.skillRankLabel) ||
      a.label.localeCompare(b.label, "ja")
  );
  const { minY, maxY, cx } = bboxOf(subset);
  const n = sorted.length;
  const newPos = new Map<string, { xPct: number; yPct: number }>();

  if (n === 1) {
    newPos.set(sorted[0]!.id, {
      xPct: clampPct(cx),
      yPct: clampPct((minY + maxY) / 2),
    });
  } else {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      /** i=0 がスキル数字が最も小さい（上手）→ 奥 minY（画面上側） */
      const y = minY + (maxY - minY) * t;
      newPos.set(sorted[i]!.id, {
        xPct: clampPct(cx),
        yPct: clampPct(y),
      });
    }
  }

  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

/**
 * スキル数字が大きい人を奥へ（数字が小さい＝上手が手前 y 大）。
 */
export function lineUpBySkillLargeToBack(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length === 0) return dancers;

  const sorted = [...subset].sort(
    (a, b) =>
      skillSortKey(b.skillRankLabel) - skillSortKey(a.skillRankLabel) ||
      a.label.localeCompare(b.label, "ja")
  );
  const { minY, maxY, cx } = bboxOf(subset);
  const n = sorted.length;
  const newPos = new Map<string, { xPct: number; yPct: number }>();

  if (n === 1) {
    newPos.set(sorted[0]!.id, {
      xPct: clampPct(cx),
      yPct: clampPct((minY + maxY) / 2),
    });
  } else {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = minY + (maxY - minY) * t;
      newPos.set(sorted[i]!.id, {
        xPct: clampPct(cx),
        yPct: clampPct(y),
      });
    }
  }

  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

function peopleSortCmp(
  axis: PositionSortAxis,
  direction: PositionSortDirection
): (a: DancerSpot, b: DancerSpot) => number {
  const sign = direction === "asc" ? 1 : -1;
  return (a, b) => {
    let raw = 0;
    if (axis === "height") raw = heightCmp(a, b);
    else if (axis === "grade") {
      raw = gradeSortKey(a.gradeLabel) - gradeSortKey(b.gradeLabel);
    } else {
      raw = skillSortKey(a.skillRankLabel) - skillSortKey(b.skillRankLabel);
    }
    if (raw !== 0) return raw * sign;
    return a.label.localeCompare(b.label, "ja");
  };
}

function lineUpAlongAxis(
  dancers: DancerSpot[],
  targetIds: string[],
  sortPeople: (a: DancerSpot, b: DancerSpot) => number,
  along: "x" | "y",
  options: {
    /** true のとき先頭を手前 y 大へ（スキル縦列） */
    frontFirstOnY?: boolean;
    /** true のとき横一列をセンター寄り割当（スキル横列） */
    centerOutOnX?: boolean;
  } = {}
): DancerSpot[] {
  const { frontFirstOnY = false, centerOutOnX = false } = options;
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length <= 1) return dancers;

  const sorted = [...subset].sort(sortPeople);
  const box = bboxOf(subset);
  const n = sorted.length;
  const newPos = new Map<string, { xPct: number; yPct: number }>();

  if (along === "x" && centerOutOnX) {
    const xs = Array.from({ length: n }, (_, i) =>
      n === 1 ? box.cx : box.minX + ((box.maxX - box.minX) * i) / (n - 1)
    );
    const cx = box.cx;
    const slotOrder = xs
      .map((x, index) => ({ x, index }))
      .sort((a, b) => {
        const da = Math.abs(a.x - cx);
        const db = Math.abs(b.x - cx);
        if (Math.abs(da - db) > 1e-9) return da - db;
        return a.x - b.x;
      });
    for (let i = 0; i < n; i++) {
      newPos.set(sorted[i]!.id, {
        xPct: clampPct(slotOrder[i]!.x),
        yPct: clampPct(box.cy),
      });
    }
  } else {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      if (along === "x") {
        newPos.set(sorted[i]!.id, {
          xPct: clampPct(box.minX + (box.maxX - box.minX) * t),
          yPct: clampPct(box.cy),
        });
      } else {
        const y = frontFirstOnY
          ? box.maxY - (box.maxY - box.minY) * t
          : box.minY + (box.maxY - box.minY) * t;
        newPos.set(sorted[i]!.id, {
          xPct: clampPct(box.cx),
          yPct: clampPct(y),
        });
      }
    }
  }
  return dancers.map((d) => {
    const np = newPos.get(d.id);
    if (!np) return d;
    return { ...d, xPct: np.xPct, yPct: np.yPct };
  });
}

/**
 * 選択メンバーを軸×範囲×方向で並べ替える。
 * - all: 位置の集合はそのまま人だけ割当（旧「位置のまま入替」）
 * - row: Y で段を分け、各段を横一列として独立に並べる
 * - col: X で縦列を分け、各列を縦一列として独立に並べる
 *
 * スキルは数字が小さい人を一列目センター寄り（割れは下手）へ。
 */
export function applyPositionSort(
  dancers: DancerSpot[],
  targetIds: string[],
  request: PositionSortRequest
): DancerSpot[] {
  if (targetIds.length < 2) return dancers;
  const cmp = peopleSortCmp(request.axis, request.direction);
  const skillCenter = request.axis === "skill";
  if (request.scope === "all") {
    return permutePreservingSlotPositions(
      dancers,
      targetIds,
      cmp,
      slotOrderCmp,
      skillCenter ? orderSlotsForSkill : undefined
    );
  }
  const groups =
    request.scope === "row"
      ? clusterSelectionByDepthRows(dancers, targetIds)
      : clusterSelectionByVerticalColumns(dancers, targetIds);
  const along = request.scope === "row" ? "x" : "y";
  let next = dancers;
  for (const group of groups) {
    if (group.length < 2) continue;
    next = lineUpAlongAxis(next, group.map((d) => d.id), cmp, along, {
      frontFirstOnY: skillCenter && along === "y",
      centerOutOnX: skillCenter && along === "x",
    });
  }
  return next;
}

const AXIS_LABEL: Record<PositionSortAxis, string> = {
  height: "身長",
  grade: "学年",
  skill: "スキル",
};

const SCOPE_LABEL: Record<PositionSortScope, string> = {
  all: "全体",
  row: "横一列",
  col: "縦一列",
};

const DIRECTION_LABEL: Record<
  PositionSortAxis,
  Record<PositionSortDirection, string>
> = {
  height: { asc: "低い順", desc: "高い順" },
  grade: { asc: "低学年から", desc: "高学年から" },
  skill: { asc: "小さい順", desc: "大きい順" },
};

export function formatPositionSortPreview(request: PositionSortRequest): string {
  const axis = AXIS_LABEL[request.axis];
  const dir = DIRECTION_LABEL[request.axis][request.direction];
  const scope = SCOPE_LABEL[request.scope];
  return `${axis}が${dir}、${scope}で並べ替えます`;
}

export function positionSortDirectionLabels(axis: PositionSortAxis): {
  asc: string;
  desc: string;
} {
  return DIRECTION_LABEL[axis];
}
