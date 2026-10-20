import { create } from "zustand";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import { forkFormationForCueIfShared } from "./removeMemberFromStage";
import { DANCER_STAGE_POSITION_PCT_HI, DANCER_STAGE_POSITION_PCT_LO } from "./dancerSpacing";

/** ステージ右クリックの「メンバーをコピー」で覚えておく印（色・名前・身長などのデータごと） */
type DancerClipboardState = {
  spots: DancerSpot[];
  setSpots: (spots: DancerSpot[]) => void;
};

export const useDancerClipboardStore = create<DancerClipboardState>((set) => ({
  spots: [],
  setSpots: (spots) => set({ spots: spots.map((d) => ({ ...d })) }),
}));

export function dancerClipboardLabel(spots: readonly DancerSpot[]): string {
  if (spots.length === 0) return "";
  const first = (spots[0]!.label || "?").trim() || "?";
  return spots.length === 1 ? first : `${first} ほか${spots.length - 1}人`;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function clampPos(v: number): number {
  return Math.min(DANCER_STAGE_POSITION_PCT_HI, Math.max(DANCER_STAGE_POSITION_PCT_LO, v));
}

function sameMember(a: DancerSpot, b: DancerSpot): boolean {
  if (a.id === b.id) return true;
  return !!a.crewMemberId && a.crewMemberId === b.crewMemberId;
}

/**
 * コピーした印を、指定キューの立ち位置へ「同じ人」として貼り付ける。
 * - ID・名簿の紐づけを保つので、キュー間の移動はその人として自然につながる
 * - `at` を渡すと先頭の人をその位置に置き、複数人は相対位置を保つ。省略時はコピー元と同じ位置
 * - すでにその人がいるキューでは、位置だけ貼り付け先に動かす
 * - 他のキューと共有している立ち位置は、このキュー用に複製してから書き換える
 */
export function pasteDancersIntoCue(
  p: ChoreographyProjectJson,
  opts: {
    formationId: string;
    cueId: string | null;
    spots: readonly DancerSpot[];
    at?: { xPct: number; yPct: number } | null;
  }
): { project: ChoreographyProjectJson; pastedIds: string[] } {
  if (opts.spots.length === 0) return { project: p, pastedIds: [] };
  const forked = forkFormationForCueIfShared(p, opts.cueId, opts.formationId);
  const project = forked.project;
  const fid = forked.formationId;
  const target = project.formations.find((f) => f.id === fid);
  if (!target) return { project: p, pastedIds: [] };

  const anchor = opts.spots[0]!;
  const dx = opts.at ? opts.at.xPct - anchor.xPct : 0;
  const dy = opts.at ? opts.at.yPct - anchor.yPct : 0;

  let dancers = [...target.dancers];
  const pastedIds: string[] = [];
  for (const src of opts.spots) {
    const xPct = round2(clampPos(src.xPct + dx));
    const yPct = round2(clampPos(src.yPct + dy));
    const idx = dancers.findIndex((d) => sameMember(d, src));
    if (idx >= 0) {
      dancers[idx] = { ...dancers[idx]!, xPct, yPct };
      pastedIds.push(dancers[idx]!.id);
    } else {
      dancers = [...dancers, { ...src, xPct, yPct }];
      pastedIds.push(src.id);
    }
  }

  return {
    project: {
      ...project,
      formations: project.formations.map((f) =>
        f.id === fid ? { ...f, dancers, confirmedDancerCount: dancers.length } : f
      ),
    },
    pastedIds,
  };
}

/** 時間順で直前のキュー */
export function previousCueOf(
  p: ChoreographyProjectJson,
  cueId: string | null
): ChoreographyProjectJson["cues"][number] | null {
  if (!cueId) return null;
  const sorted = [...p.cues].sort((a, b) => a.tStartSec - b.tStartSec);
  const i = sorted.findIndex((c) => c.id === cueId);
  return i > 0 ? sorted[i - 1]! : null;
}
