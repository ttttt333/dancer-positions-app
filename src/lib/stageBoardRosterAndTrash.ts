import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import { sortCuesByStart } from "../core/timelineController";

/**
 * 先頭キュー用フォーメーションから印を消したあと、名簿紐付きなら名簿からも外す。
 * 他フォーメーションの印は残し、同じ crewMemberId のリンクだけ解除する（名簿の「削除」と同様）。
 */
export function syncRosterAfterRemovingLinkedMembersFromFirstCue(
  p: ChoreographyProjectJson,
  editedFormationId: string,
  removedSpots: DancerSpot[]
): ChoreographyProjectJson {
  if (removedSpots.length === 0) return p;
  const sorted = sortCuesByStart(p.cues);
  const first = sorted[0];
  if (!first || first.formationId !== editedFormationId) return p;

  const memberIds = new Set<string>();
  for (const d of removedSpots) {
    if (d.crewMemberId) memberIds.add(d.crewMemberId);
  }
  if (memberIds.size === 0) return p;

  return {
    ...p,
    crews: p.crews.map((c) => ({
      ...c,
      members: c.members.filter((m) => !memberIds.has(m.id)),
    })),
    formations: p.formations.map((f) => ({
      ...f,
      dancers: f.dancers.map((d) =>
        d.crewMemberId && memberIds.has(d.crewMemberId)
          ? { ...d, crewMemberId: undefined }
          : d
      ),
    })),
  };
}

/**
 * ドラッグ削除のゴミ箱はステージ外（画面左端の固定帯）のみ。
 * 帯の幅は CSS `clamp(72px, 8.5vw, 140px)` と同じ式で hit 判定と揃える。
 */
export function trashViewportStripWidthPx(viewportWidth: number): number {
  const raw = viewportWidth * 0.085;
  return Math.max(72, Math.min(140, raw));
}

export function pointerInViewportTrashRevealZone(clientX: number): boolean {
  if (typeof window === "undefined") return false;
  const w = window.innerWidth;
  if (w <= 0) return false;
  return clientX <= trashViewportStripWidthPx(w);
}
