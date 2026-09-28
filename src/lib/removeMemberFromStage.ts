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

/**
 * 袖（メイン床の左右外側）の x 座標（メイン床幅に対する %）。
 * サイドステージ寸法があればその中央、なければ床のすぐ外側。
 */
export function wingStandbyXPct(
  side: "left" | "right",
  stageWidthMm: number | null | undefined,
  sideStageMm: number | null | undefined
): number {
  const W = typeof stageWidthMm === "number" && stageWidthMm > 0 ? stageWidthMm : 0;
  const S = typeof sideStageMm === "number" && sideStageMm > 0 ? sideStageMm : 0;
  const off = W > 0 && S > 0 ? Math.min(40, (S / W) * 50) : 6;
  return side === "left" ? -off : 100 + off;
}

/**
 * 指定メンバーだけ舞台上に残し、それ以外を左右の袖に縦並びで待機させる。
 * 現在位置が上手/下手どちらに近いかで袖を振り分ける。共有フォーメーションはキュー用にフォーク。
 */
export function moveOtherMembersToWings(
  p: ChoreographyProjectJson,
  opts: {
    formationId: string;
    cueId?: string | null;
    keepDancerIds: readonly string[];
  }
): ChoreographyProjectJson {
  const forked = forkFormationForCueIfShared(p, opts.cueId, opts.formationId);
  const project = forked.project;
  const formationId = forked.formationId;
  const target = project.formations.find((f) => f.id === formationId);
  if (!target) return project;

  const keep = new Set(opts.keepDancerIds);
  const left: number[] = [];
  const right: number[] = [];
  target.dancers.forEach((d, i) => {
    if (keep.has(d.id)) return;
    (d.xPct < 50 ? left : right).push(i);
  });
  if (left.length === 0 && right.length === 0) return project;

  const round2 = (v: number) => Math.round(v * 100) / 100;
  const place = new Map<number, { xPct: number; yPct: number }>();
  const layout = (idxs: number[], side: "left" | "right") => {
    const sorted = [...idxs].sort(
      (a, b) => target.dancers[a]!.yPct - target.dancers[b]!.yPct
    );
    const x = wingStandbyXPct(side, project.stageWidthMm, project.sideStageMm);
    const n = sorted.length;
    sorted.forEach((di, k) => {
      const yPct = n === 1 ? 50 : 8 + (k / (n - 1)) * 84;
      place.set(di, { xPct: round2(x), yPct: round2(yPct) });
    });
  };
  layout(left, "left");
  layout(right, "right");

  return {
    ...project,
    formations: project.formations.map((f) => {
      if (f.id !== formationId) return f;
      return {
        ...f,
        dancers: f.dancers.map((d, i) => {
          const pos = place.get(i);
          return pos ? { ...d, ...pos } : d;
        }),
      };
    }),
  };
}

/** キューが2つ以上あるときだけスコープ確認が必要 */
export function shouldConfirmMemberDeleteScope(
  p: ChoreographyProjectJson
): boolean {
  return p.cues.length > 1;
}
