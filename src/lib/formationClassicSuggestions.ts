/**
 * 定番の雛形提案（人数ごとの推奨順）。
 * 既存カテゴリとは別に、現場でよく使う順で並べる。
 */
import type { DancerSpot } from "../types/choreography";
import { modDancerColorIndex } from "./dancerColorPalette";
import { FORMATION_REFERENCE_STEP_PCT } from "./dancerSpacing";
import { midHeavyRowCounts } from "./formationLayoutPresetsGallery";

const TARGET_STEP_X = FORMATION_REFERENCE_STEP_PCT;
const TARGET_STEP_Y = 14;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function pushSpot(out: DancerSpot[], i: number, x: number, y: number) {
  out.push({
    id: crypto.randomUUID(),
    label: String(i + 1),
    xPct: clamp(x, 5, 95),
    yPct: clamp(y, 8, 92),
    colorIndex: modDancerColorIndex(i),
  });
}

function evenSpacingPositions(
  n: number,
  center: number,
  preferredStepPct: number,
  minPct: number,
  maxPct: number
): number[] {
  if (n <= 0) return [];
  if (n === 1) return [center];
  const halfSpan = Math.min(center - minPct, maxPct - center);
  const maxTotal = Math.max(0, halfSpan * 2);
  const desiredTotal = preferredStepPct * (n - 1);
  const step =
    desiredTotal <= maxTotal ? preferredStepPct : maxTotal / (n - 1);
  const start = center - (step * (n - 1)) / 2;
  return Array.from({ length: n }, (_, i) => start + i * step);
}

function yPctRow(r: number, numRows: number, yUp = 18, yDn = 76): number {
  if (numRows <= 1) return (yUp + yDn) / 2;
  const center = (yUp + yDn) / 2;
  const maxTotal = Math.max(0, yDn - yUp);
  const desiredTotal = TARGET_STEP_Y * (numRows - 1);
  const total = Math.min(desiredTotal, maxTotal);
  const top = center - total / 2;
  return top + (r / (numRows - 1)) * total;
}

function xPctInRow(j: number, cnt: number, maxCnt: number): number {
  if (cnt <= 1) return 50;
  if (maxCnt <= 1) return 50;
  const maxHalf = 34;
  const stepCap = (maxHalf * 2) / (maxCnt - 1);
  const step = Math.min(TARGET_STEP_X, stepCap);
  return 50 + (j - (cnt - 1) / 2) * step;
}

/** rowCounts[0] = 最前列（客席側） */
export function pushClassicRows(out: DancerSpot[], rowCounts: number[]) {
  const rows = rowCounts.filter((c) => c > 0);
  if (rows.length === 0) return;
  const nr = rows.length;
  const maxCnt = Math.max(...rows);
  let idx = 0;
  for (let r = 0; r < nr; r++) {
    const cnt = rows[r]!;
    const y = yPctRow(nr - 1 - r, nr);
    for (let j = 0; j < cnt; j++) {
      pushSpot(out, idx++, xPctInRow(j, cnt, maxCnt), y);
    }
  }
}

/**
 * 前列センター1人から、2人・3人と段を増やすピラミッド。
 * 例: 7→[1,2,4] / 8→[1,2,3,2]
 */
export function classicPyramidRowCounts(n: number): number[] {
  const total = Math.max(0, Math.floor(n));
  if (total <= 0) return [];
  if (total === 1) return [1];
  if (total === 2) return [1, 1];
  if (total === 3) return [1, 2];
  if (total === 4) return [1, 3];
  if (total === 5) return [1, 2, 2];
  if (total === 6) return [1, 2, 3];
  if (total === 7) return [1, 2, 4];
  if (total === 8) return [1, 2, 3, 2];
  if (total === 9) return [1, 2, 3, 3];
  if (total === 10) return [1, 2, 3, 4];

  const rows: number[] = [];
  let rem = total;
  let w = 1;
  while (rem > 0) {
    const take = Math.min(w, rem);
    rows.push(take);
    rem -= take;
    w += 1;
  }
  if (rows.length >= 2 && rows[rows.length - 1] === 1) {
    rows[rows.length - 2]! += 1;
    rows.pop();
  }
  return rows;
}

/** 前少なめ2列（7→3-4） */
export function classicFrontLightTwoRows(n: number): [number, number] {
  const total = Math.max(0, Math.floor(n));
  if (total <= 1) return [total, 0];
  const front = Math.floor(total / 2);
  return [front, total - front];
}

/** 前多め2列（7→4-3） */
export function classicFrontHeavyTwoRows(n: number): [number, number] {
  const total = Math.max(0, Math.floor(n));
  if (total <= 1) return [total, 0];
  const back = Math.floor(total / 2);
  return [total - back, back];
}

/**
 * 3分割人数。8人なら 3-2-3。7人なら 3-1-3。
 */
export function classicTriple323(n: number): [number, number, number] {
  const total = Math.max(0, Math.floor(n));
  if (total <= 0) return [0, 0, 0];
  if (total === 1) return [0, 1, 0];
  if (total === 2) return [1, 0, 1];
  if (total === 3) return [1, 1, 1];
  if (total === 4) return [1, 2, 1];
  if (total === 5) return [2, 1, 2];
  if (total === 6) return [2, 2, 2];
  if (total === 7) return [3, 1, 3];
  if (total === 8) return [3, 2, 3];
  if (total === 9) return [3, 3, 3];
  const base = Math.floor(total / 3);
  const rem = total % 3;
  if (rem === 0) return [base, base, base];
  if (rem === 1) return [base, base + 1, base];
  return [base + 1, base, base + 1];
}

/**
 * 上手=画面右(x大)・下手=画面左(x小)。
 * 戻り値は [下手人数, 上手人数]。
 */
export function classicShimoteKamitePair(
  n: number,
  kamiteFewer: boolean
): [number, number] {
  const total = Math.max(0, Math.floor(n));
  if (total <= 0) return [0, 0];
  if (total === 1) return kamiteFewer ? [1, 0] : [0, 1];
  const smaller = Math.floor(total / 2);
  const larger = total - smaller;
  return kamiteFewer ? [larger, smaller] : [smaller, larger];
}

/** 前列 first から +1 ずつ増やす段配分（formationLayouts.frontAudienceGrowingRowCounts と同じ） */
export function classicFrontStairRowCounts(n: number, firstRow: number): number[] {
  if (n <= 0) return [];
  const rows: number[] = [];
  let rem = n;
  let w = Math.max(1, Math.floor(firstRow));
  while (rem > 0) {
    const take = Math.min(w, rem);
    rows.push(take);
    rem -= take;
    w += 1;
  }
  return rows;
}

/**
 * 2列（手前・奥）で、手前人数を 1,2,3…と増やした配分。
 * 2列目が1列目より少なくなった案まで含めて返す。
 * 例: 7人 → [1,6] [2,5] [3,4] [4,3]
 */
export function classicTwoRowFrontProgression(n: number): [number, number][] {
  const total = Math.max(0, Math.floor(n));
  if (total < 2) return [];
  const out: [number, number][] = [];
  for (let front = 1; front < total; front++) {
    const back = total - front;
    out.push([front, back]);
    if (back < front) break;
  }
  return out;
}

/**
 * 前列人数を 2,3,4…と増やした段々案。
 * 2列目が1列目より少なくなった案まで含めて返す。
 */
export function classicFrontStairFirstRowsUntilBackFewer(n: number): number[] {
  const total = Math.max(0, Math.floor(n));
  if (total < 3) return [];
  const firsts: number[] = [];
  for (let first = 2; first < total; first++) {
    const rows = classicFrontStairRowCounts(total, first);
    if (rows.length < 2) break;
    firsts.push(first);
    if ((rows[1] ?? 0) < (rows[0] ?? 0)) break;
  }
  return firsts;
}

function formatRows(rows: number[]): string {
  return rows.filter((c) => c > 0).join("-");
}

/** counts[0]=最前列（客席側）。formationLayouts.evenRowCounts と同じ配分 */
export function classicEvenRowCounts(n: number, targetRows: number): number[] {
  if (n <= 0 || targetRows <= 0) return [];
  const rows = Math.min(targetRows, n);
  const base = Math.floor(n / rows);
  const rem = n - base * rows;
  const counts = new Array<number>(rows).fill(base);
  for (let i = 0; i < rem; i++) {
    counts[rows - 1 - i]! += 1;
  }
  return counts;
}

/**
 * 人数に応じて提案する横列数の上限。
 * 少人数でも 1〜人数分、多いときは最大 12 列まで広げる。
 */
export function classicMaxEqualRowSuggestions(n: number): number {
  const total = Math.max(1, Math.floor(n));
  if (total <= 4) return total;
  return Math.min(12, total, Math.max(4, Math.floor(total / 2)));
}

/** 横 R 列（均等）に対応する既存プリセット id */
export function classicEqualRowsPresetId(rowCount: number): string | null {
  if (rowCount <= 1) return "line";
  if (rowCount === 2) return "two_rows_equal";
  if (rowCount >= 3 && rowCount <= 12) return `rows_${rowCount}`;
  return null;
}

function pushTwoRows(out: DancerSpot[], front: number, back: number) {
  pushClassicRows(
    out,
    [front, back].filter((c) => c > 0)
  );
}

function pushVerticalColumns(
  out: DancerSpot[],
  colCounts: [number, number, number]
) {
  const [l, m, r] = colCounts;
  const cols = [
    { cnt: l, x: 22 },
    { cnt: m, x: 50 },
    { cnt: r, x: 78 },
  ].filter((c) => c.cnt > 0);
  const maxCnt = Math.max(...cols.map((c) => c.cnt), 1);
  let idx = 0;
  for (const col of cols) {
    const ys = evenSpacingPositions(col.cnt, 50, TARGET_STEP_Y, 16, 84);
    for (let j = 0; j < col.cnt; j++) {
      pushSpot(out, idx++, col.x, ys[j]!);
    }
  }
  void maxCnt;
}

function pushThreeClusters(
  out: DancerSpot[],
  counts: [number, number, number]
) {
  const [l, m, r] = counts;
  let idx = 0;
  const place = (cnt: number, cx: number, cy: number) => {
    if (cnt <= 0) return;
    const xs = evenSpacingPositions(cnt, cx, TARGET_STEP_X * 0.75, cx - 12, cx + 12);
    for (let j = 0; j < cnt; j++) {
      const yOff = cnt === 1 ? 0 : ((j % 2) * 2 - (cnt > 1 ? 1 : 0)) * 4;
      pushSpot(out, idx++, xs[j]!, cy + yOff);
    }
  };
  place(l, 20, 50);
  place(m, 50, 52);
  place(r, 80, 50);
}

function pushLrBlocks(
  out: DancerSpot[],
  leftN: number,
  rightN: number
) {
  let idx = 0;
  const place = (cnt: number, cx: number) => {
    if (cnt <= 0) return;
    const cols = Math.min(2, cnt);
    const rows = Math.ceil(cnt / cols);
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const remain = cnt - k;
      const rowCnt = Math.min(cols, remain);
      const y = rows <= 1 ? 50 : yPctRow(rows - 1 - r, rows, 24, 76);
      const xs = evenSpacingPositions(
        rowCnt,
        cx,
        TARGET_STEP_X * 0.85,
        cx - 14,
        cx + 14
      );
      for (let j = 0; j < rowCnt; j++) pushSpot(out, idx++, xs[j]!, y);
      k += rowCnt;
    }
  };
  place(leftN, 26);
  place(rightN, 74);
}

export const CLASSIC_LAYOUT_PRESET_OPTIONS = [
  { id: "classic_pyramid", label: "ピラミッド（前列センター1）" },
  { id: "classic_rows_mid_heavy", label: "中太3段" },
  { id: "classic_rows_front_light", label: "2列（前少）" },
  { id: "classic_rows_front_heavy", label: "2列（前多）" },
  { id: "classic_cols_overlap", label: "縦被り（3列）" },
  { id: "classic_split_three", label: "3分割（左右中央）" },
  { id: "classic_kamite_light", label: "上手少・下手多" },
  { id: "classic_kamite_heavy", label: "上手多・下手少" },
] as const;

const CLASSIC_IDS = new Set(
  CLASSIC_LAYOUT_PRESET_OPTIONS.map((o) => o.id as string)
);

export function tryApplyClassicLayoutPreset(
  preset: string,
  n: number,
  out: DancerSpot[]
): boolean {
  const twoRows = /^classic_two_rows_(\d+)$/.exec(preset);
  if (twoRows) {
    const front = Number.parseInt(twoRows[1]!, 10);
    if (!Number.isFinite(front) || front < 1 || front >= n) return false;
    const back = n - front;
    pushTwoRows(out, front, back);
    return true;
  }
  if (!CLASSIC_IDS.has(preset)) return false;
  switch (preset) {
    case "classic_pyramid":
      pushClassicRows(out, classicPyramidRowCounts(n));
      break;
    case "classic_rows_mid_heavy":
      pushClassicRows(out, midHeavyRowCounts(n));
      break;
    case "classic_rows_front_light": {
      const [f, b] = classicFrontLightTwoRows(n);
      pushTwoRows(out, f, b);
      break;
    }
    case "classic_rows_front_heavy": {
      const [f, b] = classicFrontHeavyTwoRows(n);
      pushTwoRows(out, f, b);
      break;
    }
    case "classic_cols_overlap":
      pushVerticalColumns(out, classicTriple323(n));
      break;
    case "classic_split_three":
      pushThreeClusters(out, classicTriple323(n));
      break;
    case "classic_kamite_light": {
      const [shimote, kamite] = classicShimoteKamitePair(n, true);
      pushLrBlocks(out, shimote, kamite);
      break;
    }
    case "classic_kamite_heavy": {
      const [shimote, kamite] = classicShimoteKamitePair(n, false);
      pushLrBlocks(out, shimote, kamite);
      break;
    }
    default:
      return false;
  }
  return true;
}

export type ClassicSuggestionEntry = {
  id: string;
  label: string;
};

/**
 * 人数に応じた定番提案の並び。
 * 前列人数を一人ずつ増やした2列・段々を、2列目が1列目より少なくなるまで含める。
 */
export function classicSuggestionEntries(n: number): ClassicSuggestionEntry[] {
  const count = Math.max(1, Math.floor(n));
  const items: ClassicSuggestionEntry[] = [];

  const pyramidRows = classicPyramidRowCounts(count);
  items.push({
    id: "classic_pyramid",
    label: `ピラミッド（${formatRows(pyramidRows)}）`,
  });

  /** 前列2人・3人…と一人ずつ増やした段々（2列目 < 1列目になるまで） */
  for (const first of classicFrontStairFirstRowsUntilBackFewer(count)) {
    const rows = classicFrontStairRowCounts(count, first);
    items.push({
      id: `front_stair_from_${first}`,
      label: `前列${first}人から段々（${formatRows(rows)}）`,
    });
  }

  if (count >= 5) {
    const mid = midHeavyRowCounts(count);
    items.push({
      id: "classic_rows_mid_heavy",
      label: `中太3段（${formatRows(mid)}）`,
    });
  }

  /** 2列で手前人数を1人ずつ増やし、2列目が少なくなるまで */
  for (const [front, back] of classicTwoRowFrontProgression(count)) {
    items.push({
      id: `classic_two_rows_${front}`,
      label: `2列（${front}-${back}）`,
    });
  }

  /** 横1列〜N列（均等）。人数が増えると列数の提案も増える */
  const maxEqualRows = classicMaxEqualRowSuggestions(count);
  for (let r = 1; r <= maxEqualRows; r++) {
    const id = classicEqualRowsPresetId(r);
    if (!id) continue;
    if (r === 1) {
      items.push({ id, label: "横1列" });
      continue;
    }
    const rows = classicEvenRowCounts(count, r);
    items.push({
      id,
      label: `横${r}列（${formatRows(rows)}）`,
    });
  }

  items.push({ id: "vee", label: "V字" });
  items.push({ id: "inverse_vee", label: "逆V字" });
  items.push({ id: "diagonal_se", label: "斜め" });
  items.push({ id: "diagonal_nw", label: "逆斜め" });

  if (count >= 5) {
    const trip = classicTriple323(count);
    items.push({
      id: "classic_cols_overlap",
      label: `縦被り（${formatRows(trip)}）`,
    });
    items.push({
      id: "classic_split_three",
      label: `3分割（${formatRows(trip)}）`,
    });
  }

  if (count >= 3) {
    const [s1, k1] = classicShimoteKamitePair(count, true);
    const [s2, k2] = classicShimoteKamitePair(count, false);
    items.push({
      id: "classic_kamite_light",
      label: `上手${k1}・下手${s1}`,
    });
    items.push({
      id: "classic_kamite_heavy",
      label: `上手${k2}・下手${s2}`,
    });
  }

  return items;
}
