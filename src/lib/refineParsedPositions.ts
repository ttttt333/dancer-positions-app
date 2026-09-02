import {
  alignPositionsByRowCentered,
  linesToParsedPositions,
} from "./linesToParsedPositions";
import { matchNamesToRosterUnique } from "./matchNameToRoster";
import type {
  CountMismatch,
  ParsedLine,
  ParsedPosition,
  ParsePositionResponse,
} from "./parsePositionTypes";

export function computeCountMismatches(lines: ParsedLine[]): CountMismatch[] {
  const mismatches: CountMismatch[] = [];
  lines.forEach((line, lineIndex) => {
    const expected = Number(line.count);
    const actual = line.names?.length ?? 0;
    if (!Number.isFinite(expected) || expected <= 0) return;
    if (actual !== expected) {
      mismatches.push({ lineIndex, expected, actual });
    }
  });
  return mismatches;
}

function withRosterFlags(
  p: ParsedPosition,
  name: string,
  matched: boolean,
  originalName: string
): ParsedPosition {
  return {
    ...p,
    name,
    confidence:
      matched && originalName.trim() !== name
        ? "low"
        : p.confidence ?? (matched ? "high" : "low"),
    rosterMatched: matched,
  };
}

/**
 * API 応答を名簿名寄せ・列レイアウト補完済みに整える。
 * 手書きの lines があるときは座標より行構造を優先する（3-4-3-1 などが潰れない）。
 */
export function refineParsedPositions(
  raw: ParsePositionResponse,
  roster: string[]
): ParsePositionResponse {
  let lines = raw.lines ?? [];
  let positions = raw.positions ?? [];

  if (lines.length > 0) {
    const validLines = lines.filter(
      (line) => Array.isArray(line.names) && line.names.length > 0
    );
    const flat = validLines.flatMap((line) =>
      line.names.map((n) => String(n).trim()).filter(Boolean)
    );
    const snapped = matchNamesToRosterUnique(flat, roster);
    let i = 0;
    lines = validLines.map((line) => ({
      ...line,
      names: line.names
        .map((n) => String(n).trim())
        .filter(Boolean)
        .map(() => {
          const m = snapped[i]!;
          i += 1;
          return m.name;
        }),
    }));
    positions = linesToParsedPositions(lines).map((p, idx) => {
      const m = snapped[idx]!;
      return withRosterFlags(p, m.name, m.matched, m.original ?? p.name);
    });
  } else {
    const snapped = matchNamesToRosterUnique(
      positions.map((p) => p.name),
      roster
    );
    positions = positions.map((p, idx) => {
      const m = snapped[idx]!;
      return withRosterFlags(p, m.name, m.matched, m.original ?? p.name);
    });
    if (positions.length > 1) {
      positions = alignPositionsByRowCentered(positions);
    }
  }

  const countMismatches =
    raw.countMismatches ?? computeCountMismatches(lines);

  return {
    positions,
    lines: lines.length ? lines : undefined,
    countMismatches: countMismatches.length ? countMismatches : undefined,
  };
}
