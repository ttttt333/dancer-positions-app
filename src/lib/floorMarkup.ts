import type { StageFloorMarkup } from "../types/choreography";

/** 複製・キュー複製時にマークアップ id と線の座標配列を複製する */
export function cloneFloorMarkupWithNewIds(
  raw: StageFloorMarkup[] | undefined
): StageFloorMarkup[] | undefined {
  if (!raw?.length) return undefined;
  return raw.map((m) => {
    if (m.kind === "text") {
      return { ...m, id: crypto.randomUUID() };
    }
    return {
      ...m,
      id: crypto.randomUUID(),
      pointsPct: m.pointsPct.map((p) => [p[0], p[1]] as [number, number]),
    };
  });
}
