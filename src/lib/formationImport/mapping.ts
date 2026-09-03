import { normalizeInBox, type BoundingBox, type Point } from "./geometry";

/** ステージ % の余白。画像アスペクトは使わない */
const STAGE_MIN = 12;
const STAGE_SPAN = 76;

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
 * 行の Y だけ揃える。X は行内の相対位置を保つ（均等グリッドにしない）。
 */
export function suggestedStageFromRows(
  items: { id: string; marker: Point; row: number }[],
  box: BoundingBox,
  rowCount: number
): Map<string, Point> {
  const byRow = new Map<number, { id: string; marker: Point }[]>();
  for (const it of items) {
    const arr = byRow.get(it.row) ?? [];
    arr.push(it);
    byRow.set(it.row, arr);
  }

  const out = new Map<string, Point>();
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const vForRow = (row: number) =>
    rowCount <= 1 ? 0.5 : row / (rowCount - 1);

  for (const row of rows) {
    const members = (byRow.get(row) ?? []).sort(
      (a, b) => a.marker.x - b.marker.x
    );
    const v = vForRow(row);
    const xs = members.map((m) => normalizeInBox(m.marker, box).x);
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
