import { entriesFromRosterRows, entriesFromFullNames } from "./rosterHintCatalog";
import type { RosterHintEntry } from "./rosterHintCatalog";

export type { RosterHintEntry };
export {
  entriesFromRosterRows,
  entriesFromFullNames,
  buildHintsFromEntries,
  hintLabelForEntry,
  type RosterHintNameMode,
  type RosterHintBuildResult,
} from "./rosterHintCatalog";

/** @deprecated entriesFromRosterRows を使用 */
export function extractNameHintsFromRows(rows: string[][]): string[] {
  return entriesFromRosterRows(rows).map((e) => e.fullName);
}

/** プロジェクト名簿が番号のみ（1, 2, 3…）かどうか */
export function isNumericPlaceholderRoster(labels: string[]): boolean {
  if (!labels.length) return false;
  return labels.every((label) => /^\d{1,3}$/.test(label.trim()));
}

export function mergeNameHints(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const name of list) {
      const label = name.trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
      if (out.length >= 80) return out;
    }
  }
  return out;
}

export function mergeHintToFullNameMaps(
  ...maps: Map<string, string>[]
): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of maps) {
    for (const [k, v] of m) out.set(k, v);
  }
  return out;
}
