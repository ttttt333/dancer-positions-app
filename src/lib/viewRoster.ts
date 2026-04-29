import type { ChoreographyProjectJson } from "../types/choreography";

/**
 * 閲覧モードのメンバー候補（生徒が自分の名前を選ぶための一覧）。
 * 名簿 `crews[].members` を優先。名簿が空のときは全フォーメーションの立ち位置ラベルを重複除去。
 */
export type ViewRosterEntry = {
  id: string;
  label: string;
  source: "crew" | "dancer";
};

function normLabel(s: string) {
  return s.trim();
}

export function getViewRosterEntries(
  project: ChoreographyProjectJson
): ViewRosterEntry[] {
  const fromCrew: ViewRosterEntry[] = [];
  for (const crew of project.crews) {
    for (const m of crew.members) {
      const label = normLabel(m.label) || m.id;
      fromCrew.push({ id: m.id, label, source: "crew" });
    }
  }
  if (fromCrew.length > 0) return fromCrew;

  const byLabel = new Map<string, ViewRosterEntry>();
  for (const f of project.formations) {
    for (const d of f.dancers) {
      const label = normLabel(d.label);
      if (!label) continue;
      const id = d.crewMemberId?.trim() || `label:${label}`;
      if (!byLabel.has(label)) {
        byLabel.set(label, { id, label, source: "dancer" });
      }
    }
  }
  return Array.from(byLabel.values());
}
