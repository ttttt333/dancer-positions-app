import type {
  ChoreographyProjectJson,
  DancerSpot,
} from "../types/choreography";
import type { DancerFigure3dId } from "./dancerFigure3d";

/** 3D フィギュアの適用範囲 */
export type DancerFigure3dApplyScope = "cue" | "all";

/** human はフィールド省略、それ以外は figure3d をセット */
export function withDancerFigure3d(
  spot: DancerSpot,
  figure3d: DancerFigure3dId
): DancerSpot {
  if (figure3d === "human") {
    if (spot.figure3d == null) return spot;
    const { figure3d: _f, ...rest } = spot;
    return rest;
  }
  if (spot.figure3d === figure3d) return spot;
  return { ...spot, figure3d };
}

/**
 * 同一ダンサー（id / crewMemberId）へ 3D フィギュアを適用。
 * scope=all: 全フォーメーション / scope=cue: 指定フォーメーションのみ。
 */
export function applyDancerFigure3d(
  project: ChoreographyProjectJson,
  opts: {
    dancerIds: string[];
    formationId?: string | null;
    figure3d: DancerFigure3dId;
    scope?: DancerFigure3dApplyScope;
  }
): ChoreographyProjectJson {
  const idSet = new Set(opts.dancerIds);
  if (idSet.size === 0) return project;
  const scope = opts.scope ?? "all";

  const crewIds = new Set<string>();
  const seedForms = opts.formationId
    ? project.formations.filter((f) => f.id === opts.formationId)
    : project.formations;
  for (const f of seedForms) {
    for (const d of f.dancers) {
      if (!idSet.has(d.id)) continue;
      if (d.crewMemberId) crewIds.add(d.crewMemberId);
    }
  }

  const matches = (d: DancerSpot) =>
    idSet.has(d.id) || Boolean(d.crewMemberId && crewIds.has(d.crewMemberId));

  return {
    ...project,
    formations: project.formations.map((f) => {
      if (scope === "cue" && opts.formationId && f.id !== opts.formationId) {
        return f;
      }
      return {
        ...f,
        dancers: f.dancers.map((d) =>
          matches(d) ? withDancerFigure3d(d, opts.figure3d) : d
        ),
      };
    }),
  };
}

/** @deprecated use applyDancerFigure3d */
export const applyFigure3dAcrossAllFormations = applyDancerFigure3d;
