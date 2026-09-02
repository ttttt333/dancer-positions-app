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

/** 画像の表記を優先しつつ、名簿ヒントで同定した表示名を決める */
export function pickDisplayNameFromMatch(
  original: string,
  matchedHint: string
): string {
  const raw = original.trim();
  const hint = matchedHint.trim();
  if (!raw) return hint;
  if (!hint) return raw;

  const normO = normalizeNameForMatch(raw);
  const normH = normalizeNameForMatch(hint);
  if (normO === normH) return raw;
  if (normO.startsWith(normH) || normH.startsWith(normO)) return raw;
  return hint;
}

function uniqueRosterLabels(roster: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of roster) {
    const norm = normalizeNameForMatch(candidate);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(candidate);
  }
  return out;
}

function editDistanceThreshold(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return 1;
  return Math.max(1, Math.ceil(maxLen * 0.25));
}

function allowFuzzyDistance(a: string, b: string, d: number): boolean {
  if (d <= 0) return false;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) {
    if (d !== 1) return false;
    return a.length >= 2 && b.length >= 2 && a.slice(0, 2) === b.slice(0, 2);
  }
  return d <= editDistanceThreshold(a, b);
}

/**
 * 小さいほど近い。一致なしは null。
 * 3 文字前後のひらがな同士を編集距離 2 で結び付けない（かえで ≠ かんな）。
 */
export function scoreNameToRosterCandidate(
  rawName: string,
  candidate: string
): number | null {
  const normIn = normalizeNameForMatch(rawName);
  const normC = normalizeNameForMatch(candidate);
  if (!normIn || !normC) return null;
  if (normIn === normC) return 0;

  const shorter = normIn.length <= normC.length ? normIn : normC;
  const longer = normIn.length <= normC.length ? normC : normIn;
  if (shorter.length >= 2 && longer.startsWith(shorter) && longer.length > shorter.length) {
    return 0.5;
  }

  const d = levenshtein(normIn, normC);
  if (allowFuzzyDistance(normIn, normC, d)) return d;
  return null;
}

function bestUniqueCandidate(
  rawName: string,
  roster: readonly string[],
  usedNorm?: Set<string>
): string | null {
  const scored: { candidate: string; score: number }[] = [];
  for (const candidate of roster) {
    const normC = normalizeNameForMatch(candidate);
    if (!normC || usedNorm?.has(normC)) continue;
    const score = scoreNameToRosterCandidate(rawName, candidate);
    if (score == null) continue;
    scored.push({ candidate, score });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => a.score - b.score);
  if (scored.length >= 2 && scored[0]!.score === scored[1]!.score) {
    return null;
  }
  return scored[0]!.candidate;
}

/**
 * 読み取り名を名簿のいずれかに名寄せ。
 * 名簿が空のときは入力をそのまま返す。
 */
export function matchNameToRoster(
  rawName: string,
  roster: string[],
  usedNorm?: Set<string>
): RosterMatchResult {
  const original = rawName.trim();
  const rosterUnique = uniqueRosterLabels(roster);
  if (!original || rosterUnique.length === 0) {
    return { name: original || rawName, matched: false };
  }

  const best = bestUniqueCandidate(original, rosterUnique, usedNorm);
  if (!best) {
    return { name: original, matched: false, original };
  }

  return {
    name: pickDisplayNameFromMatch(original, best),
    matched: true,
    original,
  };
}

/**
 * 1 つの名簿名を複数人に割り当てない。完全一致 → 接頭辞 → 編集距離の順。
 */
export function matchNamesToRosterUnique(
  names: string[],
  roster: string[]
): RosterMatchResult[] {
  const results: RosterMatchResult[] = names.map((raw) => ({
    name: raw.trim() || raw,
    matched: false,
    original: raw.trim() || raw,
  }));
  const rosterUnique = uniqueRosterLabels(roster);
  if (rosterUnique.length === 0) return results;

  const usedNorm = new Set<string>();
  const assignPass = (allow: (score: number) => boolean) => {
    for (let i = 0; i < names.length; i += 1) {
      if (results[i]!.matched) continue;
      const original = names[i]!.trim();
      if (!original) continue;

      const scored: { candidate: string; score: number }[] = [];
      for (const candidate of rosterUnique) {
        const normC = normalizeNameForMatch(candidate);
        if (!normC || usedNorm.has(normC)) continue;
        const score = scoreNameToRosterCandidate(original, candidate);
        if (score == null || !allow(score)) continue;
        scored.push({ candidate, score });
      }
      if (scored.length === 0) continue;
      scored.sort((a, b) => a.score - b.score);
      if (scored.length >= 2 && scored[0]!.score === scored[1]!.score) {
        continue;
      }
      const best = scored[0]!.candidate;
      usedNorm.add(normalizeNameForMatch(best));
      results[i] = {
        name: pickDisplayNameFromMatch(original, best),
        matched: true,
        original,
      };
    }
  };

  assignPass((score) => score === 0);
  assignPass((score) => score === 0.5);
  assignPass((score) => score >= 1);

  return results;
}
