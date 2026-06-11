import {
  rowsToCrewMembers,
  type RosterNameImportMode,
} from "./crewCsvImport";

export type RosterHintNameMode = RosterNameImportMode;

export type RosterHintEntry = {
  id: string;
  fullName: string;
  familyName: string;
  givenName: string;
};

const MAX_HINTS = 80;

function firstGrapheme(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const cp = t.codePointAt(0);
  return cp === undefined ? "" : String.fromCodePoint(cp);
}

/** フルネーム文字列から苗字・名を推定 */
export function splitJapaneseFullName(full: string): {
  family: string;
  given: string;
} {
  const t = full.trim();
  if (!t) return { family: "", given: "" };
  if (/\s/u.test(t)) {
    const parts = t.split(/\s+/u).filter(Boolean);
    if (parts.length >= 2) {
      return { family: parts[0] ?? "", given: parts[parts.length - 1] ?? "" };
    }
    return { family: parts[0] ?? t, given: parts[0] ?? t };
  }
  const familyMatch = t.match(
    /^[\u3005\u3007\u303b\u3400-\u4dbf\u4e00-\u9fff々〆]{1,4}/u
  );
  if (familyMatch) {
    const family = familyMatch[0];
    const given =
      t.slice(family.length).trim() || t;
    return { family, given };
  }
  return { family: firstGrapheme(t), given: t };
}

export function entryFromFullName(id: string, fullName: string): RosterHintEntry {
  const full = fullName.trim();
  const { family, given } = splitJapaneseFullName(full);
  return {
    id,
    fullName: full,
    familyName: family || full,
    givenName: given || full,
  };
}

export function entriesFromFullNames(names: string[]): RosterHintEntry[] {
  const out: RosterHintEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < names.length; i += 1) {
    const full = names[i]?.trim();
    if (!full || seen.has(full)) continue;
    seen.add(full);
    out.push(entryFromFullName(`name:${full}`, full));
    if (out.length >= MAX_HINTS) break;
  }
  return out;
}

/** 名簿ファイル行からフル・苗字・名付きエントリを生成 */
export function entriesFromRosterRows(rows: string[][]): RosterHintEntry[] {
  if (!rows.length) return [];

  const fullMembers = rowsToCrewMembers(rows, { nameMode: "full" });
  const familyMembers = rowsToCrewMembers(rows, { nameMode: "family_only" });
  const givenMembers = rowsToCrewMembers(rows, { nameMode: "given_only" });

  const out: RosterHintEntry[] = [];
  for (let i = 0; i < fullMembers.length; i += 1) {
    const full = fullMembers[i]!.label.trim();
    if (!full) continue;
    out.push({
      id: fullMembers[i]!.id,
      fullName: full,
      familyName: (familyMembers[i]?.label ?? "").trim() || full,
      givenName: (givenMembers[i]?.label ?? "").trim() || full,
    });
    if (out.length >= MAX_HINTS) break;
  }

  if (out.length > 0) return out;

  return entriesFromFullNames(
    rows.flatMap((row) => row.map((c) => c.trim()).filter(Boolean))
  );
}

export function hintLabelForEntry(
  entry: RosterHintEntry,
  mode: RosterHintNameMode
): string {
  switch (mode) {
    case "family_only":
      return entry.familyName.trim() || entry.fullName;
    case "given_only":
      return entry.givenName.trim() || entry.fullName;
    default:
      return entry.fullName;
  }
}

export type RosterHintBuildResult = {
  hints: string[];
  /** ヒント表記 → キューに載せるフルネーム */
  hintToFullName: Map<string, string>;
};

export function buildHintsFromEntries(
  entries: RosterHintEntry[],
  selectedIds: Set<string>,
  mode: RosterHintNameMode
): RosterHintBuildResult {
  const hints: string[] = [];
  const hintToFullName = new Map<string, string>();
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!selectedIds.has(entry.id)) continue;
    const label = hintLabelForEntry(entry, mode).trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    hints.push(label);
    hintToFullName.set(label, entry.fullName);
    if (hints.length >= MAX_HINTS) break;
  }

  return { hints, hintToFullName };
}

export function resolveFullNameFromHint(
  matchedHint: string,
  hintToFullName: Map<string, string>
): string {
  return hintToFullName.get(matchedHint.trim()) ?? matchedHint;
}
