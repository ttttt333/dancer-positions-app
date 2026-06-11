import { linesToParsedPositions, alignPositionsToLineColumnGrid } from "./linesToParsedPositions";
import { matchNameToRoster } from "./matchNameToRoster";
import type {
  CountMismatch,
  ParsedLine,
  ParsedPosition,
  ParsePositionResponse,
} from "./parsePositionTypes";

export type RefineParsedOptions = {
  /** ヒント表記（苗字のみ等）→ キュー用フルネーム */
  hintToFullName?: Map<string, string>;
};

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
  roster: string[],
  opts: RefineParsedOptions = {}
): ParsePositionResponse {
  let lines = raw.lines ?? [];
  let positions = raw.positions ?? [];
  const hadDiagramPositions = positions.length > 0;

  if (positions.length === 0 && lines.length > 0) {
    positions = linesToParsedPositions(lines);
  }

  const hintToFullName = opts.hintToFullName;

  if (roster.length > 0) {
    positions = positions.map((p) => {
      const m = matchNameToRoster(p.name, roster);
      const resolved =
        m.matched && hintToFullName?.size
          ? hintToFullName.get(m.name) ?? m.name
          : m.name;
      return {
        ...p,
        name: resolved,
        confidence:
          m.matched && m.original && m.original !== resolved
            ? "low"
            : p.confidence ?? (m.matched ? "high" : "low"),
        rosterMatched: m.matched,
      };
    });

    lines = lines.map((line) => ({
      ...line,
      names: line.names.map((n) => {
        const m = matchNameToRoster(n, roster);
        if (m.matched && hintToFullName?.size) {
          return hintToFullName.get(m.name) ?? m.name;
        }
        return m.name;
      }),
    }));
  }

  if (lines.length > 0 && (!hadDiagramPositions || positions.every((p) => p.lineIndex !== undefined))) {
    positions = alignPositionsToLineColumnGrid(positions, lines);
  }

  const countMismatches =
    raw.countMismatches ?? computeCountMismatches(lines);

  return {
    positions,
    lines: lines.length ? lines : undefined,
    countMismatches: countMismatches.length ? countMismatches : undefined,
  };
}
