import type { ChoreographyProjectJson } from "../types/choreography";

/**
 * 閲覧モードのメンバー候補（生徒が自分の名前を選ぶための一覧）。
 * 名簿 `crews[].members` と全フォーメーションの立ち位置ラベルを統合（重複除去）。
 */
export type ViewRosterEntry = {
  id: string;
  label: string;
  source: "crew" | "dancer";
};

function normLabel(s: string) {
  return s.trim();
}

function rosterKey(entry: ViewRosterEntry): string {
  const label = normLabel(entry.label).toLowerCase();
  if (label) return `label:${label}`;
  return `id:${entry.id}`;
}

export function getViewRosterEntries(
  project: ChoreographyProjectJson
): ViewRosterEntry[] {
  const byKey = new Map<string, ViewRosterEntry>();

  const add = (entry: ViewRosterEntry) => {
    const key = rosterKey(entry);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entry);
      return;
    }
    if (existing.source === "dancer" && entry.source === "crew") {
      byKey.set(key, entry);
    }
  };

  for (const crew of project.crews) {
    for (const m of crew.members) {
      const label = normLabel(m.label) || m.id;
      add({ id: m.id, label, source: "crew" });
    }
  }

  for (const f of project.formations) {
    for (const d of f.dancers) {
      const label = normLabel(d.label);
      if (!label) continue;
      const id = d.crewMemberId?.trim() || `label:${label}`;
      add({ id, label, source: "dancer" });
    }
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "ja")
  );
}
