/**
 * 手書きひらがなの字形ゆれ。一般の編集距離は使わない。
 * は/ほ のような最小対は含めない（はなか ≠ ほなか）。
 */
const CONFUSION_GROUPS: readonly (readonly string[])[] = [
  ["あ", "お"],
  ["あ", "め"],
  ["あ", "か"],
  ["め", "ぬ"],
  ["ぬ", "の"],
  ["か", "が"],
  ["き", "ぎ", "さ"],
  ["く", "ぐ"],
  ["け", "げ"],
  ["こ", "ご"],
  ["さ", "ざ"],
  ["し", "じ", "つ"],
  ["す", "ず"],
  ["せ", "ぜ"],
  ["そ", "ぞ", "ん", "る"],
  ["た", "だ"],
  ["ち", "ぢ"],
  ["つ", "う", "ら"],
  ["て", "で"],
  ["と", "ど"],
  ["な", "た"],
  ["ね", "れ", "わ"],
  ["は", "ば", "ぱ"],
  ["ひ", "び", "ぴ", "い"],
  ["ふ", "ぶ", "ぷ"],
  ["へ", "べ", "ぺ"],
  ["ほ", "ぼ", "ぽ"],
  ["ま", "も"],
  ["や", "ゃ"],
  ["ゆ", "ゅ", "う"],
  ["よ", "ょ"],
  ["り", "い"],
  ["る", "ろ"],
];

const SKIPPABLE = new Set(["っ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゃ", "ゅ", "ょ", "ー"]);

const CONFUSABLE = new Set<string>();
for (const group of CONFUSION_GROUPS) {
  for (let i = 0; i < group.length; i += 1) {
    for (let j = 0; j < group.length; j += 1) {
      if (i === j) continue;
      CONFUSABLE.add(`${group[i]}\0${group[j]}`);
    }
  }
}

function confusable(a: string, b: string): boolean {
  return a === b || CONFUSABLE.has(`${a}\0${b}`);
}

function alignCost(a: string, b: string): number | null {
  if (a.length !== b.length) return null;
  let cost = 0;
  for (let i = 0; i < a.length; i += 1) {
    const ca = a[i]!;
    const cb = b[i]!;
    if (ca === cb) continue;
    if (!confusable(ca, cb)) return null;
    cost += 1;
  }
  return cost;
}

function dropOneSkippable(s: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < s.length; i += 1) {
    if (!SKIPPABLE.has(s[i]!) && s[i] !== "う") continue;
    const next = s.slice(0, i) + s.slice(i + 1);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

/**
 * 小さいほど近い。不一致は null。
 * 0 = 全一致、1 = 字形ゆれ1字、2 = 長い名前でゆれ2字、または送りがな1字の差。
 */
export function handwritingNameCost(raw: string, candidate: string): number | null {
  if (!raw || !candidate) return null;
  if (raw === candidate) return 0;

  const same = alignCost(raw, candidate);
  if (same === 0) return 0;
  if (same === 1) return 1;
  if (same === 2 && raw.length >= 4 && candidate.length >= 4) return 2;

  if (Math.abs(raw.length - candidate.length) !== 1) return null;

  const longer = raw.length > candidate.length ? raw : candidate;
  const shorter = raw.length > candidate.length ? candidate : raw;
  let best: number | null = null;
  for (const dropped of dropOneSkippable(longer)) {
    if (dropped.length !== shorter.length) continue;
    const cost = alignCost(dropped, shorter);
    if (cost == null) continue;
    const total = cost + 1;
    if (total > 2) continue;
    if (best == null || total < best) best = total;
  }
  return best;
}

function kanaEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j]! + 1, prev + 1, row[j - 1]! + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length]!;
}

function isHaHoMinimalPair(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let haHo = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    const swap =
      (a[i] === "は" && b[i] === "ほ") || (a[i] === "ほ" && b[i] === "は");
    if (!swap) return false;
    haHo += 1;
  }
  return haHo === 1;
}

/**
 * 残り少人数の再照合用。全体名簿では使わない。
 * 3 = 1文字差、4 = 3文字以上の2文字差。はなか≠ほなか は結ばない。
 */
export function smallSetNameCost(raw: string, candidate: string): number | null {
  if (!raw || !candidate || raw === candidate) return null;
  if (isHaHoMinimalPair(raw, candidate)) return null;
  const d = kanaEditDistance(raw, candidate);
  if (d === 1) return 3;
  if (d === 2 && Math.min(raw.length, candidate.length) >= 3) return 4;
  return null;
}
