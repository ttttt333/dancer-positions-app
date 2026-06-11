import { rowsToCrewMembers } from "./crewCsvImport";

const MAX_HINTS = 80;

/** 名簿ファイルの行データから解析ヒント用の名前リストを作る */
export function extractNameHintsFromRows(rows: string[][]): string[] {
  if (!rows.length) return [];

  const members = rowsToCrewMembers(rows, { nameMode: "full" });
  const seen = new Set<string>();
  const out: string[] = [];

  for (const m of members) {
    const label = m.label.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= MAX_HINTS) break;
  }

  if (out.length > 0) return out;

  // ヘッダー判定に失敗した単純リスト（1列）向けフォールバック
  for (const row of rows) {
    for (const cell of row) {
      const label = cell.trim();
      if (!label || seen.has(label)) continue;
      if (/^(名前|氏名|name|no|番号)$/i.test(label)) continue;
      seen.add(label);
      out.push(label);
      if (out.length >= MAX_HINTS) break;
    }
    if (out.length >= MAX_HINTS) break;
  }

  return out;
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
      if (out.length >= MAX_HINTS) return out;
    }
  }
  return out;
}
