/**
 * ダンサーの性別ラベル（男子＝青 / 女子＝ピンク）を正規化・色解決する。
 */

export type DancerGenderKind = "male" | "female";

/** 男子（青） */
export const DANCER_GENDER_MALE_HEX = "#3b82f6";
/** 女子（ピンク） */
export const DANCER_GENDER_FEMALE_HEX = "#ec4899";

export const DANCER_GENDER_MALE_THREE = 0x3b82f6;
export const DANCER_GENDER_FEMALE_THREE = 0xec4899;

/** 保存用の標準ラベル */
export const DANCER_GENDER_LABEL_MALE = "男子";
export const DANCER_GENDER_LABEL_FEMALE = "女子";

const MALE_TOKENS = new Set([
  "男",
  "男子",
  "男性",
  "おとこ",
  "おとこのこ",
  "m",
  "male",
  "man",
  "boy",
  "♂",
]);

const FEMALE_TOKENS = new Set([
  "女",
  "女子",
  "女性",
  "おんな",
  "おんなのこ",
  "f",
  "female",
  "woman",
  "girl",
  "♀",
]);

function normalizeGenderToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]/g, "")
    .replace(/[／/|・,，]/g, "");
}

/** 自由入力を男子／女子に解釈。不明なら null */
export function parseDancerGenderKind(
  raw: string | undefined | null
): DancerGenderKind | null {
  if (raw == null) return null;
  const t = normalizeGenderToken(String(raw));
  if (!t) return null;
  if (MALE_TOKENS.has(t)) return "male";
  if (FEMALE_TOKENS.has(t)) return "female";
  if (t.includes("男子") || t.includes("男性") || t === "男") return "male";
  if (t.includes("女子") || t.includes("女性") || t === "女") return "female";
  if (/(^|[^a-z])male([^a-z]|$)/.test(t) || t.includes("boy")) return "male";
  if (/(^|[^a-z])female([^a-z]|$)/.test(t) || t.includes("girl")) return "female";
  return null;
}

export function dancerGenderLabelForKind(kind: DancerGenderKind): string {
  return kind === "male"
    ? DANCER_GENDER_LABEL_MALE
    : DANCER_GENDER_LABEL_FEMALE;
}

export function dancerGenderHex(kind: DancerGenderKind): string {
  return kind === "male" ? DANCER_GENDER_MALE_HEX : DANCER_GENDER_FEMALE_HEX;
}

export function dancerGenderThree(kind: DancerGenderKind): number {
  return kind === "male"
    ? DANCER_GENDER_MALE_THREE
    : DANCER_GENDER_FEMALE_THREE;
}

/**
 * 性別が男子／女子ならその色、それ以外は fallbackHex。
 */
export function resolveDancerDisplayHex(
  genderLabel: string | undefined | null,
  fallbackHex: string
): string {
  const kind = parseDancerGenderKind(genderLabel);
  return kind ? dancerGenderHex(kind) : fallbackHex;
}

/**
 * 性別が男子／女子なら three.js 色、それ以外は fallbackThree。
 */
export function resolveDancerDisplayThree(
  genderLabel: string | undefined | null,
  fallbackThree: number
): number {
  const kind = parseDancerGenderKind(genderLabel);
  return kind ? dancerGenderThree(kind) : fallbackThree;
}
