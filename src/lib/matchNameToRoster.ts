/** カタカナ → ひらがな（比較用の簡易正規化） */
export function normalizeNameForMatch(s: string): string {
  return s
    .trim()
    .replace(/[\u30a1-\u30f6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    )
    .replace(/\s+/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export type RosterMatchResult = {
  name: string;
  matched: boolean;
  /** 名簿と一致した場合の元の読み取り名 */
  original?: string;
};

/**
 * 読み取り名を名簿のいずれかに名寄せ（編集距離）。
 * 名簿が空のときは入力をそのまま返す。
 */
export function matchNameToRoster(
  rawName: string,
  roster: string[]
): RosterMatchResult {
  const original = rawName.trim();
  if (!original || roster.length === 0) {
    return { name: original || rawName, matched: false };
  }

  const normIn = normalizeNameForMatch(original);
  for (const candidate of roster) {
    if (normalizeNameForMatch(candidate) === normIn) {
      return { name: candidate, matched: true, original };
    }
  }

  let best = roster[0];
  let bestDist = Infinity;
  for (const candidate of roster) {
    const d = levenshtein(normIn, normalizeNameForMatch(candidate));
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }

  const threshold = normIn.length <= 3 ? 2 : Math.max(2, Math.ceil(normIn.length * 0.45));
  if (bestDist <= threshold) {
    return { name: best, matched: true, original };
  }

  return { name: original, matched: false, original };
}
