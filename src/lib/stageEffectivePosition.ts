export type StagePosPct = {
  xPct: number;
  yPct: number;
};

export type StagePositionOverlays = {
  shapePreviewById?: ReadonlyMap<string, StagePosPct> | null;
  groupPosDraft?: ReadonlyMap<string, StagePosPct> | null;
};

/**
 * ステージ上の実効座標。合成はここだけ。
 * preview → 回転ドラフト → 永続 xPct/yPct
 */
export function getEffectiveDancerPosition(
  dancer: { id: string; xPct: number; yPct: number },
  overlays: StagePositionOverlays = {}
): StagePosPct {
  const preview = overlays.shapePreviewById?.get(dancer.id);
  if (preview) return preview;
  const draft = overlays.groupPosDraft?.get(dancer.id);
  if (draft) return draft;
  return { xPct: dancer.xPct, yPct: dancer.yPct };
}

export function applyEffectivePositions<T extends { id: string; xPct: number; yPct: number }>(
  dancers: readonly T[],
  overlays: StagePositionOverlays
): T[] {
  if (!overlays.shapePreviewById?.size && !overlays.groupPosDraft?.size) {
    return dancers as T[];
  }
  return dancers.map((d) => {
    const pos = getEffectiveDancerPosition(d, overlays);
    if (pos.xPct === d.xPct && pos.yPct === d.yPct) return d;
    return { ...d, xPct: pos.xPct, yPct: pos.yPct };
  });
}
