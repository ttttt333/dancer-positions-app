import type { ParsePositionResponse, ParsedPosition } from "./parsePositionTypes";

function positionScore(p: ParsedPosition): number {
  let score = 0;
  if (p.confidence === "high") score += 4;
  if (p.rosterMatched) score += 2;
  if (p.lineIndex === undefined) score += 3;
  return score;
}

/** 複数画像の解析結果を 1 つのキュー用データに統合 */
export function mergeParseResults(
  results: ParsePositionResponse[]
): ParsePositionResponse {
  const byName = new Map<string, ParsedPosition>();
  const lines: NonNullable<ParsePositionResponse["lines"]> = [];
  const countMismatches: NonNullable<ParsePositionResponse["countMismatches"]> =
    [];

  for (const result of results) {
    for (const p of result.positions) {
      const key = p.name.trim();
      if (!key) continue;
      const existing = byName.get(key);
      if (!existing || positionScore(p) > positionScore(existing)) {
        byName.set(key, p);
      }
    }
    if (result.lines?.length) lines.push(...result.lines);
    if (result.countMismatches?.length) {
      countMismatches.push(...result.countMismatches);
    }
  }

  return {
    positions: Array.from(byName.values()),
    lines: lines.length ? lines : undefined,
    countMismatches: countMismatches.length ? countMismatches : undefined,
  };
}
