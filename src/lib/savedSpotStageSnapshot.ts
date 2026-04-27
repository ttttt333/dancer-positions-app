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
    snapGrid: false,
    stageGridLinesEnabled:
      (p.stageGridLinesVerticalEnabled ?? p.stageGridLinesEnabled ?? false) ||
      (p.stageGridLinesHorizontalEnabled ?? p.stageGridLinesEnabled ?? false),
    stageGridLinesVerticalEnabled:
      p.stageGridLinesVerticalEnabled ?? p.stageGridLinesEnabled ?? false,
    stageGridLinesHorizontalEnabled:
      p.stageGridLinesHorizontalEnabled ?? p.stageGridLinesEnabled ?? false,
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
 *
 * スナップショットに `null` の mm フィールドがある場合、**プロジェクト側の既存値は維持**する。
 * （未設定のまま保存されたスナップで、取り込み後に設定したステージ寸法が消えないようにする）
 */
export function mergeStageSnapshotIntoProject(
  p: ChoreographyProjectJson,
  snap: SavedSpotStageSnapshot | undefined | null
): ChoreographyProjectJson {
  if (!snap) return p;
  return {
    ...p,
    audienceEdge: snap.audienceEdge,
    ...(snap.stageWidthMm != null ? { stageWidthMm: snap.stageWidthMm } : {}),
    ...(snap.stageDepthMm != null ? { stageDepthMm: snap.stageDepthMm } : {}),
    ...(snap.sideStageMm != null ? { sideStageMm: snap.sideStageMm } : {}),
    ...(snap.backStageMm != null ? { backStageMm: snap.backStageMm } : {}),
    ...(snap.centerFieldGuideIntervalMm != null
      ? { centerFieldGuideIntervalMm: snap.centerFieldGuideIntervalMm }
      : {}),
    hanamichiEnabled: snap.hanamichiEnabled,
    hanamichiDepthPct: snap.hanamichiDepthPct,
    ...(snap.stageShape ? { stageShape: cloneStageShape(snap.stageShape) } : {}),
    ...(snap.gridSpacingMm != null ? { gridSpacingMm: snap.gridSpacingMm } : {}),
    gridStep: snap.gridStep,
    snapGrid: false,
    stageGridLinesVerticalEnabled:
      snap.stageGridLinesVerticalEnabled ?? snap.stageGridLinesEnabled ?? false,
    stageGridLinesHorizontalEnabled:
      snap.stageGridLinesHorizontalEnabled ?? snap.stageGridLinesEnabled ?? false,
    stageGridLinesEnabled:
      (snap.stageGridLinesVerticalEnabled ?? snap.stageGridLinesEnabled ?? false) ||
      (snap.stageGridLinesHorizontalEnabled ?? snap.stageGridLinesEnabled ?? false),
    stageGridLineSpacingMm:
      snap.stageGridLineSpacingMm ??
      snap.stageGridSpacingWidthMm ??
      10,
    stageGridSpacingWidthMm:
      snap.stageGridSpacingWidthMm ?? snap.stageGridLineSpacingMm ?? 10,
    stageGridSpacingDepthMm:
      snap.stageGridSpacingDepthMm ?? snap.stageGridLineSpacingMm ?? 10,
    ...(snap.dancerSpacingMm != null ? { dancerSpacingMm: snap.dancerSpacingMm } : {}),
    dancerMarkerDiameterPx: snap.dancerMarkerDiameterPx,
    ...(snap.dancerMarkerDiameterMm != null
      ? { dancerMarkerDiameterMm: snap.dancerMarkerDiameterMm }
      : {}),
    ...(snap.dancerLabelPosition
      ? { dancerLabelPosition: snap.dancerLabelPosition }
      : {}),
  };
}
