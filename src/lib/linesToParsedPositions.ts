import type { ParsedLine, ParsedPosition } from "./parsePositionTypes";

function yForRow(rowIdx: number, rowCount: number): number {
  if (rowCount <= 1) return 50;
  return Math.round((10 + (rowIdx / (rowCount - 1)) * 75) * 100) / 100;
}

/** 列インデックス（0始まり）に対する X%。全行で同じ列が縦に揃う */
function xForColumn(colIdx: number, maxCols: number): number {
  if (maxCols <= 1) return 50;
  return Math.round((8 + ((colIdx + 0.5) / maxCols) * 84) * 100) / 100;
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
        x: xForColumn(colIdx, maxCols),
        y,
        confidence: "low",
        lineIndex: rowIdx,
      });
    });
  });

  return out;
}

/** 既存座標を列グリッドに再配置（1列目・3列目などが行間で縦揃え） */
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
        x: xForColumn(colIdx, maxCols),
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
