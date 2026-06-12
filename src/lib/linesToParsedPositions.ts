import type { ParsedLine, ParsedPosition } from "./parsePositionTypes";

const COL_UNIT_PCT = 10;
const MAX_SPAN_PCT = 84;

export function yForRow(rowIdx: number, rowCount: number): number {
  if (rowCount <= 1) return 50;
  return Math.round((10 + (rowIdx / (rowCount - 1)) * 75) * 100) / 100;
}

/** 列インデックスの X%。ブロック全体をステージ中央（50%）に揃える */
export function xForColumnCentered(colIdx: number, maxCols: number): number {
  if (maxCols <= 1) return 50;
  const span = Math.min(MAX_SPAN_PCT, maxCols * COL_UNIT_PCT);
  const left = 50 - span / 2;
  const step = span / maxCols;
  return Math.round((left + (colIdx + 0.5) * step) * 100) / 100;
}

/** 手書きメモの「列」からステージ座標（%）へ変換。列番号は行をまたいで縦揃え。 */
export function linesToParsedPositions(lines: ParsedLine[]): ParsedPosition[] {
  const valid = lines.filter(
    (line) => Array.isArray(line.names) && line.names.length > 0
  );
  if (valid.length === 0) return [];

  const rowCount = valid.length;
  const maxCols = Math.max(...valid.map((line) => line.names.length), 1);
  const out: ParsedPosition[] = [];

  valid.forEach((line, rowIdx) => {
    const names = line.names.map((n) => String(n).trim()).filter(Boolean);
    const y = yForRow(rowIdx, rowCount);

    names.forEach((name, colIdx) => {
      out.push({
        name,
        x: xForColumnCentered(colIdx, maxCols),
        y,
        confidence: "low",
        lineIndex: rowIdx,
      });
    });
  });

  return out;
}

/** 既存座標を中央基準の列グリッドに再配置 */
export function alignPositionsToLineColumnGrid(
  positions: ParsedPosition[],
  lines: ParsedLine[]
): ParsedPosition[] {
  const valid = lines.filter((l) => l.names?.length > 0);
  if (!valid.length || !positions.length) return positions;

  const rowCount = valid.length;
  const maxCols = Math.max(...valid.map((l) => l.names.length), 1);
  const byLine = new Map<number, ParsedPosition[]>();

  for (const p of positions) {
    const li = p.lineIndex;
    if (li === undefined || li < 0 || li >= valid.length) continue;
    const arr = byLine.get(li) ?? [];
    arr.push(p);
    byLine.set(li, arr);
  }

  if (byLine.size === 0) return positions;

  const realigned: ParsedPosition[] = [];
  const used = new Set<ParsedPosition>();

  valid.forEach((line, rowIdx) => {
    const rowPositions = byLine.get(rowIdx) ?? [];
    const y = yForRow(rowIdx, rowCount);
    const names = line.names.map((n) => String(n).trim()).filter(Boolean);

    const ordered =
      rowPositions.length === names.length
        ? rowPositions
        : [...rowPositions].sort((a, b) => a.x - b.x);

    ordered.forEach((p, colIdx) => {
      used.add(p);
      realigned.push({
        ...p,
        x: xForColumnCentered(colIdx, maxCols),
        y,
        lineIndex: rowIdx,
      });
    });
  });

  for (const p of positions) {
    if (!used.has(p)) realigned.push(p);
  }

  return realigned;
}

function clusterPositionsByRow(
  positions: ParsedPosition[],
  tolerance = 6
): ParsedPosition[][] {
  const sorted = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: ParsedPosition[][] = [];
  for (const p of sorted) {
    const last = rows[rows.length - 1];
    if (!last?.length || Math.abs(p.y - last[0]!.y) > tolerance) {
      rows.push([p]);
    } else {
      last.push(p);
    }
  }
  return rows;
}

/** デジタル図など lines なしの座標を行ごとに中央基準グリッドへ整列 */
export function alignPositionsByRowCentered(
  positions: ParsedPosition[]
): ParsedPosition[] {
  if (positions.length <= 1) return positions;

  const rows = clusterPositionsByRow(positions);
  const maxCols = Math.max(...rows.map((r) => r.length), 1);
  const rowCount = rows.length;
  const out: ParsedPosition[] = [];

  rows.forEach((row, rowIdx) => {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    const y = yForRow(rowIdx, rowCount);
    sorted.forEach((p, colIdx) => {
      out.push({
        ...p,
        x: xForColumnCentered(colIdx, maxCols),
        y,
      });
    });
  });

  return out;
}
