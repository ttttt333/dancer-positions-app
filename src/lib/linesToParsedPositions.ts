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

export function formationRowsAreRagged(rowLengths: number[]): boolean {
  const uniq = new Set(rowLengths.filter((n) => n > 0));
  return uniq.size > 1;
}

function colsForRow(rowLen: number, maxCols: number, ragged: boolean): number {
  return ragged ? Math.max(rowLen, 1) : maxCols;
}

/** 手書きメモの「列」からステージ座標（%）へ変換。行人数が違うときは行ごとに中央揃え。 */
export function linesToParsedPositions(lines: ParsedLine[]): ParsedPosition[] {
  const valid = lines.filter(
    (line) => Array.isArray(line.names) && line.names.length > 0
  );
  if (valid.length === 0) return [];

  const rowCount = valid.length;
  const lengths = valid.map((line) => line.names.length);
  const maxCols = Math.max(...lengths, 1);
  const ragged = formationRowsAreRagged(lengths);
  const out: ParsedPosition[] = [];

  valid.forEach((line, rowIdx) => {
    const names = line.names.map((n) => String(n).trim()).filter(Boolean);
    const y = yForRow(rowIdx, rowCount);
    const cols = colsForRow(names.length, maxCols, ragged);

    names.forEach((name, colIdx) => {
      out.push({
        name,
        x: xForColumnCentered(colIdx, cols),
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
  const lengths = valid.map((l) => l.names.length);
  const maxCols = Math.max(...lengths, 1);
  const ragged = formationRowsAreRagged(lengths);
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
    const cols = colsForRow(names.length, maxCols, ragged);

    const ordered =
      rowPositions.length === names.length
        ? rowPositions
        : [...rowPositions].sort((a, b) => a.x - b.x);

    ordered.forEach((p, colIdx) => {
      used.add(p);
      realigned.push({
        ...p,
        x: xForColumnCentered(colIdx, cols),
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

/**
 * Y の隙間で行を切る。固定 % だと手書きの 3-4-3-1 が 1-3-5-2 に潰れる。
 */
export function clusterPositionsByRow(
  positions: ParsedPosition[]
): ParsedPosition[][] {
  const sorted = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);
  if (sorted.length === 0) return [];
  if (sorted.length === 1) return [sorted];

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    gaps.push(sorted[i]!.y - sorted[i - 1]!.y);
  }

  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const median = sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 0;
  const threshold = Math.max(4.5, median * 2.2);

  const rows: ParsedPosition[][] = [[sorted[0]!]];
  for (let i = 1; i < sorted.length; i += 1) {
    if (gaps[i - 1]! > threshold) {
      rows.push([sorted[i]!]);
    } else {
      rows[rows.length - 1]!.push(sorted[i]!);
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
  const lengths = rows.map((r) => r.length);
  const maxCols = Math.max(...lengths, 1);
  const ragged = formationRowsAreRagged(lengths);
  const rowCount = rows.length;
  const out: ParsedPosition[] = [];

  rows.forEach((row, rowIdx) => {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    const y = yForRow(rowIdx, rowCount);
    const cols = colsForRow(sorted.length, maxCols, ragged);
    sorted.forEach((p, colIdx) => {
      out.push({
        ...p,
        x: xForColumnCentered(colIdx, cols),
        y,
        lineIndex: rowIdx,
      });
    });
  });

  return out;
}
