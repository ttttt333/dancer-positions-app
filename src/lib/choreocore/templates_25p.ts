/**
 * 25人用テンプレートライブラリ
 * ステージ: 幅12m × 奥行8m、原点は中央 (x: 左右, y: 奥行き / +手前想定)
 */

import type { ChangeTier, Position, Template } from "./types";

const N = 25;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 横一列（y固定） */
function lineY(y: number, n = N, xSpan = 10): Position[] {
  const out: Position[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    out.push({ x: -xSpan / 2 + t * xSpan, y });
  }
  return out;
}

/** 複数行（各行の人数を指定） */
function rows(
  rowCounts: number[],
  yStart: number,
  yStep: number,
  xSpan = 10
): Position[] {
  const out: Position[] = [];
  let yi = 0;
  for (const count of rowCounts) {
    const y = yStart + yi * yStep;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      out.push({ x: -xSpan / 2 + t * xSpan, y });
    }
    yi += 1;
  }
  while (out.length < N) {
    out.push({ x: 0, y: yStart });
  }
  return out.slice(0, N);
}

function vee(pointTowardFront: boolean): Position[] {
  const out: Position[] = [];
  const tipY = pointTowardFront ? 2.5 : -2.5;
  const baseY = pointTowardFront ? -2.0 : 2.0;
  out.push({ x: 0, y: tipY });
  const remaining = N - 1;
  const bands = 6;
  let placed = 0;
  for (let b = 1; b <= bands && placed < remaining; b++) {
    const count = Math.min(2 + b, remaining - placed);
    const y = tipY + ((baseY - tipY) * b) / bands;
    const span = 1.2 * b;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      out.push({ x: -span + t * 2 * span, y });
      placed += 1;
      if (placed >= remaining) break;
    }
  }
  while (out.length < N) out.push({ x: 0, y: baseY });
  return out.slice(0, N);
}

function diamond(): Position[] {
  const out: Position[] = [{ x: 0, y: 0 }];
  const rings = [
    { r: 1.2, n: 4 },
    { r: 2.4, n: 8 },
    { r: 3.6, n: 12 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n && out.length < N; i++) {
      const a = (Math.PI * 2 * i) / ring.n + Math.PI / 4;
      out.push({
        x: clamp(Math.cos(a) * ring.r * 1.4, -5.5, 5.5),
        y: clamp(Math.sin(a) * ring.r * 0.9, -3.5, 3.5),
      });
    }
  }
  while (out.length < N) out.push({ x: 0, y: 0 });
  return out.slice(0, N);
}

function circle(radius = 3.2): Position[] {
  const out: Position[] = [];
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    out.push({
      x: clamp(Math.cos(a) * radius * 1.3, -5.5, 5.5),
      y: clamp(Math.sin(a) * radius * 0.85, -3.5, 3.5),
    });
  }
  return out;
}

function wings(): Position[] {
  const out: Position[] = [];
  const center = 9;
  for (let i = 0; i < center; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    out.push({ x: (col - 1) * 1.1, y: 1.5 - row * 1.2 });
  }
  const wing = (N - center) / 2;
  for (let i = 0; i < wing; i++) {
    out.push({
      x: -4.5 + (i % 2) * 0.8,
      y: 2.2 - Math.floor(i / 2) * 1.1,
    });
  }
  for (let i = 0; i < wing; i++) {
    out.push({
      x: 3.7 + (i % 2) * 0.8,
      y: 2.2 - Math.floor(i / 2) * 1.1,
    });
  }
  while (out.length < N) out.push({ x: 0, y: 0 });
  return out.slice(0, N);
}

function stagger(tight: boolean): Position[] {
  const rowsN = 5;
  const cols = 5;
  const dx = tight ? 1.6 : 2.1;
  const dy = tight ? 1.1 : 1.4;
  const out: Position[] = [];
  for (let r = 0; r < rowsN; r++) {
    for (let c = 0; c < cols; c++) {
      if (out.length >= N) break;
      const offset = r % 2 === 0 ? 0 : dx / 2;
      out.push({
        x: clamp(-dx * 2 + c * dx + offset, -5.5, 5.5),
        y: clamp(2.4 - r * dy, -3.5, 3.5),
      });
    }
  }
  return out.slice(0, N);
}

function block3(): Position[] {
  const out: Position[] = [];
  const groups = [
    { cx: -3.5, n: 8 },
    { cx: 0, n: 9 },
    { cx: 3.5, n: 8 },
  ];
  for (const g of groups) {
    for (let i = 0; i < g.n; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      out.push({
        x: g.cx + (col - 1) * 0.9,
        y: 1.8 - row * 1.2,
      });
    }
  }
  return out.slice(0, N);
}

function fan(): Position[] {
  const out: Position[] = [];
  const arcs = [
    { y: 2.5, n: 5, span: 6 },
    { y: 1.0, n: 7, span: 8 },
    { y: -0.5, n: 7, span: 9 },
    { y: -2.0, n: 6, span: 8 },
  ];
  for (const a of arcs) {
    for (let i = 0; i < a.n; i++) {
      const t = a.n === 1 ? 0.5 : i / (a.n - 1);
      out.push({ x: -a.span / 2 + t * a.span, y: a.y });
    }
  }
  while (out.length < N) out.push({ x: 0, y: 0 });
  return out.slice(0, N);
}

function xShape(): Position[] {
  const out: Position[] = [];
  const arm = 12;
  for (let i = 0; i < arm && out.length < N; i++) {
    const t = (i / (arm - 1)) * 2 - 1;
    out.push({ x: t * 4.5, y: t * 2.8 });
  }
  for (let i = 0; i < arm && out.length < N; i++) {
    const t = (i / (arm - 1)) * 2 - 1;
    out.push({ x: t * 4.5, y: -t * 2.8 });
  }
  while (out.length < N) out.push({ x: 0, y: 0 });
  return out.slice(0, N);
}

export type TemplateEnergy = "low" | "mid" | "high";
export type TemplateShape =
  | "line"
  | "grid"
  | "wedge"
  | "spread"
  | "cluster"
  | "arc";

export type TaggedTemplate = Template & {
  energy: TemplateEnergy;
  shape: TemplateShape;
};

function make(
  id: string,
  tier: ChangeTier,
  name: string,
  positions: Position[],
  energy: TemplateEnergy,
  shape: TemplateShape
): TaggedTemplate {
  return {
    id,
    tier,
    name,
    positions: positions.slice(0, N),
    energy,
    shape,
  };
}

export const TEMPLATES_25P: TaggedTemplate[] = [
  make("maj_vee_front", "major", "V字（手前先端）", vee(true), "high", "wedge"),
  make("maj_vee_back", "major", "逆V字（奥先端）", vee(false), "high", "wedge"),
  make("maj_diamond", "major", "ダイヤモンド", diamond(), "high", "spread"),
  make("maj_circle", "major", "円周", circle(), "high", "spread"),
  make("maj_wings", "major", "ウィング展開", wings(), "high", "spread"),
  make("maj_x", "major", "X字", xShape(), "high", "spread"),
  make("maj_fan", "major", "扇状", fan(), "high", "arc"),
  make("maj_block3", "major", "3ブロック分散", block3(), "mid", "cluster"),

  make(
    "med_rows55",
    "medium",
    "5×5グリッド",
    rows([5, 5, 5, 5, 5], 2.4, -1.2, 9),
    "mid",
    "grid"
  ),
  make(
    "med_pyramid",
    "medium",
    "ピラミッド",
    rows([3, 5, 7, 10], 2.2, -1.3, 10),
    "mid",
    "wedge"
  ),
  make(
    "med_inv_pyramid",
    "medium",
    "逆ピラミッド",
    rows([10, 7, 5, 3], 2.2, -1.3, 10),
    "mid",
    "wedge"
  ),
  make("med_stagger", "medium", "千鳥", stagger(false), "mid", "grid"),
  make("med_stagger_tight", "medium", "千鳥（密）", stagger(true), "low", "grid"),
  make(
    "med_two_deep",
    "medium",
    "2列厚め",
    rows([12, 13], 1.2, -2.4, 10),
    "mid",
    "line"
  ),
  make(
    "med_three_rows",
    "medium",
    "3列",
    rows([8, 9, 8], 2.0, -2.0, 10),
    "mid",
    "grid"
  ),
  make("med_arc", "medium", "弧", fan(), "mid", "arc"),

  make("min_line_mid", "minor", "横一列（中）", lineY(0.5, N, 10), "low", "line"),
  make(
    "min_line_front",
    "minor",
    "横一列（手前）",
    lineY(2.2, N, 10),
    "low",
    "line"
  ),
  make("min_line_back", "minor", "横一列（奥）", lineY(-2.0, N, 10), "low", "line"),
  make(
    "min_two_rows",
    "minor",
    "2列",
    rows([12, 13], 1.0, -2.0, 9.5),
    "low",
    "line"
  ),
  make("min_stagger_soft", "minor", "浅い千鳥", stagger(true), "low", "grid"),
  make(
    "min_compact",
    "minor",
    "中央密集",
    rows([5, 5, 5, 5, 5], 1.6, -0.9, 6),
    "low",
    "cluster"
  ),
  make(
    "min_wide_line",
    "minor",
    "横一列（広め）",
    lineY(0.8, N, 11),
    "low",
    "line"
  ),
  make(
    "min_three_soft",
    "minor",
    "3列（浅）",
    rows([8, 9, 8], 1.4, -1.4, 9),
    "low",
    "grid"
  ),
];

export function templatesForTier(tier: ChangeTier): TaggedTemplate[] {
  return TEMPLATES_25P.filter((t) => t.tier === tier);
}

export function mirrorTemplate(t: TaggedTemplate): TaggedTemplate {
  return {
    ...t,
    id: `${t.id}__mx`,
    name: `${t.name}（左右反転）`,
    positions: t.positions.map((p) => ({ x: -p.x, y: p.y })),
  };
}

export function shiftTemplate(
  t: TaggedTemplate,
  dy: number,
  suffix: string
): TaggedTemplate {
  return {
    ...t,
    id: `${t.id}__${suffix}`,
    name: `${t.name}（${suffix}）`,
    positions: t.positions.map((p) => ({
      x: p.x,
      y: clamp(p.y + dy, -3.5, 3.5),
    })),
  };
}

/**
 * 人数 n にリサンプル。空間的に離れた点を優先（少人数でも形が潰れにくい）。
 */
export function resamplePositions(positions: Position[], n: number): Position[] {
  if (n <= 0) return [];
  if (positions.length === 0) {
    return Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  }
  if (positions.length === n) {
    return positions.map((p) => ({ ...p }));
  }
  if (n === 1) {
    return [{ ...positions[Math.floor(positions.length / 2)]! }];
  }

  const pts = positions.map((p) => ({ ...p }));
  const start = Math.floor(pts.length / 2);
  const chosen: number[] = [start];
  const chosenSet = new Set<number>([start]);
  const minDistSq = new Float64Array(pts.length).fill(Number.POSITIVE_INFINITY);

  while (chosen.length < n) {
    const last = pts[chosen[chosen.length - 1]!]!;
    for (let i = 0; i < pts.length; i++) {
      if (chosenSet.has(i)) continue;
      const p = pts[i]!;
      const d = (p.x - last.x) ** 2 + (p.y - last.y) ** 2;
      if (d < minDistSq[i]!) minDistSq[i] = d;
    }
    let bestI = -1;
    let bestD = -1;
    for (let i = 0; i < pts.length; i++) {
      if (chosenSet.has(i)) continue;
      if (minDistSq[i]! > bestD) {
        bestD = minDistSq[i]!;
        bestI = i;
      }
    }
    if (bestI < 0) break;
    chosen.push(bestI);
    chosenSet.add(bestI);
  }

  const out = chosen.map((i) => ({ ...pts[i]! }));
  out.sort((a, b) => a.x - b.x || a.y - b.y);

  // 重複座標は棄却せず、次に離れた未使用点があれば差し替え。揺らぎ（jitter）は入れない。
  const seen = new Set<string>();
  const unique: Position[] = [];
  for (const p of out) {
    const key = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  if (unique.length >= n) return unique.slice(0, n);

  // 足りない分は未使用テンプレ点から追加（距離優先）
  while (unique.length < n) {
    let bestI = -1;
    let bestD = -1;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const key = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
      if (seen.has(key)) continue;
      let minD = Infinity;
      for (const u of unique) {
        const d = (p.x - u.x) ** 2 + (p.y - u.y) ** 2;
        if (d < minD) minD = d;
      }
      if (minD > bestD) {
        bestD = minD;
        bestI = i;
      }
    }
    if (bestI < 0) break;
    const p = pts[bestI]!;
    seen.add(`${p.x.toFixed(3)},${p.y.toFixed(3)}`);
    unique.push({ ...p });
  }
  return unique;
}
