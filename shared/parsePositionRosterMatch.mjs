/** @param {string} a @param {string} b */
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
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

/**
 * @param {string} name
 * @param {string[]} roster
 */
export function matchNameToRoster(name, roster) {
  const normalized = String(name ?? "").trim();
  if (!normalized || roster.length === 0) {
    return { name: normalized || "Unknown", rosterMatched: false, confidence: "low" };
  }

  if (roster.includes(normalized)) {
    return { name: normalized, rosterMatched: true, confidence: "high" };
  }

  let best = null;
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

/**
 * 手書きメモの行構造 → ステージ座標（上=奥・下=手前）
 * @param {{ count: number; names: string[] }[]} lines
 */
export function linesToStagePositions(lines) {
  const positions = [];
  const rowCount = lines.length;
  if (rowCount === 0) return positions;

  for (let rowIdx = 0; rowIdx < lines.length; rowIdx++) {
    const line = lines[rowIdx];
    const names = line.names ?? [];
    if (names.length === 0) continue;

    const y =
      rowCount === 1
        ? 50
        : Math.round((12 + (rowIdx / (rowCount - 1)) * 76) * 100) / 100;

    for (let colIdx = 0; colIdx < names.length; colIdx++) {
      const x =
        names.length === 1
          ? 50
          : Math.round((8 + (colIdx / (names.length - 1)) * 84) * 100) / 100;
      positions.push({
        name: names[colIdx],
        x,
        y,
        confidence: "low",
      });
    }
  }

  return positions;
}

/**
 * @param {unknown} rawLines
 */
export function normalizeParsedLines(rawLines) {
  if (!Array.isArray(rawLines)) return [];
  const out = [];
  for (const line of rawLines) {
    if (!line || typeof line !== "object") continue;
    const countRaw = Number(line.count);
    const names = Array.isArray(line.names)
      ? line.names
          .map((n) => (typeof n === "string" || typeof n === "number" ? String(n).trim() : ""))
          .filter(Boolean)
      : [];
    const count =
      Number.isFinite(countRaw) && countRaw > 0
        ? Math.round(countRaw)
        : names.length;
    if (names.length === 0 && count <= 0) continue;
    out.push({ count, names });
  }
  return out;
}

/**
 * @param {{ name: string; x: number; y: number; confidence?: string }[]} positions
 * @param {string[]} roster
 */
export function matchPositionsToRoster(positions, roster) {
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
