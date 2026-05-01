import { useMemo } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { computeEffectiveGridStepPct } from "../lib/stageGridStep";
import { clampHanamichiDepthPct } from "../lib/stageHanamichi";
import {
  isCustomStageShapeActive,
  stageShapePolygonToMaskPath,
  stageShapePolygonToSvgPoints,
} from "../lib/stageShapePaths";

/**
 * `project` からステージ描画・グリッド・花道・変形舞台などの派生値だけをまとめる。
 * インタラクション state は含めない（コントローラー側の専用フックで段階的に拡張）。
 */
export function useStageBoardProjectDerived(project: ChoreographyProjectJson) {
  const {
    formations,
    activeFormationId,
    snapGrid,
    gridStep: rawGridStep,
    gridSpacingMm,
    audienceEdge,
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
    centerFieldGuideIntervalMm,
    viewMode,
    dancerMarkerDiameterPx,
    dancerMarkerDiameterMm,
    dancerLabelPosition: rawDancerLabelPosition,
    hanamichiEnabled: hanamichiEnabledRaw,
    hanamichiDepthPct: hanamichiDepthRaw,
  } = project;
  const stageGridLinesVertical =
    project.stageGridLinesVerticalEnabled ??
    project.stageGridLinesEnabled ??
    false;
  const stageGridLinesHorizontal =
    project.stageGridLinesHorizontalEnabled ??
    project.stageGridLinesEnabled ??
    false;
  const dancerLabelBelow = rawDancerLabelPosition === "below";
  const gridStep = useMemo(
    () => computeEffectiveGridStepPct(gridSpacingMm, stageWidthMm, rawGridStep),
    [gridSpacingMm, stageWidthMm, rawGridStep]
  );
  const hanamichiEnabled = hanamichiEnabledRaw ?? false;
  const hanamichiDepthPct = clampHanamichiDepthPct(hanamichiDepthRaw);
  const stageShape = project.stageShape;
  const stageShapeActive = isCustomStageShapeActive(stageShape);
  const stageShapeSvgPoints = useMemo(
    () =>
      stageShapeActive && stageShape
        ? stageShapePolygonToSvgPoints(stageShape.polygonPct)
        : "",
    [stageShapeActive, stageShape]
  );
  const stageShapeMaskPath = useMemo(() => {
    if (!stageShapeActive || !stageShape) return "";
    return stageShapePolygonToMaskPath(stageShape.polygonPct);
  }, [stageShapeActive, stageShape]);

  return {
    formations,
    activeFormationId,
    snapGrid,
    gridSpacingMm,
    audienceEdge,
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
    centerFieldGuideIntervalMm,
    viewMode,
    dancerMarkerDiameterPx,
    dancerMarkerDiameterMm,
    stageGridLinesVertical,
    stageGridLinesHorizontal,
    dancerLabelBelow,
    gridStep,
    hanamichiEnabled,
    hanamichiDepthPct,
    stageShape,
    stageShapeActive,
    stageShapeSvgPoints,
    stageShapeMaskPath,
  };
}
