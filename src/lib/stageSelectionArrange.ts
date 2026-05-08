import type { DancerSpot } from "../types/choreography";
import { gradeSortKey, skillSortKey } from "./rosterSortKeys";

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
 * 選択メンバーの **位置の集合** はそのままに、誰がどの座標に立つかだけ入れ替える。
 * `sortPeople` で並べた人を、スロット順（左から・上から）の位置に順に割り当てる。
 */
function permutePreservingSlotPositions(
  dancers: DancerSpot[],
  targetIds: string[],
  sortPeople: (a: DancerSpot, b: DancerSpot) => number
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length <= 1) return dancers;

  const slotsOrdered = [...subset].sort(slotOrderCmp);
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

/** 今の位置のまま・スキル数字が小さい人が左寄りの位置へ */
export function permuteSlotsBySkillAsc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  return permutePreservingSlotPositions(dancers, targetIds, (a, b) =>
    skillSortKey(a.skillRankLabel) - skillSortKey(b.skillRankLabel) ||
    a.label.localeCompare(b.label, "ja")
  );
}

export function permuteSlotsBySkillDesc(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  return permutePreservingSlotPositions(dancers, targetIds, (a, b) =>
    skillSortKey(b.skillRankLabel) - skillSortKey(a.skillRankLabel) ||
    a.label.localeCompare(b.label, "ja")
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
