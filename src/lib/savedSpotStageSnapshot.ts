import type {
  ChoreographyProjectJson,
  SavedSpotStageSnapshot,
  StageShape,
} from "../types/choreography";

/**
 * 保存した立ち位置と一緒に記録する舞台まわりの設定（適用時にプロジェクトへ復元）。
 */
export function captureStageSnapshot(
  p: ChoreographyProjectJson
): SavedSpotStageSnapshot {
  return {
    audienceEdge: p.audienceEdge,
    stageWidthMm: p.stageWidthMm ?? null,
    stageDepthMm: p.stageDepthMm ?? null,
    sideStageMm: p.sideStageMm ?? null,
    backStageMm: p.backStageMm ?? null,
    centerFieldGuideIntervalMm: p.centerFieldGuideIntervalMm ?? null,
    hanamichiEnabled: p.hanamichiEnabled ?? false,
    hanamichiDepthPct: p.hanamichiDepthPct ?? 14,
    stageShape: p.stageShape ? cloneStageShape(p.stageShape) : undefined,
    gridSpacingMm: p.gridSpacingMm,
    gridStep: p.gridStep,
    snapGrid: p.snapGrid,
    stageGridLinesEnabled: p.stageGridLinesEnabled ?? false,
    stageGridLineSpacingMm: p.stageGridLineSpacingMm ?? p.stageGridSpacingWidthMm ?? 10,
    stageGridSpacingWidthMm: p.stageGridSpacingWidthMm ?? p.stageGridLineSpacingMm ?? 10,
    stageGridSpacingDepthMm: p.stageGridSpacingDepthMm ?? p.stageGridLineSpacingMm ?? 10,
    dancerSpacingMm: p.dancerSpacingMm ?? null,
    dancerMarkerDiameterPx: p.dancerMarkerDiameterPx,
    dancerMarkerDiameterMm: p.dancerMarkerDiameterMm,
    dancerLabelPosition: p.dancerLabelPosition,
  };
}

function cloneStageShape(s: StageShape): StageShape {
  return {
    presetId: s.presetId,
    polygonPct: s.polygonPct.map(([a, b]) => [a, b]),
    params: s.params ? { ...s.params } : undefined,
  };
}

/**
 * 保存した舞台スナップショットをプロジェクトに上書き適用する。
 */
export function mergeStageSnapshotIntoProject(
  p: ChoreographyProjectJson,
  snap: SavedSpotStageSnapshot | undefined | null
): ChoreographyProjectJson {
  if (!snap) return p;
  return {
    ...p,
    audienceEdge: snap.audienceEdge,
    stageWidthMm: snap.stageWidthMm,
    stageDepthMm: snap.stageDepthMm,
    sideStageMm: snap.sideStageMm,
    backStageMm: snap.backStageMm,
    centerFieldGuideIntervalMm: snap.centerFieldGuideIntervalMm,
    hanamichiEnabled: snap.hanamichiEnabled,
    hanamichiDepthPct: snap.hanamichiDepthPct,
    stageShape: snap.stageShape ? cloneStageShape(snap.stageShape) : undefined,
    gridSpacingMm: snap.gridSpacingMm,
    gridStep: snap.gridStep,
    snapGrid: snap.snapGrid,
    stageGridLinesEnabled: snap.stageGridLinesEnabled ?? false,
    stageGridLineSpacingMm:
      snap.stageGridLineSpacingMm ??
      snap.stageGridSpacingWidthMm ??
      10,
    stageGridSpacingWidthMm:
      snap.stageGridSpacingWidthMm ?? snap.stageGridLineSpacingMm ?? 10,
    stageGridSpacingDepthMm:
      snap.stageGridSpacingDepthMm ?? snap.stageGridLineSpacingMm ?? 10,
    dancerSpacingMm: snap.dancerSpacingMm ?? undefined,
    dancerMarkerDiameterPx: snap.dancerMarkerDiameterPx,
    dancerMarkerDiameterMm: snap.dancerMarkerDiameterMm,
    dancerLabelPosition: snap.dancerLabelPosition,
  };
}
