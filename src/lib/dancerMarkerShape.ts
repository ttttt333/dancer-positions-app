export type DancerMarkerShape =
  | "circle"
  | "square"
  | "diamond"
  | "star"
  | "triangle"
  | "arrow";

export const DANCER_MARKER_SHAPES: readonly {
  id: DancerMarkerShape;
  label: string;
}[] = [
  { id: "circle", label: "丸" },
  { id: "square", label: "四角" },
  { id: "diamond", label: "ダイヤ" },
  { id: "star", label: "星" },
  { id: "triangle", label: "三角" },
  { id: "arrow", label: "矢印" },
];

export function normalizeDancerMarkerShape(
  raw: unknown
): Exclude<DancerMarkerShape, "circle"> | undefined {
  if (raw === "circle") return undefined;
  return DANCER_MARKER_SHAPES.some((s) => s.id === raw)
    ? (raw as Exclude<DancerMarkerShape, "circle">)
    : undefined;
}

function starPoints(): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 49 : 21;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(53 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/**
 * viewBox 0 0 100 100 の SVG 図形。丸は null（CSS の円で描く）。
 * 三角・矢印は +y（ステージ座標の客席側）を指す。
 */
export const DANCER_MARKER_SHAPE_POINTS: Record<
  Exclude<DancerMarkerShape, "circle">,
  string
> = {
  square: "8,8 92,8 92,92 8,92",
  diamond: "50,2 98,50 50,98 2,50",
  star: starPoints(),
  triangle: "4,8 96,8 50,96",
  arrow: "10,4 90,4 90,58 50,97 10,58",
};

const SHAPE_POINT_CACHE = new Map<string, [number, number][]>();

function shapePoints(shape: Exclude<DancerMarkerShape, "circle">): [number, number][] {
  let pts = SHAPE_POINT_CACHE.get(shape);
  if (!pts) {
    pts = DANCER_MARKER_SHAPE_POINTS[shape].split(" ").map((p) => {
      const [x, y] = p.split(",").map(Number);
      return [x!, y!] as [number, number];
    });
    SHAPE_POINT_CACHE.set(shape, pts);
  }
  return pts;
}

/** Canvas に図形のパスを引く（beginPath 済みの ctx に追加）。sizePx は外接の一辺 */
export function traceDancerMarkerShapePath(
  ctx: {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    closePath(): void;
  },
  shape: Exclude<DancerMarkerShape, "circle">,
  cx: number,
  cy: number,
  sizePx: number,
  rotationRad = 0
): void {
  const k = sizePx / 100;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  shapePoints(shape).forEach(([px, py], i) => {
    const dx = (px - 50) * k;
    const dy = (py - 50) * k;
    const x = cx + dx * cos - dy * sin;
    const y = cy + dx * sin + dy * cos;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/** 図形内に収めるための文字の縮小率 */
export function dancerMarkerShapeLabelScale(
  shape: DancerMarkerShape | undefined
): number {
  if (shape === "star") return 0.62;
  if (shape === "triangle") return 0.68;
  if (shape === "diamond") return 0.82;
  if (shape === "arrow") return 0.9;
  return 1;
}

/** 図形内で文字を置く中心（viewBox の y、%）。三角・矢印は太い側へ寄せる */
export function dancerMarkerShapeLabelCenterYPct(
  shape: DancerMarkerShape | undefined
): number {
  if (shape === "triangle") return 36;
  if (shape === "arrow") return 42;
  if (shape === "star") return 55;
  return 50;
}
