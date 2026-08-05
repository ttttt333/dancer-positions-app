import {
  FREE_MAX_CUES,
  FREE_MAX_DANCERS,
} from "./entitlements";
import { FREE_CLOUD_PROJECT_LIMIT } from "./supabaseBilling";
import { sortCuesByStart } from "../core/timelineController";
import type { ChoreographyProjectJson } from "../types/choreography";

export { FREE_CLOUD_PROJECT_LIMIT, FREE_MAX_CUES, FREE_MAX_DANCERS };

export type ProjectListExcessRef = {
  id: number;
  name: string;
  updated_at: string;
  cueCount: number;
  dancerCount: number;
};

export type FreePlanExcessReport = {
  projectCount: number;
  projectsToDelete: ProjectListExcessRef[];
  projectsToKeep: ProjectListExcessRef[];
  projectsNeedingContentTrim: Array<{
    id: number;
    name: string;
    cueCount: number;
    maxDancers: number;
    cuesToRemove: number;
    dancersToRemove: number;
  }>;
  hasExcess: boolean;
};

export type TrimProjectResult = {
  project: ChoreographyProjectJson;
  cuesRemoved: number;
  dancersRemoved: number;
  changed: boolean;
};

/** フォーメーション横断の最大人数 */
export function maxDancersInProject(project: ChoreographyProjectJson): number {
  let max = 0;
  for (const f of project.formations) {
    max = Math.max(max, f.dancers?.length ?? 0);
  }
  return max;
}

/**
 * 無料枠超過の作品本文を削減する。
 * - キューは開始時刻順に先頭 FREE_MAX_CUES 件を残す
 * - 残したキューが参照するフォーメーションのみ残し、各人数を FREE_MAX_DANCERS までに切る
 * - キューが無いときは先頭フォーメーションのみ残す
 */
export function trimProjectToFreeLimits(
  project: ChoreographyProjectJson
): TrimProjectResult {
  const sortedCues = sortCuesByStart(project.cues);
  const keptCues = sortedCues.slice(0, FREE_MAX_CUES);
  const cuesRemoved = Math.max(0, sortedCues.length - keptCues.length);

  const byId = new Map(project.formations.map((f) => [f.id, f] as const));
  let dancersRemoved = 0;

  const trimDancers = <T extends { dancers: ChoreographyProjectJson["formations"][number]["dancers"] }>(
    f: T
  ): T => {
    const before = f.dancers?.length ?? 0;
    if (before <= FREE_MAX_DANCERS) return f;
    dancersRemoved += before - FREE_MAX_DANCERS;
    return { ...f, dancers: f.dancers.slice(0, FREE_MAX_DANCERS) };
  };

  let nextFormations: ChoreographyProjectJson["formations"];

  if (keptCues.length === 0) {
    const first = project.formations[0];
    nextFormations = first ? [trimDancers(first)] : [];
  } else {
    const seen = new Set<string>();
    nextFormations = [];
    for (const cue of keptCues) {
      if (seen.has(cue.formationId)) continue;
      const f = byId.get(cue.formationId);
      if (!f) continue;
      seen.add(cue.formationId);
      nextFormations.push(trimDancers(f));
    }
    if (nextFormations.length === 0 && project.formations[0]) {
      nextFormations = [trimDancers(project.formations[0])];
    }
  }

  const formationIds = new Set(nextFormations.map((f) => f.id));
  const cues = keptCues.map((c) =>
    formationIds.has(c.formationId)
      ? c
      : {
          ...c,
          formationId: nextFormations[0]?.id ?? c.formationId,
        }
  );

  const activeFormationId =
    nextFormations.find((f) => f.id === project.activeFormationId)?.id ??
    nextFormations[0]?.id ??
    project.activeFormationId;

  const changed =
    cuesRemoved > 0 ||
    dancersRemoved > 0 ||
    nextFormations.length !== project.formations.length ||
    cues.length !== project.cues.length ||
    activeFormationId !== project.activeFormationId;

  return {
    project: {
      ...project,
      formations: nextFormations,
      cues,
      activeFormationId,
    },
    cuesRemoved,
    dancersRemoved,
    changed,
  };
}

/**
 * 一覧情報から超過を概算。本文の人数は一覧要約の dancerCount を使う
 * （先頭フォーメーション基準。詳細は実行時に再取得して trim）。
 */
export function analyzeFreePlanExcessFromList(
  projects: ProjectListExcessRef[]
): FreePlanExcessReport {
  const sorted = [...projects].sort((a, b) => {
    const ta = Date.parse(a.updated_at) || 0;
    const tb = Date.parse(b.updated_at) || 0;
    return tb - ta;
  });

  const projectsToKeep = sorted.slice(0, FREE_CLOUD_PROJECT_LIMIT);
  const projectsToDelete = sorted.slice(FREE_CLOUD_PROJECT_LIMIT);

  const keepIds = new Set(projectsToKeep.map((p) => p.id));
  const projectsNeedingContentTrim = projects
    .filter((p) => keepIds.has(p.id))
    .filter(
      (p) =>
        p.cueCount > FREE_MAX_CUES || p.dancerCount > FREE_MAX_DANCERS
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      cueCount: p.cueCount,
      maxDancers: p.dancerCount,
      cuesToRemove: Math.max(0, p.cueCount - FREE_MAX_CUES),
      dancersToRemove: Math.max(0, p.dancerCount - FREE_MAX_DANCERS),
    }));

  return {
    projectCount: projects.length,
    projectsToDelete,
    projectsToKeep,
    projectsNeedingContentTrim,
    hasExcess:
      projectsToDelete.length > 0 || projectsNeedingContentTrim.length > 0,
  };
}
