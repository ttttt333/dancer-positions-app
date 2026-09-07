/**
 * 客席側から見て左右対称になる配分・配置ヘルパー。
 * 余り人数は中央寄りへ、不完全な列は手前（客席）基準で揃える。
 */

export type PctPoint = { xPct: number; yPct: number };

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function evenSpacing(
  count: number,
  center: number,
  preferredStep: number,
  minPct: number,
  maxPct: number
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [center];
  const halfSpan = Math.min(center - minPct, maxPct - center);
  const maxTotal = Math.max(0, halfSpan * 2);
  const desiredTotal = preferredStep * (count - 1);
  const step = desiredTotal <= maxTotal ? preferredStep : maxTotal / (count - 1);
  const start = center - (step * (count - 1)) / 2;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function yAlongDepth(rFromBack: number, numRows: number, yUp: number, yDn: number): number {
  if (numRows <= 1) return (yUp + yDn) / 2;
  return yUp + (rFromBack / (numRows - 1)) * (yDn - yUp);
}

/**
 * n 人を parts 個へ、左右対称になるよう配分する。
 * 余りは中央から外側へ 1 人ずつ足す（例: 10÷4 → [2,3,3,2]）。
 */
export function balancedPartition(n: number, parts: number): number[] {
  if (parts <= 0 || n <= 0) return [];
  const p = Math.min(parts, n);
  const counts = new Array<number>(p).fill(Math.floor(n / p));
  let rem = n - counts.reduce((a, b) => a + b, 0);
  const mid = (p - 1) / 2;
  const order = Array.from({ length: p }, (_, i) => i).sort(
    (a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b
  );
  let k = 0;
  while (rem > 0) {
    counts[order[k % p]!]! += 1;
    rem -= 1;
    k += 1;
  }
  return counts;
}

/**
 * 縦列（columns_* / 並行ライン）: 列人数を対称配分し、各列は客席側から埋める。
 * 短い列は奥が欠けるので、客席から見て前列が揃って見える。
 */
export function balancedVerticalColumnSpots(
  n: number,
  cols: number,
  opts?: {
    stepX?: number;
    xMin?: number;
    xMax?: number;
    yUp?: number;
    yDn?: number;
  }
): PctPoint[] {
  if (n <= 0) return [];
  const actualCols = Math.min(Math.max(1, cols), n);
  const heights = balancedPartition(n, actualCols);
  const maxH = Math.max(1, ...heights);
  const stepX = opts?.stepX ?? 12;
  const xMin = opts?.xMin ?? 10;
  const xMax = opts?.xMax ?? 90;
  const yUp = opts?.yUp ?? 18;
  const yDn = opts?.yDn ?? 78;
  const xs = evenSpacing(actualCols, 50, stepX, xMin, xMax);
  const out: PctPoint[] = [];
  for (let c = 0; c < actualCols; c += 1) {
    const h = heights[c]!;
    for (let j = 0; j < h; j += 1) {
      // j=0 が客席側（y 大）
      const y = yAlongDepth(maxH - 1 - j, maxH, yUp, yDn);
      out.push({ xPct: xs[c]!, yPct: y });
    }
  }
  return out;
}

/**
 * 横ライン均等: 各ライン人数を対称配分し、ライン内は中央揃え。
 * 手前（客席）ラインから厚くしたい場合は frontHeavy。
 */
export function balancedHorizontalLineSpots(
  n: number,
  numLines: number,
  opts?: {
    stepX?: number;
    xMin?: number;
    xMax?: number;
    yUp?: number;
    yDn?: number;
    /** true なら客席側ラインへ余りを優先 */
    frontHeavy?: boolean;
  }
): PctPoint[] {
  if (n <= 0) return [];
  const lines = Math.min(Math.max(1, numLines), n);
  let counts: number[];
  if (opts?.frontHeavy) {
    // 手前からフル、余りは奥ラインを中央寄せ人数に
    const width = Math.ceil(n / lines);
    counts = [];
    let rem = n;
    for (let i = 0; i < lines; i += 1) {
      const take = Math.min(width, rem);
      counts.push(take);
      rem -= take;
    }
    // 奥の薄いラインが左寄りにならないよう、人数配列は手前→奥のまま
    // 各ライン内で中央揃えする
  } else {
    counts = balancedPartition(n, lines);
  }
  const stepX = opts?.stepX ?? 12;
  const xMin = opts?.xMin ?? 8;
  const xMax = opts?.xMax ?? 92;
  const yUp = opts?.yUp ?? 18;
  const yDn = opts?.yDn ?? 78;
  const out: PctPoint[] = [];
  for (let li = 0; li < lines; li += 1) {
    const cnt = counts[li]!;
    if (cnt <= 0) continue;
    // li=0 を客席側
    const y = yAlongDepth(lines - 1 - li, lines, yUp, yDn);
    const xs = evenSpacing(cnt, 50, stepX, xMin, xMax);
    for (const x of xs) out.push({ xPct: x, yPct: y });
  }
  return out;
}

type PolyPt = { x: number; y: number };

function polylineLength(pts: PolyPt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const dx = pts[i]!.x - pts[i - 1]!.x;
    const dy = pts[i]!.y - pts[i - 1]!.y;
    len += Math.hypot(dx, dy);
  }
  return len;
}

/** 折れ線上に n 点を弧長等間隔で配置（端点含む） */
export function samplePolyline(pts: PolyPt[], n: number): PctPoint[] {
  if (n <= 0) return [];
  if (pts.length === 0) return [];
  if (n === 1) {
    const mid = pts[Math.floor(pts.length / 2)]!;
    return [{ xPct: mid.x, yPct: mid.y }];
  }
  if (pts.length === 1) {
    return Array.from({ length: n }, () => ({
      xPct: pts[0]!.x,
      yPct: pts[0]!.y,
    }));
  }

  const total = polylineLength(pts);
  const out: PctPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const target = (total * i) / (n - 1);
    let acc = 0;
    let placed = false;
    for (let s = 1; s < pts.length; s += 1) {
      const a = pts[s - 1]!;
      const b = pts[s]!;
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + seg >= target - 1e-9 || s === pts.length - 1) {
        const t = seg < 1e-9 ? 0 : (target - acc) / seg;
        const u = clamp(t, 0, 1);
        out.push({
          xPct: a.x + (b.x - a.x) * u,
          yPct: a.y + (b.y - a.y) * u,
        });
        placed = true;
        break;
      }
      acc += seg;
    }
    if (!placed) {
      const last = pts[pts.length - 1]!;
      out.push({ xPct: last.x, yPct: last.y });
    }
  }
  return out;
}

export type LetterShapeId =
  | "W"
  | "W_wide"
  | "W_deep"
  | "M"
  | "M_wide"
  | "M_deep";

/** W/M 字形の基準折れ線（y 大 = 客席） */
function letterPolyline(kind: LetterShapeId): PolyPt[] {
  switch (kind) {
    case "W":
      return [
        { x: 16, y: 72 },
        { x: 30, y: 28 },
        { x: 50, y: 56 },
        { x: 70, y: 28 },
        { x: 84, y: 72 },
      ];
    case "W_wide":
      return [
        { x: 10, y: 74 },
        { x: 28, y: 26 },
        { x: 50, y: 58 },
        { x: 72, y: 26 },
        { x: 90, y: 74 },
      ];
    case "W_deep":
      return [
        { x: 18, y: 78 },
        { x: 32, y: 20 },
        { x: 50, y: 62 },
        { x: 68, y: 20 },
        { x: 82, y: 78 },
      ];
    case "M":
      return [
        { x: 16, y: 28 },
        { x: 30, y: 72 },
        { x: 50, y: 38 },
        { x: 70, y: 72 },
        { x: 84, y: 28 },
      ];
    case "M_wide":
      return [
        { x: 10, y: 26 },
        { x: 28, y: 74 },
        { x: 50, y: 36 },
        { x: 72, y: 74 },
        { x: 90, y: 26 },
      ];
    case "M_deep":
      return [
        { x: 18, y: 22 },
        { x: 32, y: 78 },
        { x: 50, y: 34 },
        { x: 68, y: 78 },
        { x: 82, y: 22 },
      ];
  }
}

export function letterShapeSpots(n: number, kind: LetterShapeId): PctPoint[] {
  return samplePolyline(letterPolyline(kind), n);
}

/**
 * 三重 V: 左右対称の 3 先端。各 V は客席側に開く。
 */
export function tripleVeeSpots(n: number): PctPoint[] {
  if (n <= 0) return [];
  if (n === 1) return [{ xPct: 50, yPct: 50 }];

  const base = Math.floor(n / 3);
  const rem = n % 3;
  // rem=1→中央、rem=2→左右（対称）
  const leftN = base + (rem === 2 ? 1 : 0);
  const midN = base + (rem === 1 ? 1 : 0);
  const rightN = base + (rem === 2 ? 1 : 0);

  const placeV = (cnt: number, tipX: number): PctPoint[] => {
    if (cnt <= 0) return [];
    if (cnt === 1) return [{ xPct: tipX, yPct: 32 }];
    const pts: PctPoint[] = [{ xPct: tipX, yPct: 28 }];
    const wing = cnt - 1;
    const each = Math.floor(wing / 2);
    const spine = wing - each * 2; // 0 or 1（奇数余りは先端縦軸へ）
    for (let i = 0; i < each; i += 1) {
      const u = (i + 1) / (each + 0.5);
      pts.push({ xPct: tipX - u * 16, yPct: 28 + u * 44 });
      pts.push({ xPct: tipX + u * 16, yPct: 28 + u * 44 });
    }
    if (spine > 0) {
      pts.push({ xPct: tipX, yPct: 28 + 36 });
    }
    return pts;
  };

  return [
    ...placeV(leftN, 28),
    ...placeV(midN, 50),
    ...placeV(rightN, 72),
  ];
}
