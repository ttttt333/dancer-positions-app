import type { ChoreographyProjectJson } from "../types/choreography";
import { entryFromFullName } from "./rosterHintCatalog";
import type { RosterHintEntry } from "./rosterHintCatalog";
import { getViewRosterEntries } from "./viewRoster";

export type RosterHintMember = {
  id: string;
  label: string;
};

export type RosterHintGroup = {
  id: string;
  name: string;
  members: RosterHintMember[];
};

/** 写真解析ダイアログ用：クルー別名簿（名簿が空ならフォーメーション由来を 1 グループ） */
export function getRosterHintGroups(
  project: ChoreographyProjectJson
): RosterHintGroup[] {
  const crewsWithMembers = project.crews.filter((c) => c.members.length > 0);
  if (crewsWithMembers.length > 0) {
    return crewsWithMembers.map((crew) => ({
      id: crew.id,
      name: crew.name.trim() || "名簿",
      members: crew.members.map((m) => ({
        id: m.id,
        label: m.label.trim() || m.id,
      })),
    }));
  }

  const entries = getViewRosterEntries(project);
  if (!entries.length) return [];

  return [
    {
      id: "formation-roster",
      name: "メンバー",
      members: entries.map((e) => ({ id: e.id, label: e.label })),
    },
  ];
}

export function rosterHintEntriesFromGroups(
  groups: RosterHintGroup[]
): RosterHintEntry[] {
  const out: RosterHintEntry[] = [];
  for (const g of groups) {
    for (const m of g.members) {
      out.push(entryFromFullName(m.id, m.label));
    }
  }
  return out;
}

export function allRosterMemberIds(groups: RosterHintGroup[]): string[] {
  const ids: string[] = [];
  for (const g of groups) {
    for (const m of g.members) ids.push(m.id);
  }
  return ids;
}

export function labelsFromSelectedIds(
  groups: RosterHintGroup[],
  selectedIds: Set<string>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    for (const m of g.members) {
      if (!selectedIds.has(m.id)) continue;
      if (seen.has(m.label)) continue;
      seen.add(m.label);
      out.push(m.label);
    }
  }
  return out;
}
