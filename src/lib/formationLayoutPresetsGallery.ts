import type { DancerSpot } from "../types/choreography";
import { modDancerColorIndex } from "./dancerColorPalette";
import { FORMATION_REFERENCE_STEP_PCT } from "./dancerSpacing";
import { samplePolyline } from "./formationBalance";

/**
 * スクショで不足していた幾何パターンを、人数スケール可能な独自実装で追加する。
 * （他アプリの座標データのコピーではない）
 */

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

function yPctPyramidRow(r: number, numRows: number, yUp = 16, yDn = 78): number {
  if (numRows <= 1) return (yUp + yDn) / 2;
  const center = (yUp + yDn) / 2;
  const maxTotal = Math.max(0, yDn - yUp);
  const desiredTotal = TARGET_STEP_Y * (numRows - 1);
  const total = Math.min(desiredTotal, maxTotal);
  const top = center - total / 2;
  return top + (r / (numRows - 1)) * total;
}

function pushRowRecipe(
  out: DancerSpot[],
  /** front→back（客席側が [0]） */
  frontToBackCounts: number[],
  opts?: { maxHalfWidth?: number; slantPerRow?: number }
) {
  const counts = frontToBackCounts.filter((c) => c > 0);
  if (counts.length === 0) return;
  const nr = counts.length;
  const maxCnt = Math.max(1, ...counts);
  const maxHalf = opts?.maxHalfWidth ?? 34;
  const slant = opts?.slantPerRow ?? 0;
  let idx = out.length;
  for (let r = 0; r < nr; r++) {
    const cnt = counts[r]!;
    // r=0 が最前（y大）→ pyramid row index は後ろから
    const y = yPctPyramidRow(nr - 1 - r, nr);
    const stepCap = maxCnt <= 1 ? TARGET_STEP_X : (maxHalf * 2) / (maxCnt - 1);
    const step = Math.min(TARGET_STEP_X, stepCap);
    const cx = 50 + slant * (r - (nr - 1) / 2);
    for (let j = 0; j < cnt; j++) {
      const x = cnt === 1 ? cx : cx + (j - (cnt - 1) / 2) * step;
      pushSpot(out, idx++, x, y);
    }
  }
}

/** 奥が広く手前が細い（例: 11人3段 → front→back [2,4,5]） */
export function backWideTaperCounts(n: number, rows = 3): number[] {
  const total = Math.max(0, Math.floor(n));
  if (total <= 0) return [];
  const nr = Math.min(Math.max(2, rows), total);
  const frontStart = nr >= 4 ? 1 : Math.min(2, total);
  const ideal: number[] = [];
  let sum = 0;
  for (let i = 0; i < nr; i++) {
    const v = frontStart + i;
    ideal.push(v);
    sum += v;
  }
  let diff = total - sum;
  let i = nr - 1;
  while (diff > 0) {
    ideal[i]! += 1;
    diff -= 1;
    i = i <= 0 ? nr - 1 : i - 1;
  }
  while (diff < 0) {
    let j = -1;
    for (let k = nr - 1; k >= 0; k--) {
      if (ideal[k]! > 1) {
        j = k;
        break;
      }
    }
    if (j < 0) break;
    ideal[j]! -= 1;
    diff += 1;
  }
  return ideal;
}

/** 中太の3段（例: 11→3-5-3） */
export function midHeavyRowCounts(n: number): number[] {
  const total = Math.max(0, Math.floor(n));
  if (total <= 0) return [];
  if (total <= 2) return total === 2 ? [1, 1] : [1];
  if (total === 3) return [1, 1, 1];
  const maxWing = Math.max(1, Math.floor((total - 1) / 2));
  // mid をできるだけ厚く: wing は小さめから
  let wing = Math.min(Math.max(1, Math.floor(total / 4)), maxWing);
  let mid = total - 2 * wing;
  while (mid <= wing && wing > 1) {
    wing -= 1;
    mid = total - 2 * wing;
  }
  // mid が極端すぎるとき少し翼を広げる
  while (mid > wing * 2 + 1 && wing < maxWing) {
    wing += 1;
    mid = total - 2 * wing;
  }
  return [wing, mid, wing];
}

/** 2列台形（例: 11→前4・奥7） */
export function trapezoidTwoRowCounts(n: number): [number, number] {
  const total = Math.max(0, Math.floor(n));
  if (total <= 0) return [0, 0];
  if (total === 1) return [1, 0];
  const front = Math.max(1, Math.min(total - 1, Math.round(total * 0.36)));
  return [front, total - front];
}

export const GALLERY_LAYOUT_PRESET_OPTIONS = [
  { id: "gallery_twin_peaks", label: "双峰（手前ベース）" },
  { id: "gallery_twin_peaks_wide", label: "双峰（広め）" },
  { id: "gallery_twin_pyramids", label: "双子ピラミッド" },
  { id: "gallery_back_taper_3", label: "奥広3段（５４２系）" },
  { id: "gallery_back_taper_4", label: "奥広4段" },
  { id: "gallery_mid_heavy_3", label: "中太3段（３５３系）" },
  { id: "gallery_trapezoid_2", label: "台形2列（奥多）" },
  { id: "gallery_trapezoid_arc", label: "台形弧（奥多）" },
  { id: "gallery_slant_block", label: "斜め塊（平行四辺形）" },
  { id: "gallery_u_square", label: "角U字（バケット）" },
  { id: "gallery_pointed_col_up", label: "尖り縦列（奥先端）" },
  { id: "gallery_pointed_col_down", label: "尖り縦列（手前先端）" },
  { id: "gallery_flat_pyramid", label: "平頂ピラミッド" },
  { id: "gallery_dense_m_base", label: "M字（手前厚）" },
  { id: "gallery_w_layered", label: "W字（段重ね）" },
  { id: "gallery_front_pair_back_wide", label: "手前2・奥広" },
] as const;

export type GalleryLayoutPresetId =
  (typeof GALLERY_LAYOUT_PRESET_OPTIONS)[number]["id"];

const GALLERY_IDS = new Set<string>(
  GALLERY_LAYOUT_PRESET_OPTIONS.map((o) => o.id)
);

export function isGalleryLayoutPresetId(
  id: string
): id is GalleryLayoutPresetId {
  return GALLERY_IDS.has(id);
}

function applyTwinPeaks(
  n: number,
  out: DancerSpot[],
  spread: number
) {
  if (n <= 0) return;
  if (n === 1) {
    pushSpot(out, 0, 50, 50);
    return;
  }
  // 手前ベース＋左右ピーク（各ピークは小ピラミッド）
  const baseN = Math.max(3, Math.ceil(n * 0.45));
  const rem = n - baseN;
  const leftN = Math.ceil(rem / 2);
  const rightN = rem - leftN;
  const baseXs = evenSpacingPositions(baseN, 50, TARGET_STEP_X, 10, 90);
  let idx = 0;
  for (let j = 0; j < baseN; j++) pushSpot(out, idx++, baseXs[j]!, 72);
  const placePeak = (count: number, cx: number) => {
    if (count <= 0) return;
    // 奥へ1,2,3…で積む
    let remP = count;
    let rowW = 1;
    const rows: number[] = [];
    while (remP > 0) {
      const take = Math.min(rowW, remP);
      rows.push(take);
      remP -= take;
      rowW += 1;
    }
    // rows[0]=奥先端寄り
    for (let r = 0; r < rows.length; r++) {
      const cnt = rows[r]!;
      const y = 28 + r * 12;
      const xs = evenSpacingPositions(cnt, cx, TARGET_STEP_X * 0.85, 8, 92);
      for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
    }
  };
  placePeak(leftN, 50 - spread);
  placePeak(rightN, 50 + spread);
}

function applyTwinPyramids(n: number, out: DancerSpot[]) {
  const leftN = Math.ceil(n / 2);
  const rightN = n - leftN;
  const build = (count: number, cx: number, startIdx: number) => {
    const rows: number[] = [];
    let rem = count;
    let w = 1;
    while (rem > 0) {
      const take = Math.min(w, rem);
      rows.push(take);
      rem -= take;
      w += 1;
    }
    // front-filled visual: reverse so last row is front
    const frontToBack = [...rows].reverse();
    let idx = startIdx;
    const nr = frontToBack.length;
    const maxCnt = Math.max(1, ...frontToBack);
    for (let r = 0; r < nr; r++) {
      const cnt = frontToBack[r]!;
      const y = yPctPyramidRow(nr - 1 - r, nr, 20, 76);
      for (let j = 0; j < cnt; j++) {
        const step =
          maxCnt <= 1 ? TARGET_STEP_X : Math.min(TARGET_STEP_X, 28 / (maxCnt - 1));
        const x = cnt === 1 ? cx : cx + (j - (cnt - 1) / 2) * step;
        pushSpot(out, idx++, x, y);
      }
    }
    return idx;
  };
  const next = build(leftN, 32, 0);
  build(rightN, 68, next);
}

function applyPointedColumn(
  n: number,
  out: DancerSpot[],
  tip: "up" | "down"
) {
  if (n <= 0) return;
  if (n === 1) {
    pushSpot(out, 0, 50, 50);
    return;
  }
  // 1 tip + pairs
  const tipCount = 1;
  const pairRows = Math.floor((n - tipCount) / 2);
  const leftover = n - tipCount - pairRows * 2;
  const rows: { cnt: number; y: number }[] = [];
  const totalRows = pairRows + 1 + (leftover > 0 ? 1 : 0);
  let rIdx = 0;
  if (tip === "up") {
    rows.push({ cnt: 1, y: yPctPyramidRow(0, Math.max(2, totalRows)) });
    rIdx = 1;
    for (let i = 0; i < pairRows; i++) {
      rows.push({
        cnt: 2,
        y: yPctPyramidRow(rIdx++, Math.max(2, totalRows)),
      });
    }
    if (leftover > 0) {
      rows.push({
        cnt: leftover,
        y: yPctPyramidRow(rIdx, Math.max(2, totalRows)),
      });
    }
  } else {
    for (let i = 0; i < pairRows; i++) {
      rows.push({
        cnt: 2,
        y: yPctPyramidRow(rIdx++, Math.max(2, totalRows)),
      });
    }
    if (leftover > 0) {
      rows.push({
        cnt: leftover,
        y: yPctPyramidRow(rIdx++, Math.max(2, totalRows)),
      });
    }
    rows.push({
      cnt: 1,
      y: yPctPyramidRow(Math.max(0, totalRows - 1), Math.max(2, totalRows)),
    });
  }
  let idx = 0;
  for (const row of rows) {
    const xs = evenSpacingPositions(row.cnt, 50, TARGET_STEP_X * 0.7, 20, 80);
    for (let j = 0; j < row.cnt; j++) pushSpot(out, idx++, xs[j]!, row.y);
  }
}

function applySquareU(n: number, out: DancerSpot[]) {
  if (n <= 0) return;
  if (n <= 3) {
    const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 20, 80);
    for (let i = 0; i < n; i++) pushSpot(out, i, xs[i]!, 70);
    return;
  }
  // top bar + two sides (opening toward audience = bottom)
  const topN = Math.max(1, Math.round(n / 5));
  const rem = n - topN;
  const leftN = Math.ceil(rem / 2);
  const rightN = rem - leftN;
  let idx = 0;
  const topXs = evenSpacingPositions(topN, 50, TARGET_STEP_X, 22, 78);
  for (let j = 0; j < topN; j++) pushSpot(out, idx++, topXs[j]!, 22);
  const leftYs = evenSpacingPositions(leftN, 55, TARGET_STEP_Y, 28, 82);
  for (let j = 0; j < leftN; j++) pushSpot(out, idx++, 22, leftYs[j]!);
  const rightYs = evenSpacingPositions(rightN, 55, TARGET_STEP_Y, 28, 82);
  for (let j = 0; j < rightN; j++) pushSpot(out, idx++, 78, rightYs[j]!);
}

function applyFlatTopPyramid(n: number, out: DancerSpot[]) {
  // 手前から 2,3,4…（先端1を作らない）
  const counts: number[] = [];
  let rem = n;
  let w = 2;
  while (rem > 0) {
    const take = Math.min(w, rem);
    counts.push(take);
    rem -= take;
    w += 1;
  }
  pushRowRecipe(out, counts, { maxHalfWidth: 34 });
}

function applyDenseMBase(n: number, out: DancerSpot[]) {
  // 手前厚のM: ポリライン + 手前寄せ
  const pts = samplePolyline(
    [
      { xPct: 14, yPct: 70 },
      { xPct: 28, yPct: 28 },
      { xPct: 42, yPct: 58 },
      { xPct: 50, yPct: 36 },
      { xPct: 58, yPct: 58 },
      { xPct: 72, yPct: 28 },
      { xPct: 86, yPct: 70 },
    ],
    n
  );
  for (let i = 0; i < pts.length; i++) {
    pushSpot(out, i, pts[i]!.xPct, pts[i]!.yPct);
  }
}

function applyLayeredW(n: number, out: DancerSpot[]) {
  // 奥2ピーク + 中段 + 手前谷
  if (n <= 4) {
    applyDenseMBase(n, out);
    return;
  }
  const back = Math.min(4, Math.max(2, Math.floor(n * 0.28)));
  const mid = Math.min(5, Math.max(2, Math.floor(n * 0.36)));
  const front = n - back - mid;
  const frontN = Math.max(1, front);
  const midN = mid + (front < 1 ? front : 0);
  pushRowRecipe(out, [frontN, midN, back], { maxHalfWidth: 36 });
  // 奥を左右に割って双峰感を出す: 最後の行を再配置
  // （簡易: back の x を2クラスタに）
  const backSpots = out.slice(out.length - back);
  if (back >= 2) {
    const left = Math.ceil(back / 2);
    const right = back - left;
    const lxs = evenSpacingPositions(left, 32, TARGET_STEP_X, 10, 48);
    const rxs = evenSpacingPositions(right, 68, TARGET_STEP_X, 52, 90);
    for (let i = 0; i < left; i++) backSpots[i]!.xPct = clamp(lxs[i]!, 5, 95);
    for (let i = 0; i < right; i++)
      backSpots[left + i]!.xPct = clamp(rxs[i]!, 5, 95);
  }
}

/** ギャラリー雛形を out に書き込む。対応 id で true。 */
export function tryApplyGalleryLayoutPreset(
  preset: string,
  n: number,
  out: DancerSpot[]
): boolean {
  if (!GALLERY_IDS.has(preset)) return false;

  switch (preset) {
    case "gallery_twin_peaks":
      applyTwinPeaks(n, out, 18);
      break;
    case "gallery_twin_peaks_wide":
      applyTwinPeaks(n, out, 26);
      break;
    case "gallery_twin_pyramids":
      applyTwinPyramids(n, out);
      break;
    case "gallery_back_taper_3":
      pushRowRecipe(out, backWideTaperCounts(n, 3));
      break;
    case "gallery_back_taper_4":
      pushRowRecipe(out, backWideTaperCounts(n, 4));
      break;
    case "gallery_mid_heavy_3":
      pushRowRecipe(out, midHeavyRowCounts(n));
      break;
    case "gallery_trapezoid_2": {
      const [front, back] = trapezoidTwoRowCounts(n);
      pushRowRecipe(out, [front, back].filter((c) => c > 0), {
        maxHalfWidth: 38,
      });
      break;
    }
    case "gallery_trapezoid_arc": {
      const [front, back] = trapezoidTwoRowCounts(n);
      let idx = 0;
      if (back > 0) {
        for (let j = 0; j < back; j++) {
          const u = back === 1 ? 0.5 : j / (back - 1);
          const ang = Math.PI * (0.18 + u * 0.64);
          pushSpot(out, idx++, 50 + 38 * Math.cos(ang), 34 + 10 * Math.sin(ang));
        }
      }
      if (front > 0) {
        const xs = evenSpacingPositions(front, 50, TARGET_STEP_X, 18, 82);
        for (let j = 0; j < front; j++) pushSpot(out, idx++, xs[j]!, 72);
      }
      break;
    }
    case "gallery_slant_block": {
      const a = Math.max(1, Math.ceil(n / 3));
      const b = Math.max(1, Math.floor(n / 3));
      const c = Math.max(1, n - a - b);
      // 合計がずれたら手前へ吸収
      const rows = [a, b, c];
      const sum = rows.reduce((s, x) => s + x, 0);
      rows[0]! += n - sum;
      pushRowRecipe(out, rows.filter((x) => x > 0), {
        slantPerRow: 7,
        maxHalfWidth: 30,
      });
      break;
    }
    case "gallery_u_square":
      applySquareU(n, out);
      break;
    case "gallery_pointed_col_up":
      applyPointedColumn(n, out, "up");
      break;
    case "gallery_pointed_col_down":
      applyPointedColumn(n, out, "down");
      break;
    case "gallery_flat_pyramid":
      applyFlatTopPyramid(n, out);
      break;
    case "gallery_dense_m_base":
      applyDenseMBase(n, out);
      break;
    case "gallery_w_layered":
      applyLayeredW(n, out);
      break;
    case "gallery_front_pair_back_wide": {
      // 手前2固定寄り、残りを奥へ（11→2,4,5 系）
      if (n <= 2) {
        pushRowRecipe(out, [n]);
        break;
      }
      const front = 2;
      const rem = n - front;
      const mid = Math.ceil(rem / 2);
      const back = rem - mid;
      pushRowRecipe(out, [front, mid, back], { maxHalfWidth: 36 });
      break;
    }
    default:
      return false;
  }
  return true;
}
