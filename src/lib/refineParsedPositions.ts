import { linesToParsedPositions } from "./linesToParsedPositions";
import { matchNameToRoster } from "./matchNameToRoster";
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

/** API 応答を名簿名寄せ・列レイアウト補完済みに整える */
export function refineParsedPositions(
  raw: ParsePositionResponse,
  roster: string[]
): ParsePositionResponse {
  let lines = raw.lines ?? [];
  let positions = raw.positions ?? [];

  if (positions.length === 0 && lines.length > 0) {
    positions = linesToParsedPositions(lines);
  }

  if (roster.length > 0) {
    positions = positions.map((p) => {
      const m = matchNameToRoster(p.name, roster);
      return {
        ...p,
        name: m.name,
        confidence:
          m.matched && m.original && m.original !== m.name
            ? "low"
            : p.confidence ?? (m.matched ? "high" : "low"),
        rosterMatched: m.matched,
      };
    });

    lines = lines.map((line) => ({
      ...line,
      names: line.names.map((n) => matchNameToRoster(n, roster).name),
    }));
  }

  const countMismatches =
    raw.countMismatches ?? computeCountMismatches(lines);

  return {
    positions,
    lines: lines.length ? lines : undefined,
    countMismatches: countMismatches.length ? countMismatches : undefined,
  };
}
