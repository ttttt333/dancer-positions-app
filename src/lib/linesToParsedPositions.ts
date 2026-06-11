import type { ParsedLine, ParsedPosition } from "./parsePositionTypes";

/** 手書きメモの「列」からステージ座標（%）へ変換。上の行ほど手前（y が小さい）。 */
export function linesToParsedPositions(lines: ParsedLine[]): ParsedPosition[] {
  const valid = lines.filter(
    (line) => Array.isArray(line.names) && line.names.length > 0
  );
  if (valid.length === 0) return [];

  const rowCount = valid.length;
  const out: ParsedPosition[] = [];

  valid.forEach((line, rowIdx) => {
    const names = line.names.map((n) => String(n).trim()).filter(Boolean);
    const count = names.length;
    const y =
      rowCount <= 1
        ? 50
        : Math.round((10 + (rowIdx / (rowCount - 1)) * 75) * 100) / 100;

    names.forEach((name, colIdx) => {
      const x =
        count <= 1
          ? 50
          : Math.round((8 + ((colIdx + 0.5) / count) * 84) * 100) / 100;
      out.push({
        name,
        x,
        y,
        confidence: "low",
        lineIndex: rowIdx,
      });
    });
  });

  return out;
}
