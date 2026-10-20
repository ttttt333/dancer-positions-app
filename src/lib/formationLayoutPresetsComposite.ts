import type { DancerSpot } from "../types/choreography";
import { modDancerColorIndex } from "./dancerColorPalette";
import { FORMATION_REFERENCE_STEP_PCT } from "./dancerSpacing";
import { samplePolyline } from "./formationBalance";

/**
 * CHOREOGRAPHIC 系スクショで特徴的だった「複合グループ」雛形。
 * 他アプリの座標コピーではなく、左右翼＋中央核などの幾何を人数スケールで生成する。
 */

const STEP_X = FORMATION_REFERENCE_STEP_PCT;
const STEP_Y = 12;

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

function evenXs(
  n: number,
  cx: number,
  step = STEP_X,
  minX = 8,
  maxX = 92
): number[] {
  if (n <= 0) return [];
  if (n === 1) return [cx];
  const half = Math.min(cx - minX, maxX - cx);
  const maxSpan = Math.max(0, half * 2);
  const want = step * (n - 1);
  const s = want <= maxSpan ? step : maxSpan / (n - 1);
  const start = cx - (s * (n - 1)) / 2;
  return Array.from({ length: n }, (_, i) => start + i * s);
}

function evenYs(
  n: number,
  cy: number,
  step = STEP_Y,
  minY = 12,
  maxY = 88
): number[] {
  return evenXs(n, cy, step, minY, maxY);
}

/** weights に比例して n を配分（合計ちょうど n、各部 ≥ minEach） */
export function allocateByWeights(
  n: number,
  weights: number[],
  minEach = 0
): number[] {
  const w = weights.map((x) => Math.max(0, x));
  const k = w.length;
  if (k === 0 || n <= 0) return [];
  const minTotal = minEach * k;
  if (n < minTotal) {
    // 足りないときは先頭から1ずつ
    const out = new Array(k).fill(0);
    for (let i = 0; i < n; i++) out[i % k]! += 1;
    return out;
  }
  let rem = n - minTotal;
  const out = w.map(() => minEach);
  const sumW = w.reduce((a, b) => a + b, 0) || 1;
  const raw = w.map((wi) => (rem * wi) / sumW);
  const floors = raw.map((x) => Math.floor(x));
  let used = floors.reduce((a, b) => a + b, 0);
  const frac = raw
    .map((x, i) => ({ i, f: x - Math.floor(x) }))
    .sort((a, b) => b.f - a.f);
  for (let i = 0; i < k; i++) out[i]! += floors[i]!;
  let left = rem - used;
  for (let j = 0; j < left; j++) out[frac[j % k]!.i]! += 1;
  return out;
}

function pushGrid(
  out: DancerSpot[],
  startIdx: number,
  count: number,
  cols: number,
  cx: number,
  cy: number,
  stepX = STEP_X * 0.85,
  stepY = STEP_Y * 0.9,
  stagger = false
): number {
  if (count <= 0) return startIdx;
  const colsN = Math.max(1, cols);
  const rows = Math.ceil(count / colsN);
  let idx = startIdx;
  let placed = 0;
  for (let r = 0; r < rows && placed < count; r++) {
    const rowCnt = Math.min(colsN, count - placed);
    const y = cy - ((rows - 1) * stepY) / 2 + r * stepY;
    const ox = stagger && r % 2 === 1 ? stepX / 2 : 0;
    const xs = evenXs(rowCnt, cx + ox, stepX, 6, 94);
    for (let j = 0; j < rowCnt; j++) {
      pushSpot(out, idx++, xs[j]!, y);
      placed++;
    }
  }
  return idx;
}

function pushColumn(
  out: DancerSpot[],
  startIdx: number,
  count: number,
  x: number,
  cy: number,
  stepY = STEP_Y
): number {
  if (count <= 0) return startIdx;
  const ys = evenYs(count, cy, stepY);
  let idx = startIdx;
  for (let i = 0; i < count; i++) pushSpot(out, idx++, x, ys[i]!);
  return idx;
}

function pushDiamond(
  out: DancerSpot[],
  startIdx: number,
  count: number,
  cx: number,
  cy: number
): number {
  if (count <= 0) return startIdx;
  // 1,2,3,... then mirror if needed — prefer classic diamond row map
  const rows: number[] = [];
  let rem = count;
  // build up then down
  let w = 1;
  const up: number[] = [];
  while (rem > 0 && up.length < 8) {
    const take = Math.min(w, rem);
    up.push(take);
    rem -= take;
    w += 2;
    if (w > count) break;
  }
  // if leftover, widen middle
  while (rem > 0) {
    const mid = Math.floor(up.length / 2);
    up[mid]! += 1;
    rem -= 1;
  }
  // symmetrize visually: if odd length ok; else fine
  rows.push(...up);
  const maxCnt = Math.max(1, ...rows);
  const nr = rows.length;
  let idx = startIdx;
  for (let r = 0; r < nr; r++) {
    const cnt = rows[r]!;
    const y = cy - ((nr - 1) * STEP_Y * 0.7) / 2 + r * STEP_Y * 0.7;
    const xs = evenXs(cnt, cx, Math.min(STEP_X, 28 / Math.max(1, maxCnt - 1)));
    for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
  }
  return idx;
}

function pushInvTriangle(
  out: DancerSpot[],
  startIdx: number,
  count: number,
  cx: number,
  cy: number,
  stagger = true
): number {
  if (count <= 0) return startIdx;
  // top wide → tip down (audience tip)
  const rows: number[] = [];
  let rem = count;
  let w = Math.ceil((-1 + Math.sqrt(1 + 8 * count)) / 2);
  while (rem > 0 && w >= 1) {
    const take = Math.min(w, rem);
    rows.push(take);
    rem -= take;
    w -= 1;
  }
  while (rem > 0) {
    rows[0]! += 1;
    rem -= 1;
  }
  const nr = rows.length;
  let idx = startIdx;
  for (let r = 0; r < nr; r++) {
    const cnt = rows[r]!;
    const y = cy - ((nr - 1) * STEP_Y * 0.75) / 2 + r * STEP_Y * 0.75;
    const ox = stagger && r % 2 === 1 ? STEP_X * 0.35 : 0;
    const xs = evenXs(cnt, cx + ox, STEP_X * 0.8);
    for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
  }
  return idx;
}

function pushPolylineShape(
  out: DancerSpot[],
  startIdx: number,
  count: number,
  poly: { xPct: number; yPct: number }[]
): number {
  if (count <= 0) return startIdx;
  const pts = samplePolyline(poly, count);
  let idx = startIdx;
  for (const p of pts) pushSpot(out, idx++, p.xPct, p.yPct);
  return idx;
}

function pushXShape(
  out: DancerSpot[],
  startIdx: number,
  count: number,
  cx: number,
  cy: number,
  span = 14
): number {
  if (count <= 0) return startIdx;
  const half = Math.ceil(count / 2);
  let idx = startIdx;
  for (let i = 0; i < half; i++) {
    const u = half === 1 ? 0.5 : i / (half - 1);
    pushSpot(out, idx++, cx - span + u * span * 2, cy - span + u * span * 2);
  }
  for (let i = half; i < count; i++) {
    const j = i - half;
    const rest = count - half;
    const u = rest === 1 ? 0.5 : j / (rest - 1 || 1);
    pushSpot(out, idx++, cx - span + u * span * 2, cy + span - u * span * 2);
  }
  return idx;
}

function pushStaggerBlock(
  out: DancerSpot[],
  startIdx: number,
  count: number,
  cx: number,
  cy: number,
  targetRows = 3
): number {
  if (count <= 0) return startIdx;
  const rows = Math.min(targetRows, count);
  const base = Math.floor(count / rows);
  const rem = count - base * rows;
  const counts = Array.from({ length: rows }, (_, i) =>
    base + (i < rem ? 1 : 0)
  );
  // 奥側をやや厚く見せるため reverse せず front=last
  let idx = startIdx;
  for (let r = 0; r < rows; r++) {
    const cnt = counts[r]!;
    const y = cy - ((rows - 1) * STEP_Y) / 2 + r * STEP_Y;
    const ox = r % 2 === 1 ? STEP_X * 0.4 : 0;
    const xs = evenXs(cnt, cx + ox, STEP_X * 0.75, 6, 94);
    for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
  }
  return idx;
}

export const COMPOSITE_LAYOUT_PRESET_OPTIONS = [
  { id: "comp_dense_inv_triangle", label: "密集逆三角（千鳥）" },
  { id: "comp_wings_diamond", label: "両翼＋中央ダイヤ" },
  { id: "comp_wings_wedge", label: "両翼列＋中央楔" },
  { id: "comp_edge_diag_caps", label: "対角帯＋端キャップ" },
  { id: "comp_diag_pair_accents", label: "二重斜め＋アクセント" },
  { id: "comp_grid_column", label: "左グリッド＋右縦列" },
  { id: "comp_grid_heart_column", label: "グリッド＋中央形＋縦列" },
  { id: "comp_grid_x", label: "グリッド＋中央＋X" },
  { id: "comp_dual_stagger", label: "左右千鳥ブロック" },
  { id: "comp_chorus_front_pair", label: "大密集＋手前ペア" },
  { id: "comp_chorus_front_solo", label: "大密集＋手前ソロ" },
  { id: "comp_flank_frontline", label: "両脇塊＋手前ライン" },
  { id: "comp_flank_midline", label: "両脇塊＋中央ライン" },
  { id: "comp_backblock_sides_point", label: "奥塊＋脇＋手前点" },
  { id: "comp_twin_blocks_line", label: "双子ブロック＋下ライン" },
  { id: "comp_twin_blocks_pyramid", label: "双子ブロック＋手前三角" },
  { id: "comp_t_layout", label: "T字（上双子＋下縦）" },
  { id: "comp_fan_focal", label: "扇弧＋焦点ペア" },
  { id: "comp_triple_inv_vee", label: "三重逆Vクラスター" },
  { id: "comp_tilt_block_wing", label: "斜め塊＋側縦列" },
] as const;

export type CompositeLayoutPresetId =
  (typeof COMPOSITE_LAYOUT_PRESET_OPTIONS)[number]["id"];

const COMPOSITE_IDS = new Set<string>(
  COMPOSITE_LAYOUT_PRESET_OPTIONS.map((o) => o.id)
);

export function isCompositeLayoutPresetId(
  id: string
): id is CompositeLayoutPresetId {
  return COMPOSITE_IDS.has(id);
}

export function tryApplyCompositeLayoutPreset(
  preset: string,
  n: number,
  out: DancerSpot[]
): boolean {
  if (!COMPOSITE_IDS.has(preset)) return false;
  let idx = 0;

  switch (preset) {
    case "comp_dense_inv_triangle":
      pushInvTriangle(out, 0, n, 50, 50, true);
      break;

    case "comp_wings_diamond": {
      const [left, mid, right] = allocateByWeights(n, [2, 1.2, 2], 1);
      idx = pushGrid(out, idx, left, 2, 16, 48, STEP_X * 0.75, STEP_Y * 0.85);
      idx = pushDiamond(out, idx, mid, 50, 50);
      pushGrid(out, idx, right, 2, 84, 48, STEP_X * 0.75, STEP_Y * 0.85);
      break;
    }

    case "comp_wings_wedge": {
      const [left, mid, right] = allocateByWeights(n, [2, 0.6, 2], 1);
      idx = pushColumn(out, idx, left, 14, 50);
      idx = pushInvTriangle(out, idx, mid, 50, 52, false);
      pushColumn(out, idx, right, 86, 50);
      break;
    }

    case "comp_edge_diag_caps": {
      const [capL, band, capR] = allocateByWeights(n, [1, 2.2, 1], 2);
      const halfCap = Math.ceil(capL / 2);
      idx = pushGrid(out, idx, halfCap, 2, 12, 28);
      idx = pushGrid(out, idx, capL - halfCap, 2, 12, 72);
      idx = pushPolylineShape(out, idx, Math.ceil(band / 2), [
        { xPct: 28, yPct: 28 },
        { xPct: 72, yPct: 72 },
      ]);
      idx = pushPolylineShape(out, idx, band - Math.ceil(band / 2), [
        { xPct: 34, yPct: 22 },
        { xPct: 78, yPct: 66 },
      ]);
      const halfR = Math.ceil(capR / 2);
      idx = pushGrid(out, idx, halfR, 2, 88, 28);
      pushGrid(out, idx, capR - halfR, 2, 88, 72);
      break;
    }

    case "comp_diag_pair_accents": {
      const [sides, diags, accents] = allocateByWeights(n, [2, 3, 0.4], 1);
      const sideHalf = Math.ceil(sides / 2);
      idx = pushGrid(out, idx, sideHalf, 2, 12, 40);
      idx = pushGrid(out, idx, sides - sideHalf, 2, 88, 60);
      const d1 = Math.ceil(diags / 2);
      idx = pushPolylineShape(out, idx, d1, [
        { xPct: 26, yPct: 30 },
        { xPct: 74, yPct: 70 },
      ]);
      idx = pushPolylineShape(out, idx, diags - d1, [
        { xPct: 30, yPct: 24 },
        { xPct: 78, yPct: 64 },
      ]);
      // accents near center gap
      const xs = evenXs(accents, 50, 8, 40, 60);
      for (let i = 0; i < accents; i++) pushSpot(out, idx++, xs[i]!, 50);
      break;
    }

    case "comp_grid_column": {
      const [g, c] = allocateByWeights(n, [2.2, 1], 2);
      idx = pushGrid(out, idx, g, 4, 32, 48, STEP_X * 0.8, STEP_Y * 0.85);
      pushColumn(out, idx, c, 82, 50);
      break;
    }

    case "comp_grid_heart_column": {
      const [g, mid, c] = allocateByWeights(n, [2, 1, 1], 2);
      idx = pushGrid(out, idx, g, 4, 26, 46);
      idx = pushPolylineShape(out, idx, mid, [
        { xPct: 46, yPct: 38 },
        { xPct: 50, yPct: 32 },
        { xPct: 54, yPct: 38 },
        { xPct: 58, yPct: 44 },
        { xPct: 50, yPct: 62 },
        { xPct: 42, yPct: 44 },
        { xPct: 46, yPct: 38 },
      ]);
      pushColumn(out, idx, c, 86, 50);
      break;
    }

    case "comp_grid_x": {
      const [g, mid, x] = allocateByWeights(n, [2, 1, 0.9], 2);
      idx = pushGrid(out, idx, g, 4, 26, 46);
      idx = pushPolylineShape(out, idx, mid, [
        { xPct: 48, yPct: 58 },
        { xPct: 52, yPct: 48 },
        { xPct: 56, yPct: 42 },
        { xPct: 60, yPct: 48 },
        { xPct: 56, yPct: 58 },
        { xPct: 52, yPct: 64 },
      ]);
      pushXShape(out, idx, x, 82, 52, 12);
      break;
    }

    case "comp_dual_stagger": {
      const [l, r] = allocateByWeights(n, [1, 1.15], 3);
      idx = pushStaggerBlock(out, idx, l, 32, 48, 3);
      pushStaggerBlock(out, idx, r, 70, 52, 3);
      break;
    }

    case "comp_chorus_front_pair": {
      const front = Math.min(2, Math.max(1, Math.round(n * 0.06)));
      const main = n - front;
      idx = pushStaggerBlock(out, idx, main, 50, 42, 3);
      const xs = evenXs(front, 50, STEP_X, 40, 60);
      for (let i = 0; i < front; i++) pushSpot(out, idx++, xs[i]!, 82);
      break;
    }

    case "comp_chorus_front_solo": {
      if (n <= 1) {
        pushSpot(out, 0, 50, 50);
        break;
      }
      idx = pushStaggerBlock(out, idx, n - 1, 48, 42, 3);
      pushSpot(out, idx, 72, 84);
      break;
    }

    case "comp_flank_frontline": {
      const [fl, fr, back, front] = allocateByWeights(n, [1.2, 1.2, 0.6, 1], 2);
      idx = pushGrid(out, idx, fl, 3, 18, 48, STEP_X * 0.75, STEP_Y * 0.8);
      idx = pushGrid(out, idx, fr, 3, 82, 48, STEP_X * 0.75, STEP_Y * 0.8);
      const bh = Math.ceil(back / 2);
      idx = pushGrid(out, idx, bh, 2, 38, 28, STEP_X * 0.7, STEP_Y * 0.7);
      idx = pushGrid(out, idx, back - bh, 2, 62, 28, STEP_X * 0.7, STEP_Y * 0.7);
      {
        const xs = evenXs(front, 50, STEP_X, 28, 72);
        for (let i = 0; i < front; i++) pushSpot(out, idx++, xs[i]!, 72);
      }
      break;
    }

    case "comp_flank_midline": {
      const [fl, fr, mid] = allocateByWeights(n, [1.2, 1.2, 1.4], 2);
      idx = pushGrid(out, idx, fl, 3, 16, 50);
      idx = pushGrid(out, idx, fr, 3, 84, 50);
      {
        const xs = evenXs(mid, 50, STEP_X, 28, 72);
        for (let i = 0; i < mid; i++) pushSpot(out, idx++, xs[i]!, 48);
      }
      break;
    }

    case "comp_backblock_sides_point": {
      const [back, sl, sr, mid, tip] = allocateByWeights(
        n,
        [1.4, 0.9, 0.9, 1, 0.25],
        1
      );
      idx = pushGrid(out, idx, back, 4, 50, 28);
      idx = pushDiamond(out, idx, sl, 18, 52);
      idx = pushDiamond(out, idx, sr, 82, 52);
      {
        const xs = evenXs(mid, 50, STEP_X, 30, 70);
        for (let i = 0; i < mid; i++) pushSpot(out, idx++, xs[i]!, 58);
      }
      for (let i = 0; i < tip; i++) pushSpot(out, idx++, 50, 78 + i * 4);
      break;
    }

    case "comp_twin_blocks_line": {
      const [bl, br, line] = allocateByWeights(n, [1, 1, 1.2], 3);
      idx = pushGrid(out, idx, bl, 4, 30, 36);
      idx = pushGrid(out, idx, br, 4, 70, 36);
      {
        const xs = evenXs(line, 50, STEP_X * 0.7, 12, 88);
        for (let i = 0; i < line; i++) pushSpot(out, idx++, xs[i]!, 68);
      }
      break;
    }

    case "comp_twin_blocks_pyramid": {
      const [bl, br, tip] = allocateByWeights(n, [1.2, 1.2, 0.7], 3);
      idx = pushGrid(out, idx, bl, 4, 30, 34);
      idx = pushGrid(out, idx, br, 4, 70, 34);
      // tip as small upright pyramid at front
      const rows: number[] = [];
      let rem = tip;
      let w = 1;
      while (rem > 0) {
        const take = Math.min(w, rem);
        rows.push(take);
        rem -= take;
        w += 1;
      }
      const frontToBack = [...rows].reverse();
      for (let r = 0; r < frontToBack.length; r++) {
        const cnt = frontToBack[r]!;
        const y = 78 - r * 10;
        const xs = evenXs(cnt, 50, STEP_X * 0.75);
        for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
      }
      break;
    }

    case "comp_t_layout": {
      const [tl, tr, stem] = allocateByWeights(n, [1.2, 1.2, 1], 3);
      idx = pushGrid(out, idx, tl, 4, 30, 30);
      idx = pushGrid(out, idx, tr, 4, 70, 30);
      pushGrid(out, idx, stem, 2, 50, 68, STEP_X * 0.75, STEP_Y * 0.85);
      break;
    }

    case "comp_fan_focal": {
      const focal = Math.min(2, Math.max(1, Math.round(n * 0.08)));
      const arcN = n - focal;
      // 2〜3 concentric arcs
      const rings = arcN >= 18 ? 3 : 2;
      const per = allocateByWeights(arcN, Array(rings).fill(1), 2);
      for (let r = 0; r < rings; r++) {
        const cnt = per[r]!;
        const radius = 22 + r * 10;
        for (let i = 0; i < cnt; i++) {
          const u = cnt === 1 ? 0.5 : i / (cnt - 1);
          const ang = Math.PI * (0.18 + u * 0.64);
          pushSpot(
            out,
            idx++,
            50 + radius * 1.35 * Math.cos(ang),
            38 + radius * 0.95 * Math.sin(ang)
          );
        }
      }
      {
        const xs = evenXs(focal, 50, 8, 44, 56);
        for (let i = 0; i < focal; i++) pushSpot(out, idx++, xs[i]!, 78);
      }
      break;
    }

    case "comp_triple_inv_vee": {
      const [a, b, c, accents] = allocateByWeights(n, [1.2, 1.2, 0.9, 0.35], 2);
      idx = pushInvTriangle(out, idx, a, 32, 36, true);
      idx = pushInvTriangle(out, idx, b, 68, 36, true);
      idx = pushInvTriangle(out, idx, c, 50, 62, true);
      const xs = evenXs(accents, 50, 8, 42, 58);
      for (let i = 0; i < accents; i++)
        pushSpot(out, idx++, xs[i]!, i === 0 ? 18 : 82);
      break;
    }

    case "comp_tilt_block_wing": {
      const [main, wing, pair] = allocateByWeights(n, [3, 1, 0.3], 2);
      // tilted grid via diagonal shift per row
      const cols = 4;
      const rows = Math.ceil(main / cols);
      let placed = 0;
      for (let r = 0; r < rows && placed < main; r++) {
        const rowCnt = Math.min(cols, main - placed);
        const y = 28 + r * STEP_Y * 0.85;
        const cx = 38 + r * 3.5;
        const xs = evenXs(rowCnt, cx, STEP_X * 0.75, 10, 70);
        for (let j = 0; j < rowCnt; j++) {
          pushSpot(out, idx++, xs[j]!, y);
          placed++;
        }
      }
      idx = pushColumn(out, idx, wing, 86, 48);
      {
        const xs = evenXs(pair, 50, 8, 44, 56);
        for (let i = 0; i < pair; i++) pushSpot(out, idx++, xs[i]!, 78);
      }
      break;
    }

    default:
      return false;
  }

  // 人数保証（稀な端数ずれ対策）
  if (out.length > n) out.length = n;
  while (out.length < n) {
    pushSpot(out, out.length, 50, 50);
  }
  return true;
}
