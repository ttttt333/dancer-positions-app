import { handwritingNameCost, smallSetNameCost } from "./handwritingKana";

/** カタカナ → ひらがな（比較用の簡易正規化） */
export function normalizeNameForMatch(s: string): string {
  return s
    .trim()
    .replace(/[\u30a1-\u30f6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    )
    .replace(/\s+/g, "");
}

export type RosterMatchResult = {
  name: string;
  matched: boolean;
  /** 名簿と一致した場合の元の読み取り名 */
  original?: string;
};

/** 名簿に載っている表記をそのまま使う。画像の漢字化・別表記へ置き換えない */
export function pickDisplayNameFromMatch(
  _original: string,
  matchedHint: string
): string {
  return matchedHint.trim();
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

/**
 * 小さいほど近い。一致なしは null。
 * 0 完全一致、0.5 一意な接頭辞/接尾辞、1〜2 手書きの字形ゆれ。
 * はなか ≠ ほなか、かえご ≠ かえで（任意の1文字違いでは結ばない）。
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
  if (shorter.length >= 2 && longer.length > shorter.length) {
    if (longer.startsWith(shorter) || longer.endsWith(shorter)) return 0.5;
  }

  const hw = handwritingNameCost(normIn, normC);
  if (hw == null || hw === 0) return hw;
  return hw;
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

function unmatchedName(original: string, roster: readonly string[]): string {
  return roster.length > 0 ? "" : original;
}

/**
 * 読み取り名を名簿のいずれかに名寄せ。
 * 名簿があるときは名簿の表記だけを返す。載っていない読みは空文字。
 */
export function matchNameToRoster(
  rawName: string,
  roster: string[],
  usedNorm?: Set<string>
): RosterMatchResult {
  const original = rawName.trim();
  const rosterUnique = uniqueRosterLabels(roster);
  if (rosterUnique.length === 0) {
    return { name: original || rawName, matched: false };
  }
  if (!original) {
    return { name: "", matched: false, original };
  }

  const best = bestUniqueCandidate(original, rosterUnique, usedNorm);
  if (!best) {
    return { name: unmatchedName(original, rosterUnique), matched: false, original };
  }

  return {
    name: pickDisplayNameFromMatch(original, best),
    matched: true,
    original,
  };
}

/**
 * 1 つの名簿名を複数人に割り当てない。
 * 完全一致 → 接頭辞/接尾辞 → 手書きの字形ゆれ → 残り少人数の再照合 → 残り1人の消去法。
 * 名簿外の文字列は残さない。
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
      if (!original) {
        results[i] = { name: "", matched: false, original };
        continue;
      }

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
  assignPass((score) => score === 1);
  assignPass((score) => score === 2);

  for (let i = 0; i < results.length; i += 1) {
    if (results[i]!.matched) continue;
    const original = names[i]?.trim() || results[i]!.original || "";
    results[i] = {
      name: unmatchedName(original, rosterUnique),
      matched: false,
      original,
    };
  }

  rematchSmallRemaining(results, names, rosterUnique, usedNorm);
  assignLastRemainingByElimination(results, rosterUnique, usedNorm);

  return results;
}

const SMALL_REMAINING = 8;

function unusedRosterLabels(
  rosterUnique: readonly string[],
  usedNorm: Set<string>
): string[] {
  return rosterUnique.filter(
    (candidate) => !usedNorm.has(normalizeNameForMatch(candidate))
  );
}

function unmatchedIndices(results: RosterMatchResult[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < results.length; i += 1) {
    if (!results[i]!.matched) out.push(i);
  }
  return out;
}

function scoreAmongRemaining(rawName: string, candidate: string): number | null {
  const strict = scoreNameToRosterCandidate(rawName, candidate);
  if (strict != null) return strict;
  return smallSetNameCost(
    normalizeNameForMatch(rawName),
    normalizeNameForMatch(candidate)
  );
}

/**
 * 確かな名寄せのあと、残った少人数と残った名簿だけで再照合する。
 * 一意に近い人から付け、争うときはどちらにも付けない。
 */
function rematchSmallRemaining(
  results: RosterMatchResult[],
  names: string[],
  rosterUnique: readonly string[],
  usedNorm: Set<string>
): void {
  for (const allow of [(s: number) => s === 3, (s: number) => s === 4]) {
    let progress = true;
    while (progress) {
      progress = false;
      const unused = unusedRosterLabels(rosterUnique, usedNorm);
      const idxs = unmatchedIndices(results).filter((i) => names[i]!.trim());
      if (
        idxs.length === 0 ||
        unused.length === 0 ||
        idxs.length > SMALL_REMAINING ||
        unused.length > SMALL_REMAINING
      ) {
        return;
      }

      const picks: { i: number; candidate: string; score: number }[] = [];
      for (const i of idxs) {
        const original = names[i]!.trim();
        const scored: { candidate: string; score: number }[] = [];
        for (const candidate of unused) {
          const score = scoreAmongRemaining(original, candidate);
          if (score == null || !allow(score)) continue;
          scored.push({ candidate, score });
        }
        if (scored.length === 0) continue;
        scored.sort((a, b) => a.score - b.score);
        if (scored.length >= 2 && scored[0]!.score === scored[1]!.score) continue;
        picks.push({
          i,
          candidate: scored[0]!.candidate,
          score: scored[0]!.score,
        });
      }

      const claimed = new Map<string, number>();
      for (const pick of picks) {
        const key = normalizeNameForMatch(pick.candidate);
        claimed.set(key, (claimed.get(key) ?? 0) + 1);
      }
      for (const pick of picks) {
        if (claimed.get(normalizeNameForMatch(pick.candidate)) !== 1) continue;
        if (results[pick.i]!.matched) continue;
        if (usedNorm.has(normalizeNameForMatch(pick.candidate))) continue;
        usedNorm.add(normalizeNameForMatch(pick.candidate));
        const original = names[pick.i]!.trim();
        results[pick.i] = {
          name: pickDisplayNameFromMatch(original, pick.candidate),
          matched: true,
          original,
        };
        progress = true;
      }
    }
  }
}

/** 確かな名寄せのあと、空欄1人かつ名簿の残り1人ならその名簿名を付ける */
function assignLastRemainingByElimination(
  results: RosterMatchResult[],
  rosterUnique: readonly string[],
  usedNorm: Set<string>
): void {
  const unused = unusedRosterLabels(rosterUnique, usedNorm);
  const unmatchedIdx = unmatchedIndices(results);
  if (unused.length !== 1 || unmatchedIdx.length !== 1) return;

  const last = unused[0]!;
  const i = unmatchedIdx[0]!;
  usedNorm.add(normalizeNameForMatch(last));
  results[i] = {
    name: pickDisplayNameFromMatch(results[i]!.original ?? "", last),
    matched: true,
    original: results[i]!.original,
  };
}
