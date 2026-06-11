import type { ChoreographyProjectJson } from "../types/choreography";
import { getViewRosterEntries } from "./viewRoster";

const MAX_HINTS = 80;

/** 写真解析プロンプトへ渡すメンバー名候補（重複除去・上限あり） */
export function collectMemberNameHints(
  project: ChoreographyProjectJson
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of getViewRosterEntries(project)) {
    const label = entry.label.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= MAX_HINTS) break;
  }
  return out;
}
