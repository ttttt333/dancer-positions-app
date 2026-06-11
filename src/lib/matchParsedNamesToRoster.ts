import type { ParsedLine, ParsedPosition } from "./parsePositionTypes";

/** 編集距離（Levenshtein） */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

export function matchNameToRoster(
  name: string,
  roster: string[]
): { name: string; rosterMatched: boolean; confidence: "high" | "low" } {
  const normalized = name.trim();
  if (!normalized || roster.length === 0) {
    return { name: normalized || "Unknown", rosterMatched: false, confidence: "low" };
  }
  if (roster.includes(normalized)) {
    return { name: normalized, rosterMatched: true, confidence: "high" };
  }
  let best: string | null = null;
  let bestDist = Infinity;
  for (const candidate of roster) {
    const dist = levenshteinDistance(normalized, candidate);
    const threshold = Math.max(1, Math.floor(candidate.length / 3));
    if (dist < bestDist && dist <= threshold) {
      bestDist = dist;
      best = candidate;
    }
  }
  if (best) {
    return { name: best, rosterMatched: true, confidence: "low" };
  }
  return { name: normalized, rosterMatched: false, confidence: "low" };
}

/** クライアント側の二重チェック用（API 後） */
export function refinePositionsWithRoster(
  positions: ParsedPosition[],
  roster: string[]
): ParsedPosition[] {
  if (!roster.length) return positions;
  return positions.map((p) => {
    const matched = matchNameToRoster(p.name, roster);
    return {
      ...p,
      name: matched.name,
      confidence:
        matched.confidence === "high" && p.confidence === "high"
          ? "high"
          : matched.rosterMatched
            ? "low"
            : p.confidence ?? "low",
    };
  });
}

export function hasLineCountMismatch(lines: ParsedLine[] | undefined): boolean {
  if (!lines?.length) return false;
  return lines.some((l) => l.names.length !== l.count);
}
