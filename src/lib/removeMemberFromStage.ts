import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import { cloneFormationForNewCue } from "./cueInterval";

export type MemberDeleteScope = "cue" | "all";

function collectRemovalKeys(
  dancers: readonly DancerSpot[],
  dancerIds: readonly string[]
): { ids: Set<string>; crewIds: Set<string> } {
  const idSet = new Set(dancerIds);
  const ids = new Set<string>();
  const crewIds = new Set<string>();
  for (const d of dancers) {
    if (!idSet.has(d.id)) continue;
    ids.add(d.id);
    if (d.crewMemberId) crewIds.add(d.crewMemberId);
  }
  /** 同一名簿の重複印も対象に含める */
  if (crewIds.size > 0) {
    for (const d of dancers) {
      if (d.crewMemberId && crewIds.has(d.crewMemberId)) ids.add(d.id);
    }
  }
  return { ids, crewIds };
}

function spotMatchesRemoval(
  d: DancerSpot,
  ids: Set<string>,
  crewIds: Set<string>
): boolean {
  if (ids.has(d.id)) return true;
  if (d.crewMemberId && crewIds.has(d.crewMemberId)) return true;
  return false;
}

/**
 * 他キューが同じフォーメーションを共有しているとき、このキュー用に複製して切り出す。
 * 「このキューのみ」削除で他キューの立ち位置を壊さないため。
 */
export function forkFormationForCueIfShared(
  p: ChoreographyProjectJson,
  cueId: string | null | undefined,
  formationId: string
): { project: ChoreographyProjectJson; formationId: string } {
  if (!cueId) return { project: p, formationId };
  const cuesUsing = p.cues.filter((c) => c.formationId === formationId);
  if (cuesUsing.length <= 1) return { project: p, formationId };
  const cue = p.cues.find((c) => c.id === cueId);
  if (!cue || cue.formationId !== formationId) {
    return { project: p, formationId };
  }
  const src = p.formations.find((f) => f.id === formationId);
  if (!src) return { project: p, formationId };
  const cloned = cloneFormationForNewCue(src, { preserveName: true });
  return {
    project: {
      ...p,
      formations: [...p.formations, cloned],
      cues: p.cues.map((c) =>
        c.id === cueId ? { ...c, formationId: cloned.id } : c
      ),
      activeFormationId:
        p.activeFormationId === formationId ? cloned.id : p.activeFormationId,
    },
    formationId: cloned.id,
  };
}

/**
 * ステージ上のメンバー削除。
 * - cue: 指定フォーメーションのみ（共有時は当該キューをフォーク）
 * - all: 全フォーメーションから削除し、名簿からも外す
 */
export function removeMembersFromStage(
  p: ChoreographyProjectJson,
  opts: {
    formationId: string;
    cueId?: string | null;
    dancerIds: readonly string[];
    scope: MemberDeleteScope;
  }
): ChoreographyProjectJson {
  const { dancerIds, scope } = opts;
  if (dancerIds.length === 0) return p;

  let project = p;
  let formationId = opts.formationId;

  if (scope === "cue") {
    const forked = forkFormationForCueIfShared(
      project,
      opts.cueId,
      formationId
    );
    project = forked.project;
    formationId = forked.formationId;
  }

  const target = project.formations.find((f) => f.id === formationId);
  if (!target) return project;

  const { ids, crewIds } = collectRemovalKeys(target.dancers, dancerIds);
  if (ids.size === 0 && crewIds.size === 0) return project;

  if (scope === "cue") {
    return {
      ...project,
      formations: project.formations.map((f) => {
        if (f.id !== formationId) return f;
        const dancers = f.dancers.filter(
          (d) => !spotMatchesRemoval(d, ids, crewIds)
        );
        if (dancers.length === f.dancers.length) return f;
        return {
          ...f,
          dancers,
          confirmedDancerCount: dancers.length,
        };
      }),
    };
  }

  /** all: 全隊形から除去＋名簿からも外す */
  return {
    ...project,
    formations: project.formations.map((f) => {
      const dancers = f.dancers.filter(
        (d) => !spotMatchesRemoval(d, ids, crewIds)
      );
      if (dancers.length === f.dancers.length) return f;
      return {
        ...f,
        dancers,
        confirmedDancerCount: dancers.length,
      };
    }),
    crews:
      crewIds.size === 0
        ? project.crews
        : project.crews.map((c) => ({
            ...c,
            members: c.members.filter((m) => !crewIds.has(m.id)),
          })),
  };
}

/** キューが2つ以上あるときだけスコープ確認が必要 */
export function shouldConfirmMemberDeleteScope(
  p: ChoreographyProjectJson
): boolean {
  return p.cues.length > 1;
}
