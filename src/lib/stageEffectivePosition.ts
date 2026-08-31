export type StagePosPct = {
  xPct: number;
  yPct: number;
};

export type StagePositionOverlays = {
  shapePreviewById?: ReadonlyMap<string, StagePosPct> | null;
  depthPreviewById?: ReadonlyMap<string, StagePosPct> | null;
  rotationPreviewById?: ReadonlyMap<string, StagePosPct> | null;
  groupPosDraft?: ReadonlyMap<string, StagePosPct> | null;
};

/**
 * ステージ上の実効座標。合成はここだけ。
 * shape preview → depth preview → 位置交換 preview → 回転ドラフト → 永続 xPct/yPct
 */
export function getEffectiveDancerPosition(
  dancer: { id: string; xPct: number; yPct: number },
  overlays: StagePositionOverlays = {}
): StagePosPct {
  const shape = overlays.shapePreviewById?.get(dancer.id);
  if (shape) return shape;
  const depth = overlays.depthPreviewById?.get(dancer.id);
  if (depth) return depth;
  const rotation = overlays.rotationPreviewById?.get(dancer.id);
  if (rotation) return rotation;
  const draft = overlays.groupPosDraft?.get(dancer.id);
  if (draft) return draft;
  return { xPct: dancer.xPct, yPct: dancer.yPct };
}

export function applyEffectivePositions<T extends { id: string; xPct: number; yPct: number }>(
  dancers: readonly T[],
  overlays: StagePositionOverlays
): T[] {
  if (
    !overlays.shapePreviewById?.size &&
    !overlays.depthPreviewById?.size &&
    !overlays.rotationPreviewById?.size &&
    !overlays.groupPosDraft?.size
  ) {
    return dancers as T[];
  }
  return dancers.map((d) => {
    const pos = getEffectiveDancerPosition(d, overlays);
    if (pos.xPct === d.xPct && pos.yPct === d.yPct) return d;
    return { ...d, xPct: pos.xPct, yPct: pos.yPct };
  });
}
