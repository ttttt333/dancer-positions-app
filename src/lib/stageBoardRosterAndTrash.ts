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

/** ドラッグ削除ゴミ箱の表示位置（デスクトップ=左端、モバイル=下端） */
export type TrashDropEdge = "left" | "bottom";

/**
 * ドラッグ削除のゴミ箱帯サイズ。
 * 帯の幅／高さは CSS `clamp(72px, 8.5vw|vh, 140px)` と同じ式で hit 判定と揃える。
 */
export function trashViewportStripSizePx(
  viewportSize: number,
  _edge: TrashDropEdge = "left"
): number {
  const raw = viewportSize * 0.085;
  return Math.max(72, Math.min(140, raw));
}

/** @deprecated 左端帯幅のみ。`trashViewportStripSizePx(w, "left")` を使う */
export function trashViewportStripWidthPx(viewportWidth: number): number {
  return trashViewportStripSizePx(viewportWidth, "left");
}

export function pointerInViewportTrashRevealZone(
  clientX: number,
  clientY: number,
  edge: TrashDropEdge = "left"
): boolean {
  if (typeof window === "undefined") return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= 0 || h <= 0) return false;
  if (edge === "bottom") {
    const strip = trashViewportStripSizePx(h, "bottom");
    return clientY >= h - strip;
  }
  const strip = trashViewportStripSizePx(w, "left");
  return clientX <= strip;
}

/** ゴミ箱 DOM 未マウント時のフォールバック hit 判定 */
export function pointerInViewportTrashDropFallback(
  clientX: number,
  clientY: number,
  edge: TrashDropEdge = "left"
): boolean {
  if (typeof window === "undefined") return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= 0 || h <= 0) return false;
  if (edge === "bottom") {
    const strip = trashViewportStripSizePx(h, "bottom");
    return (
      clientX >= 0 &&
      clientX <= w &&
      clientY >= h - strip &&
      clientY <= h
    );
  }
  const strip = trashViewportStripSizePx(w, "left");
  return clientX >= 0 && clientX <= strip && clientY >= 0 && clientY <= h;
}
