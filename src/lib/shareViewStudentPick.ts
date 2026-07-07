import type { StudentPick } from "../components/ChoreoStudentViewGate";
import type { ChoreographyProjectJson } from "../types/choreography";
import { getViewRosterEntries, type ViewRosterEntry } from "./viewRoster";

export type MemberStudentPick = Extract<StudentPick, { kind: "member" }>;

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

/** 閲覧共有のパート選択を localStorage に保存（再生状態には触れない） */
export function persistViewerStudentPick(
  viewerLocalStorageKey: string | null,
  pick: StudentPick
): void {
  if (!viewerLocalStorageKey) return;
  try {
    localStorage.setItem(viewerLocalStorageKey, JSON.stringify(pick));
  } catch {
    /* ignore */
  }
}

function resolveMemberInRoster(
  member: MemberStudentPick,
  entries: ViewRosterEntry[]
): MemberStudentPick {
  const byId = entries.find((e) => e.id === member.id);
  if (byId) return { kind: "member", id: byId.id, label: byId.label };
  const byLabel = entries.find(
    (e) => e.label.trim() === member.label.trim()
  );
  if (byLabel) return { kind: "member", id: byLabel.id, label: byLabel.label };
  return member;
}

/**
 * 全体表示 ↔ 個人表示を切り替える。
 * 個人へ戻すときは直前のメンバー、なければ名簿の先頭を使う。
 */
export function toggleStudentPickMode(
  current: StudentPick,
  entries: ViewRosterEntry[],
  lastMember: MemberStudentPick | null
): StudentPick {
  if (current.kind === "all") {
    if (entries.length === 0) return { kind: "all" };
    if (lastMember) return resolveMemberInRoster(lastMember, entries);
    const first = entries[0]!;
    return { kind: "member", id: first.id, label: first.label };
  }
  return { kind: "all" };
}
