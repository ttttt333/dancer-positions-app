import type { StudentPick } from "../components/ChoreoStudentViewGate";
import type { ChoreographyProjectJson } from "../types/choreography";
import { getViewRosterEntries } from "./viewRoster";

function parseStoredPick(raw: string): StudentPick | null {
  try {
    const parsed = JSON.parse(raw) as {
      kind?: string;
      id?: string;
      label?: string;
    };
    if (parsed.kind === "all") return { kind: "all" };
    if (
      parsed.kind === "member" &&
      typeof parsed.id === "string" &&
      typeof parsed.label === "string"
    ) {
      return { kind: "member", id: parsed.id, label: parsed.label };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * 閲覧共有でゲートを省略できるパート選択を返す。
 * - 前回の選択（localStorage）
 * - 名簿 0 人 → 全員表示
 * - 名簿 1 人 → その人
 * - 2 人以上 → null（選択画面を出す）
 */
export function resolveAutoStudentPick(
  project: ChoreographyProjectJson,
  viewerLocalStorageKey: string | null
): StudentPick | null {
  if (viewerLocalStorageKey) {
    try {
      const raw = localStorage.getItem(viewerLocalStorageKey);
      if (raw) {
        const stored = parseStoredPick(raw);
        if (stored) return stored;
      }
    } catch {
      /* ignore */
    }
  }

  const entries = getViewRosterEntries(project);
  if (entries.length === 0) return { kind: "all" };
  if (entries.length === 1) {
    return { kind: "member", id: entries[0]!.id, label: entries[0]!.label };
  }
  return null;
}
