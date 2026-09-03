import { normalizeInBox, type BoundingBox, type Point } from "./geometry";

/** ステージ % の余白。画像アスペクトは使わない */
const STAGE_MIN = 12;
const STAGE_SPAN = 76;
/** いちばん人数の多い行が占める正規化幅。行ごとの step を揃えて互い違いにする */
const NORM_SPAN = 0.72;

export function mapNormalizedToStage(u: number, v: number): Point {
  return {
    x: round2(STAGE_MIN + clamp01(u) * STAGE_SPAN),
    y: round2(STAGE_MIN + clamp01(v) * STAGE_SPAN),
  };
}

export function rawStageFromImage(p: Point, box: BoundingBox): Point {
  const n = normalizeInBox(p, box);
  return mapNormalizedToStage(n.x, n.y);
}

/**
 * 同じ歩幅で各行を中央揃えする。
 * 3人 (-d, 0, +d) の次の 4人は (-1.5d, -0.5d, +0.5d, +1.5d) になり、隙間に入る。
 */
export function staggeredXsForRow(count: number, step: number, center = 0.5): number[] {
  if (count <= 0) return [];
  if (count === 1) return [center];
  const start = center - ((count - 1) / 2) * step;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

export function stepForMaxRowCount(maxCount: number): number {
  const gaps = Math.max(maxCount - 1, 1);
  return NORM_SPAN / gaps;
}

/**
 * 行の Y を揃え、X は列人数に応じて互い違い（同じ縦線に積まない）。
 */
export function suggestedStageFromRows(
  items: { id: string; marker: Point; row: number }[],
  _box: BoundingBox,
  rowCount: number
): Map<string, Point> {
  const byRow = new Map<number, { id: string; marker: Point }[]>();
  for (const it of items) {
    const arr = byRow.get(it.row) ?? [];
    arr.push(it);
    byRow.set(it.row, arr);
  }

  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const maxCount = Math.max(
    ...rows.map((row) => (byRow.get(row) ?? []).length),
    1
  );
  const step = stepForMaxRowCount(maxCount);
  const vForRow = (row: number) =>
    rowCount <= 1 ? 0.5 : row / (rowCount - 1);

  const out = new Map<string, Point>();
  for (const row of rows) {
    const members = (byRow.get(row) ?? []).sort(
      (a, b) => a.marker.x - b.marker.x
    );
    const v = vForRow(row);
    const xs = staggeredXsForRow(members.length, step);
    members.forEach((m, i) => {
      out.set(m.id, mapNormalizedToStage(xs[i] ?? 0.5, v));
    });
  }
  return out;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
