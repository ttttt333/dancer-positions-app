import { create } from "zustand";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import type { DancerMarkerShape } from "./dancerMarkerShape";
import { normalizeDancerFacingDeg } from "./dancerColorPalette";
import { forkFormationForCueIfShared } from "./removeMemberFromStage";

/** 印の形・向きの適用範囲（このキューだけ / すべてのキュー） */
export type DancerMarkerLookScope = "cue" | "all";

/** パネルで選んだ適用範囲。ステージ上で回したときも同じ範囲に反映する */
export const useDancerMarkerLookScopeStore = create<{
  scope: DancerMarkerLookScope;
  setScope: (scope: DancerMarkerLookScope) => void;
}>((set) => ({
  scope: "cue",
  setScope: (scope) => set({ scope }),
}));

export type DancerMarkerLookPatch =
  | { kind: "shape"; shape: DancerMarkerShape }
  | { kind: "facing"; deg: number };

function withLook(d: DancerSpot, patch: DancerMarkerLookPatch): DancerSpot {
  if (patch.kind === "shape") {
    if (patch.shape === "circle") {
      if (d.markerShape == null) return d;
      const { markerShape: _s, ...rest } = d;
      return rest;
    }
    if (d.markerShape === patch.shape) return d;
    return { ...d, markerShape: patch.shape };
  }
  const deg = normalizeDancerFacingDeg(patch.deg);
  if (deg === 0) {
    if (d.facingDeg == null) return d;
    const { facingDeg: _f, ...rest } = d;
    return rest;
  }
  if (d.facingDeg === deg) return d;
  return { ...d, facingDeg: deg };
}

/**
 * 印の形・向きを設定する。
 * - scope=cue: このキューの立ち位置だけ（他のキューと共有中なら複製してから）
 * - scope=all: 同じ人（id・名簿、なければ同人数の隊形の並び順）を全キューで揃える
 */
export function applyDancerMarkerLook(
  p: ChoreographyProjectJson,
  opts: {
    formationId: string;
    cueId: string | null;
    dancerIds: readonly string[];
    scope: DancerMarkerLookScope;
    patch: DancerMarkerLookPatch;
  }
): ChoreographyProjectJson {
  if (opts.dancerIds.length === 0) return p;
  const idSet = new Set(opts.dancerIds);

  if (opts.scope === "cue") {
    const forked = forkFormationForCueIfShared(p, opts.cueId, opts.formationId);
    const fid = forked.formationId;
    return {
      ...forked.project,
      formations: forked.project.formations.map((f) =>
        f.id === fid
          ? {
              ...f,
              dancers: f.dancers.map((d) =>
                idSet.has(d.id) ? withLook(d, opts.patch) : d
              ),
            }
          : f
      ),
    };
  }

  const src = p.formations.find((f) => f.id === opts.formationId);
  if (!src) return p;
  const crewIds = new Set<string>();
  const indexes = new Set<number>();
  src.dancers.forEach((d, i) => {
    if (!idSet.has(d.id)) return;
    indexes.add(i);
    if (d.crewMemberId) crewIds.add(d.crewMemberId);
  });
  const n = src.dancers.length;
  return {
    ...p,
    formations: p.formations.map((f) => {
      const sameCount = f.dancers.length === n;
      let changed = false;
      const dancers = f.dancers.map((d, i) => {
        const hit =
          idSet.has(d.id) ||
          (d.crewMemberId != null && crewIds.has(d.crewMemberId)) ||
          (sameCount && !d.crewMemberId && indexes.has(i));
        if (!hit) return d;
        const next = withLook(d, opts.patch);
        if (next !== d) changed = true;
        return next;
      });
      return changed ? { ...f, dancers } : f;
    }),
  };
}
