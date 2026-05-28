import type { DancerSpot } from "../types/choreography";
import { modDancerColorIndex } from "./dancerColorPalette";
import { FORMATION_REFERENCE_STEP_PCT } from "./dancerSpacing";

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

function evenRowCounts(n: number, targetRows: number): number[] {
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

function xPctInPyramidGrid(
  j: number,
  cnt: number,
  maxCnt: number,
  _numRows: number,
  maxHalfWidth = 32
): number {
  if (cnt <= 1) return 50;
  if (maxCnt <= 1) return 50;
  const stepCap = (maxHalfWidth * 2) / (maxCnt - 1);
  const step = Math.min(TARGET_STEP_X, stepCap);
  return 50 + (j - (cnt - 1) / 2) * step;
}

function applyMultiRows(n: number, targetRows: number, out: DancerSpot[]) {
  const rowCounts = evenRowCounts(n, targetRows);
  const nr = rowCounts.length;
  let idx = 0;
  for (let r = 0; r < nr; r++) {
    const cnt = rowCounts[r]!;
    const y = yPctPyramidRow(nr - 1 - r, nr);
    const xs = evenSpacingPositions(cnt, 50, TARGET_STEP_X, 5, 95);
    for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
  }
}

function applyStaggerRows(n: number, targetRows: number, out: DancerSpot[]) {
  const rowCounts = evenRowCounts(n, targetRows);
  const nr = rowCounts.length;
  let idx = 0;
  for (let r = 0; r < nr; r++) {
    const cnt = rowCounts[r]!;
    const y = yPctPyramidRow(nr - 1 - r, nr);
    const offset = r % 2 === 1 ? TARGET_STEP_X / 2 : 0;
    const xs = evenSpacingPositions(cnt, 50 + offset / 2, TARGET_STEP_X, 5, 95);
    for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
  }
}

function applyEvenLines(n: number, numLines: number, out: DancerSpot[]) {
  const per = Math.ceil(n / numLines);
  const ys = evenSpacingPositions(numLines, 48, TARGET_STEP_Y, 18, 78);
  for (let i = 0; i < n; i++) {
    const line = i % numLines;
    const col = Math.floor(i / numLines);
    const xs = evenSpacingPositions(per, 50, TARGET_STEP_X, 8, 92);
    pushSpot(out, i, xs[col] ?? 50, ys[line]!);
  }
}

function applyChevron(
  n: number,
  out: DancerSpot[],
  opts: { lean: "left" | "right" | "center"; spread: number }
) {
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const baseX =
      opts.lean === "left" ? 36 : opts.lean === "right" ? 64 : 50;
    const x = baseX + (u - 0.5) * opts.spread;
    const y = 68 - Math.abs(u - 0.5) * 36;
    pushSpot(out, i, x, y);
  }
}

function applyArc(
  n: number,
  out: DancerSpot[],
  opts: { cx: number; spread: number; depth: number }
) {
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const ang = Math.PI * (0.15 + u * 0.7);
    const x = opts.cx + opts.spread * Math.cos(ang);
    const y = 52 + opts.depth * Math.sin(ang);
    pushSpot(out, i, x, y);
  }
}

function applyPyramidVariant(
  n: number,
  out: DancerSpot[],
  opts: { maxHalfWidth: number; yUp: number; yDn: number }
) {
  const rowCounts: number[] = [];
  let rem = n;
  let k = 1;
  while (rem > 0) {
    const take = Math.min(k, rem);
    rowCounts.push(take);
    rem -= take;
    k++;
  }
  const nr = rowCounts.length;
  const maxCnt = Math.max(1, ...rowCounts);
  let idx = 0;
  for (let r = 0; r < nr; r++) {
    const cnt = rowCounts[r]!;
    const y = yPctPyramidRow(nr - 1 - r, nr, opts.yUp, opts.yDn);
    for (let j = 0; j < cnt; j++) {
      pushSpot(
        out,
        idx++,
        xPctInPyramidGrid(j, cnt, maxCnt, nr, opts.maxHalfWidth),
        y
      );
    }
  }
}

/** 追加50種の雛形定義 */
export const EXTRA_LAYOUT_PRESET_OPTIONS = [
  { id: "extra_rows_13", label: "13列" },
  { id: "extra_rows_14", label: "14列" },
  { id: "extra_rows_15", label: "15列" },
  { id: "extra_stagger_6", label: "6段千鳥" },
  { id: "extra_stagger_7", label: "7段千鳥" },
  { id: "extra_line_mid", label: "横一列（中央帯）" },
  { id: "extra_line_high", label: "横一列（奥寄り）" },
  { id: "extra_line_low", label: "横一列（手前寄り）" },
  { id: "extra_three_lines", label: "3ライン均等" },
  { id: "extra_four_lines", label: "4ライン均等" },
  { id: "extra_five_lines", label: "5ライン均等" },
  { id: "extra_chevron_left", label: "シェブロン（左）" },
  { id: "extra_chevron_right", label: "シェブロン（右）" },
  { id: "extra_chevron_wide", label: "シェブロン（広）" },
  { id: "extra_chevron_tight", label: "シェブロン（狭）" },
  { id: "extra_horseshoe", label: "馬蹄形" },
  { id: "extra_horseshoe_tight", label: "馬蹄形（狭）" },
  { id: "extra_c_shape", label: "C字形" },
  { id: "extra_c_shape_open", label: "C字（開口広）" },
  { id: "extra_nested_square", label: "二重四角" },
  { id: "extra_nested_square_tight", label: "二重四角（狭）" },
  { id: "extra_triple_line_front", label: "三重ライン（手前基準）" },
  { id: "extra_triple_line_back", label: "三重ライン（奥基準）" },
  { id: "extra_pyramid_wide", label: "ピラミッド（広）" },
  { id: "extra_pyramid_narrow", label: "ピラミッド（狭）" },
  { id: "extra_pyramid_deep", label: "ピラミッド（深）" },
  { id: "extra_arc_wide", label: "円弧（広）" },
  { id: "extra_arc_deep", label: "円弧（深）" },
  { id: "extra_arc_left", label: "円弧（左寄せ）" },
  { id: "extra_arc_right", label: "円弧（右寄せ）" },
  { id: "extra_scatter_tight", label: "ランダム（狭域）" },
  { id: "extra_block_front", label: "ブロック（手前）" },
  { id: "extra_block_back", label: "ブロック（奥）" },
  { id: "extra_block_center", label: "ブロック（中央塊）" },
  { id: "extra_diamond_wide", label: "ひし形（広）" },
  { id: "extra_diamond_tall", label: "ひし形（縦長）" },
  { id: "extra_star_4", label: "星形（4点）" },
  { id: "extra_star_8", label: "星形（8点）" },
  { id: "extra_runway", label: "ランウェイ" },
  { id: "extra_runway_wide", label: "ランウェイ（広）" },
  { id: "extra_wings_only", label: "ウィングのみ" },
  { id: "extra_center_surround", label: "センター囲み" },
  { id: "extra_diagonal_cross", label: "対角クロス" },
  { id: "extra_parallel_3", label: "並行3ライン" },
  { id: "extra_parallel_4", label: "並行4ライン" },
  { id: "extra_v_double", label: "二重V字" },
  { id: "extra_stair_inv_3", label: "逆段3" },
  { id: "extra_stair_inv_4", label: "逆段4" },
  { id: "extra_fan_half_left", label: "半扇（左）" },
  { id: "extra_fan_half_right", label: "半扇（右）" },
] as const;

export type ExtraLayoutPresetId =
  (typeof EXTRA_LAYOUT_PRESET_OPTIONS)[number]["id"];

export const EXTRA_PRESET_CATEGORY = {
  label: "✨ 追加Vol.2",
  ids: EXTRA_LAYOUT_PRESET_OPTIONS.map((o) => o.id),
} as const;

const EXTRA_IDS = new Set<string>(EXTRA_LAYOUT_PRESET_OPTIONS.map((o) => o.id));

export function isExtraLayoutPresetId(id: string): id is ExtraLayoutPresetId {
  return EXTRA_IDS.has(id);
}

/** 追加雛形を out に書き込む。対応 id で true。 */
export function tryApplyExtraLayoutPreset(
  preset: string,
  n: number,
  out: DancerSpot[]
): boolean {
  if (!EXTRA_IDS.has(preset)) return false;

  switch (preset) {
    case "extra_rows_13":
      applyMultiRows(n, 13, out);
      break;
    case "extra_rows_14":
      applyMultiRows(n, 14, out);
      break;
    case "extra_rows_15":
      applyMultiRows(n, 15, out);
      break;
    case "extra_stagger_6":
      applyStaggerRows(n, 6, out);
      break;
    case "extra_stagger_7":
      applyStaggerRows(n, 7, out);
      break;
    case "extra_line_mid": {
      const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 10, 90);
      for (let i = 0; i < n; i++) pushSpot(out, i, xs[i]!, 48);
      break;
    }
    case "extra_line_high": {
      const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 10, 90);
      for (let i = 0; i < n; i++) pushSpot(out, i, xs[i]!, 32);
      break;
    }
    case "extra_line_low": {
      const xs = evenSpacingPositions(n, 50, TARGET_STEP_X, 10, 90);
      for (let i = 0; i < n; i++) pushSpot(out, i, xs[i]!, 68);
      break;
    }
    case "extra_three_lines":
      applyEvenLines(n, 3, out);
      break;
    case "extra_four_lines":
      applyEvenLines(n, 4, out);
      break;
    case "extra_five_lines":
      applyEvenLines(n, 5, out);
      break;
    case "extra_chevron_left":
      applyChevron(n, out, { lean: "left", spread: 48 });
      break;
    case "extra_chevron_right":
      applyChevron(n, out, { lean: "right", spread: 48 });
      break;
    case "extra_chevron_wide":
      applyChevron(n, out, { lean: "center", spread: 72 });
      break;
    case "extra_chevron_tight":
      applyChevron(n, out, { lean: "center", spread: 32 });
      break;
    case "extra_horseshoe": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const ang = Math.PI * (0.1 + u * 0.8);
        pushSpot(out, i, 50 + 34 * Math.cos(ang), 54 + 22 * Math.sin(ang));
      }
      break;
    }
    case "extra_horseshoe_tight": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const ang = Math.PI * (0.15 + u * 0.7);
        pushSpot(out, i, 50 + 24 * Math.cos(ang), 52 + 16 * Math.sin(ang));
      }
      break;
    }
    case "extra_c_shape": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const ang = Math.PI * (0.35 + u * 0.55);
        pushSpot(out, i, 58 + 28 * Math.cos(ang), 50 + 24 * Math.sin(ang));
      }
      break;
    }
    case "extra_c_shape_open": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const ang = Math.PI * (0.25 + u * 0.65);
        pushSpot(out, i, 62 + 32 * Math.cos(ang), 50 + 28 * Math.sin(ang));
      }
      break;
    }
    case "extra_nested_square": {
      const outer = Math.ceil(n * 0.65);
      const inner = n - outer;
      const outerPts = [
        { x: 18, y: 28 },
        { x: 82, y: 28 },
        { x: 82, y: 72 },
        { x: 18, y: 72 },
      ];
      for (let i = 0; i < outer; i++) {
        const p = outerPts[i % outerPts.length]!;
        pushSpot(out, i, p.x, p.y + Math.floor(i / outerPts.length) * 6);
      }
      const innerPts = [
        { x: 38, y: 40 },
        { x: 62, y: 40 },
        { x: 62, y: 60 },
        { x: 38, y: 60 },
      ];
      for (let i = 0; i < inner; i++) {
        const p = innerPts[i % innerPts.length]!;
        pushSpot(out, outer + i, p.x, p.y);
      }
      break;
    }
    case "extra_nested_square_tight": {
      const outer = Math.ceil(n * 0.6);
      const inner = n - outer;
      const outerPts = [
        { x: 28, y: 34 },
        { x: 72, y: 34 },
        { x: 72, y: 66 },
        { x: 28, y: 66 },
      ];
      for (let i = 0; i < outer; i++) {
        const p = outerPts[i % outerPts.length]!;
        pushSpot(out, i, p.x, p.y);
      }
      const innerPts = [
        { x: 42, y: 44 },
        { x: 58, y: 44 },
        { x: 58, y: 56 },
        { x: 42, y: 56 },
      ];
      for (let i = 0; i < inner; i++) {
        const p = innerPts[i % innerPts.length]!;
        pushSpot(out, outer + i, p.x, p.y);
      }
      break;
    }
    case "extra_triple_line_front": {
      const lines = 3;
      const per = Math.ceil(n / lines);
      const ys = [68, 50, 32];
      for (let i = 0; i < n; i++) {
        const line = i % lines;
        const col = Math.floor(i / lines);
        const xs = evenSpacingPositions(per, 50, TARGET_STEP_X, 8, 92);
        pushSpot(out, i, xs[col] ?? 50, ys[line]!);
      }
      break;
    }
    case "extra_triple_line_back": {
      const lines = 3;
      const per = Math.ceil(n / lines);
      const ys = [32, 50, 68];
      for (let i = 0; i < n; i++) {
        const line = i % lines;
        const col = Math.floor(i / lines);
        const xs = evenSpacingPositions(per, 50, TARGET_STEP_X, 8, 92);
        pushSpot(out, i, xs[col] ?? 50, ys[line]!);
      }
      break;
    }
    case "extra_pyramid_wide":
      applyPyramidVariant(n, out, { maxHalfWidth: 42, yUp: 18, yDn: 76 });
      break;
    case "extra_pyramid_narrow":
      applyPyramidVariant(n, out, { maxHalfWidth: 22, yUp: 20, yDn: 74 });
      break;
    case "extra_pyramid_deep":
      applyPyramidVariant(n, out, { maxHalfWidth: 34, yUp: 14, yDn: 82 });
      break;
    case "extra_arc_wide":
      applyArc(n, out, { cx: 50, spread: 42, depth: 28 });
      break;
    case "extra_arc_deep":
      applyArc(n, out, { cx: 50, spread: 34, depth: 36 });
      break;
    case "extra_arc_left":
      applyArc(n, out, { cx: 36, spread: 38, depth: 26 });
      break;
    case "extra_arc_right":
      applyArc(n, out, { cx: 64, spread: 38, depth: 26 });
      break;
    case "extra_scatter_tight": {
      for (let i = 0; i < n; i++) {
        const x = 50 + Math.sin(i * 2.17 + 0.5) * 18 + Math.cos(i * 1.33) * 8;
        const y = 50 + Math.cos(i * 1.71) * 14 + Math.sin(i * 0.83) * 6;
        pushSpot(out, i, x, y);
      }
      break;
    }
    case "extra_block_front": {
      const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(n))));
      const per = Math.ceil(n / cols);
      const xs = evenSpacingPositions(cols, 50, TARGET_STEP_X, 14, 86);
      const ys = evenSpacingPositions(per, 66, TARGET_STEP_Y * 0.9, 52, 78);
      for (let i = 0; i < n; i++) {
        pushSpot(out, i, xs[i % cols]!, ys[Math.floor(i / cols)]!);
      }
      break;
    }
    case "extra_block_back": {
      const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(n))));
      const per = Math.ceil(n / cols);
      const xs = evenSpacingPositions(cols, 50, TARGET_STEP_X, 14, 86);
      const ys = evenSpacingPositions(per, 34, TARGET_STEP_Y * 0.9, 20, 46);
      for (let i = 0; i < n; i++) {
        pushSpot(out, i, xs[i % cols]!, ys[Math.floor(i / cols)]!);
      }
      break;
    }
    case "extra_block_center": {
      const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))));
      const per = Math.ceil(n / cols);
      const xs = evenSpacingPositions(cols, 50, TARGET_STEP_X, 22, 78);
      const ys = evenSpacingPositions(per, 50, TARGET_STEP_Y * 0.85, 34, 66);
      for (let i = 0; i < n; i++) {
        pushSpot(out, i, xs[i % cols]!, ys[Math.floor(i / cols)]!);
      }
      break;
    }
    case "extra_diamond_wide": {
      const pts = [
        { x: 50, y: 24 },
        { x: 78, y: 50 },
        { x: 50, y: 76 },
        { x: 22, y: 50 },
      ];
      for (let i = 0; i < n; i++) {
        const p = pts[i % pts.length]!;
        pushSpot(out, i, p.x, p.y + Math.floor(i / pts.length) * 4);
      }
      break;
    }
    case "extra_diamond_tall": {
      const pts = [
        { x: 50, y: 18 },
        { x: 68, y: 50 },
        { x: 50, y: 82 },
        { x: 32, y: 50 },
      ];
      for (let i = 0; i < n; i++) {
        const p = pts[i % pts.length]!;
        pushSpot(out, i, p.x, p.y);
      }
      break;
    }
    case "extra_star_4": {
      const pts = [
        { x: 50, y: 22 },
        { x: 74, y: 50 },
        { x: 50, y: 78 },
        { x: 26, y: 50 },
      ];
      for (let i = 0; i < n; i++) {
        const p = pts[i % pts.length]!;
        pushSpot(out, i, p.x, p.y);
      }
      break;
    }
    case "extra_star_8": {
      const pts = [
        { x: 50, y: 20 },
        { x: 64, y: 32 },
        { x: 78, y: 50 },
        { x: 64, y: 68 },
        { x: 50, y: 80 },
        { x: 36, y: 68 },
        { x: 22, y: 50 },
        { x: 36, y: 32 },
      ];
      for (let i = 0; i < n; i++) {
        const p = pts[i % pts.length]!;
        pushSpot(out, i, p.x, p.y);
      }
      break;
    }
    case "extra_runway": {
      const half = Math.ceil(n / 2);
      const ys = evenSpacingPositions(half, 50, TARGET_STEP_Y, 22, 78);
      for (let i = 0; i < half; i++) pushSpot(out, i, 42, ys[i]!);
      for (let i = half; i < n; i++) pushSpot(out, i, 58, ys[i - half]!);
      break;
    }
    case "extra_runway_wide": {
      const half = Math.ceil(n / 2);
      const ys = evenSpacingPositions(half, 50, TARGET_STEP_Y, 20, 80);
      for (let i = 0; i < half; i++) pushSpot(out, i, 34, ys[i]!);
      for (let i = half; i < n; i++) pushSpot(out, i, 66, ys[i - half]!);
      break;
    }
    case "extra_wings_only": {
      const left = Math.ceil(n / 2);
      const right = n - left;
      const ysL = evenSpacingPositions(left, 50, TARGET_STEP_Y, 24, 76);
      const ysR = evenSpacingPositions(right, 50, TARGET_STEP_Y, 24, 76);
      for (let i = 0; i < left; i++) pushSpot(out, i, 22, ysL[i]!);
      for (let i = 0; i < right; i++) pushSpot(out, left + i, 78, ysR[i]!);
      break;
    }
    case "extra_center_surround": {
      if (n <= 1) {
        pushSpot(out, 0, 50, 50);
        break;
      }
      pushSpot(out, 0, 50, 50);
      for (let i = 1; i < n; i++) {
        const ang = ((i - 1) / Math.max(n - 1, 1)) * Math.PI * 2 - Math.PI / 2;
        pushSpot(out, i, 50 + 24 * Math.cos(ang), 50 + 20 * Math.sin(ang));
      }
      break;
    }
    case "extra_diagonal_cross": {
      const half = Math.ceil(n / 2);
      for (let i = 0; i < half; i++) {
        const u = half === 1 ? 0.5 : i / (half - 1);
        pushSpot(out, i, 22 + u * 56, 28 + u * 44);
      }
      for (let i = half; i < n; i++) {
        const j = i - half;
        const u = n - half === 1 ? 0.5 : j / (n - half - 1 || 1);
        pushSpot(out, i, 22 + u * 56, 72 - u * 44);
      }
      break;
    }
    case "extra_parallel_3": {
      const per = Math.ceil(n / 3);
      const xs = [32, 50, 68];
      const ys = evenSpacingPositions(per, 50, TARGET_STEP_Y, 20, 78);
      for (let i = 0; i < n; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        pushSpot(out, i, xs[col]!, ys[row] ?? 50);
      }
      break;
    }
    case "extra_parallel_4": {
      const per = Math.ceil(n / 4);
      const xs = evenSpacingPositions(4, 50, TARGET_STEP_X, 12, 88);
      const ys = evenSpacingPositions(per, 50, TARGET_STEP_Y, 20, 78);
      for (let i = 0; i < n; i++) {
        pushSpot(out, i, xs[i % 4]!, ys[Math.floor(i / 4)] ?? 50);
      }
      break;
    }
    case "extra_v_double": {
      const half = Math.ceil(n / 2);
      for (let i = 0; i < half; i++) {
        const u = half === 1 ? 0.5 : i / (half - 1);
        pushSpot(out, i, 50 - u * 28, 68 - u * 24);
      }
      for (let i = half; i < n; i++) {
        const j = i - half;
        const u = n - half === 1 ? 0.5 : j / (n - half - 1 || 1);
        pushSpot(out, i, 50 + u * 28, 68 - u * 24);
      }
      break;
    }
    case "extra_stair_inv_3": {
      const rowCounts = evenRowCounts(n, 3);
      const nr = rowCounts.length;
      let idx = 0;
      for (let r = 0; r < nr; r++) {
        const cnt = rowCounts[r]!;
        const y = yPctPyramidRow(r, nr);
        const xs = evenSpacingPositions(cnt, 50, TARGET_STEP_X, 8, 92);
        for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
      }
      break;
    }
    case "extra_stair_inv_4": {
      const rowCounts = evenRowCounts(n, 4);
      const nr = rowCounts.length;
      let idx = 0;
      for (let r = 0; r < nr; r++) {
        const cnt = rowCounts[r]!;
        const y = yPctPyramidRow(r, nr);
        const xs = evenSpacingPositions(cnt, 50, TARGET_STEP_X, 8, 92);
        for (let j = 0; j < cnt; j++) pushSpot(out, idx++, xs[j]!, y);
      }
      break;
    }
    case "extra_fan_half_left": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const ang = Math.PI * (0.55 + u * 0.35);
        pushSpot(out, i, 50 + 36 * Math.cos(ang), 58 + 24 * Math.sin(ang));
      }
      break;
    }
    case "extra_fan_half_right": {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const ang = Math.PI * (0.1 + u * 0.35);
        pushSpot(out, i, 50 + 36 * Math.cos(ang), 58 + 24 * Math.sin(ang));
      }
      break;
    }
    default:
      return false;
  }
  return true;
}
