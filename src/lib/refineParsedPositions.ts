import {
  alignPositionsByRowCentered,
  linesToParsedPositions,
} from "./linesToParsedPositions";
import {
  importedDancersToParsedPositions,
  reconstructFromParseResponse,
} from "./formationImport";
import { matchNamesToRosterUnique } from "./matchNameToRoster";
import type {
  CountMismatch,
  ParsedLine,
  ParsedPosition,
  ParsePositionResponse,
} from "./parsePositionTypes";

export type RefineParsedPositionsOptions = {
  /** true のとき Formation Reconstruction Engine。未指定は旧経路 */
  useFormationEngine?: boolean;
  placement?: "raw" | "suggested";
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

function snapPositionNames(
  positions: ParsedPosition[],
  roster: string[]
): ParsedPosition[] {
  const snapped = matchNamesToRosterUnique(
    positions.map((p) => p.name),
    roster
  );
  return positions.map((p, idx) => {
    const m = snapped[idx]!;
    return withRosterFlags(p, m.name, m.matched, m.original ?? p.name);
  });
}

function snapLines(lines: ParsedLine[], roster: string[]): ParsedLine[] {
  const validLines = lines.filter(
    (line) => Array.isArray(line.names) && line.names.length > 0
  );
  const flat = validLines.flatMap((line) =>
    line.names.map((n) => String(n).trim()).filter(Boolean)
  );
  const snapped = matchNamesToRosterUnique(flat, roster);
  let i = 0;
  return validLines.map((line) => ({
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
}

function refineWithFormationEngine(
  raw: ParsePositionResponse,
  roster: string[],
  placement: "raw" | "suggested"
): ParsePositionResponse {
  const lines = snapLines(raw.lines ?? [], roster);
  let positions = snapPositionNames(raw.positions ?? [], roster);

  if (positions.length === 0 && lines.length > 0) {
    positions = linesToParsedPositions(lines);
  }

  const reconstructed = reconstructFromParseResponse(
    { ...raw, positions, lines },
    {
      roster,
      rosterCount: roster.length > 0 ? roster.length : undefined,
      imageWidth: 100,
      imageHeight: 100,
      imageFrontDirection: raw.imageFrontDirection ?? "bottom",
      placement,
      rowCounts: lines.map((l) =>
        Number.isFinite(Number(l.count)) && Number(l.count) > 0
          ? Number(l.count)
          : l.names.length
      ),
    }
  );

  const rawPositions = importedDancersToParsedPositions({
    ...reconstructed,
    dancers: reconstructed.dancers.map((d) => ({
      ...d,
      stagePosition: d.rawStagePosition,
    })),
  });
  const suggestedPositions = importedDancersToParsedPositions({
    ...reconstructed,
    dancers: reconstructed.dancers.map((d) => ({
      ...d,
      stagePosition: d.suggestedStagePosition,
    })),
  });

  const engineLines: ParsedLine[] =
    reconstructed.formation.rows.map((row, i) => ({
      rowIndex: i + 1,
      count: row.dancerIds.length,
      names: row.dancerIds.map((id) => {
        const d = reconstructed.dancers.find((x) => x.id === id);
        return d?.recognizedName ?? id;
      }),
    })) ?? [];

  const outLines = engineLines.length ? engineLines : lines;
  const countMismatches =
    raw.countMismatches ?? computeCountMismatches(outLines);

  return {
    positions: placement === "suggested" ? suggestedPositions : rawPositions,
    lines: outLines.length ? outLines : undefined,
    countMismatches: countMismatches.length ? countMismatches : undefined,
    rawPositions,
    suggestedPositions,
    importWarnings: reconstructed.warnings,
    placement,
    imageFrontDirection: reconstructed.orientation.imageFrontDirection,
  };
}

function refineLegacy(
  raw: ParsePositionResponse,
  roster: string[]
): ParsePositionResponse {
  let lines = raw.lines ?? [];
  let positions = raw.positions ?? [];

  if (lines.length > 0) {
    lines = snapLines(lines, roster);
    positions = snapPositionNames(linesToParsedPositions(lines), roster);
  } else {
    positions = snapPositionNames(positions, roster);
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

/**
 * API 応答を名簿名寄せ・列レイアウト補完済みに整える。
 * エンジン OFF のときは従来どおり lines → 均等グリッド。
 */
export function refineParsedPositions(
  raw: ParsePositionResponse,
  roster: string[],
  opts: RefineParsedPositionsOptions = {}
): ParsePositionResponse {
  if (opts.useFormationEngine && (raw.positions?.length || raw.lines?.length)) {
    return refineWithFormationEngine(
      raw,
      roster,
      opts.placement ?? "suggested"
    );
  }
  return refineLegacy(raw, roster);
}
