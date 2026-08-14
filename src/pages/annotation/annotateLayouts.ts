export type AnnotateSpot = {
  id: string;
  xPct: number;
  yPct: number;
};

export const ANNOTATE_PRESETS = [
  { id: "LINE", label: "横一列" },
  { id: "DOUBLE_LINE", label: "2列" },
  { id: "V", label: "V字" },
  { id: "WIDE_V", label: "広いV" },
  { id: "CENTER", label: "中央寄り" },
  { id: "ARC", label: "弧" },
  { id: "CLUSTER", label: "固まり" },
  { id: "SPLIT", label: "左右に分ける" },
  { id: "PYRAMID", label: "ピラミッド" },
  { id: "GRID", label: "グリッド" },
  { id: "TRIANGLE", label: "三角" },
  { id: "DIAMOND", label: "ダイヤ" },
  { id: "CENTER_WINGS", label: "中央＋両翼" },
  { id: "ARROW", label: "矢印" },
  { id: "DIAGONAL", label: "斜め" },
] as const;

export const DEFAULT_DANCER_COUNT = 8;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function spots(points: Array<{ xPct: number; yPct: number }>): AnnotateSpot[] {
  return points.map((p, i) => ({
    id: `d${i + 1}`,
    xPct: clamp(p.xPct, 6, 94),
    yPct: clamp(p.yPct, 10, 88),
  }));
}

function linspace(count: number, start: number, end: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, i) => start + ((end - start) * i) / (count - 1));
}

/** y=0 upstage, y=100 audience (bottom). */
export function layoutPreset(type: string, count: number): AnnotateSpot[] {
  const n = clamp(Math.round(count), 1, 16);
  const xs = linspace(n, 14, 86);

  if (type === "LINE") {
    return spots(xs.map((x) => ({ xPct: x, yPct: 62 })));
  }
  if (type === "DOUBLE_LINE") {
    const front = Math.ceil(n / 2);
    const back = n - front;
    const frontXs = linspace(front, 16, 84);
    const backXs = linspace(back, 20, 80);
    return spots([
      ...backXs.map((x) => ({ xPct: x, yPct: 38 })),
      ...frontXs.map((x) => ({ xPct: x, yPct: 68 })),
    ]);
  }
  if (type === "V" || type === "WIDE_V" || type === "ARROW") {
    const wide = type === "WIDE_V" ? 38 : type === "ARROW" ? 22 : 28;
    const mid = (n - 1) / 2;
    return spots(
      Array.from({ length: n }, (_, i) => {
        const t = mid === 0 ? 0 : (i - mid) / mid;
        return { xPct: 50 + t * wide, yPct: 72 - Math.abs(t) * 28 };
      })
    );
  }
  if (type === "CENTER") {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const pts: Array<{ xPct: number; yPct: number }> = [];
    let left = n;
    for (let r = 0; r < rows; r += 1) {
      const inRow = Math.min(cols, left);
      left -= inRow;
      const rowXs = linspace(inRow, 38, 62);
      const y = 40 + (r / Math.max(1, rows - 1)) * 28;
      for (const x of rowXs) pts.push({ xPct: x, yPct: Number.isFinite(y) ? y : 54 });
    }
    return spots(pts);
  }
  if (type === "ARC") {
    return spots(
      xs.map((x, i) => {
        const t = n === 1 ? 0 : i / (n - 1);
        return { xPct: x, yPct: 48 + Math.sin(t * Math.PI) * 22 };
      })
    );
  }
  if (type === "CLUSTER") {
    return spots(
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const rad = 8 + (i % 3) * 4;
        return { xPct: 50 + Math.cos(a) * rad * 1.4, yPct: 52 + Math.sin(a) * rad };
      })
    );
  }
  if (type === "SPLIT") {
    const leftN = Math.ceil(n / 2);
    const rightN = n - leftN;
    const leftXs = linspace(leftN, 12, 34);
    const rightXs = linspace(rightN, 66, 88);
    return spots([
      ...leftXs.map((x, i) => ({ xPct: x, yPct: 42 + (i % 3) * 12 })),
      ...rightXs.map((x, i) => ({ xPct: x, yPct: 42 + (i % 3) * 12 })),
    ]);
  }
  if (type === "PYRAMID" || type === "TRIANGLE") {
    const rows: number[] = [];
    let remain = n;
    let row = 1;
    while (remain > 0) {
      const take = Math.min(row, remain);
      rows.push(take);
      remain -= take;
      row += 1;
    }
    const pts: Array<{ xPct: number; yPct: number }> = [];
    rows.forEach((countInRow, r) => {
      const y = 28 + (r / Math.max(1, rows.length - 1)) * 44;
      const span = 18 + r * 12;
      linspace(countInRow, 50 - span, 50 + span).forEach((x) => pts.push({ xPct: x, yPct: y }));
    });
    return spots(pts);
  }
  if (type === "GRID") {
    const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    const pts: Array<{ xPct: number; yPct: number }> = [];
    let left = n;
    for (let r = 0; r < rows; r += 1) {
      const inRow = Math.min(cols, left);
      left -= inRow;
      const y = linspace(rows, 32, 72)[r] ?? 52;
      linspace(inRow, 22, 78).forEach((x) => pts.push({ xPct: x, yPct: y }));
    }
    return spots(pts);
  }
  if (type === "DIAMOND") {
    const ring = [
      { xPct: 50, yPct: 28 },
      { xPct: 28, yPct: 52 },
      { xPct: 72, yPct: 52 },
      { xPct: 50, yPct: 76 },
    ];
    if (n <= 4) return spots(ring.slice(0, n));
    const extra = linspace(n - 4, 36, 64).map((x, i) => ({ xPct: x, yPct: 48 + ((i % 2) * 10 - 5) }));
    return spots([...ring, ...extra]);
  }
  if (type === "CENTER_WINGS") {
    const centerN = Math.min(3, Math.max(1, Math.round(n / 3)));
    const wing = n - centerN;
    const leftN = Math.ceil(wing / 2);
    const rightN = wing - leftN;
    return spots([
      ...linspace(centerN, 44, 56).map((x, i) => ({ xPct: x, yPct: 46 + i * 8 })),
      ...linspace(leftN, 12, 28).map((x, i) => ({ xPct: x, yPct: 40 + (i % 3) * 12 })),
      ...linspace(rightN, 72, 88).map((x, i) => ({ xPct: x, yPct: 40 + (i % 3) * 12 })),
    ]);
  }
  if (type === "DIAGONAL") {
    return spots(xs.map((x, i) => ({ xPct: x, yPct: 28 + (i / Math.max(1, n - 1)) * 48 })));
  }
  return layoutPreset("LINE", n);
}

export function resizeLayout(positions: AnnotateSpot[], count: number): AnnotateSpot[] {
  const n = clamp(Math.round(count), 1, 16);
  if (positions.length === n) return positions;
  if (positions.length > n) return positions.slice(0, n).map((p, i) => ({ ...p, id: `d${i + 1}` }));
  const extra = layoutPreset("LINE", n).slice(positions.length);
  return [...positions, ...extra].map((p, i) => ({ ...p, id: `d${i + 1}` }));
}
