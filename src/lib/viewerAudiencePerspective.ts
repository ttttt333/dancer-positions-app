import type { AudienceEdge } from "../types/choreography";

/** 閲覧画面: 創作時の向き（舞台側）か、客席側から見るか */
export type ViewerAudiencePerspective = "stage" | "audience";

export function flipAudienceEdge(edge: AudienceEdge): AudienceEdge {
  return edge === "top" ? "bottom" : "top";
}

/** 作品の客席設定に対し、閲覧者が選んだ見る位置を反映した客席辺 */
export function resolveViewerAudienceEdge(
  projectEdge: AudienceEdge,
  perspective: ViewerAudiencePerspective
): AudienceEdge {
  if (perspective === "audience") {
    return flipAudienceEdge(projectEdge);
  }
  return projectEdge;
}
