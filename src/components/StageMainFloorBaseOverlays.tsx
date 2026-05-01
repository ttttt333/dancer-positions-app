import type { StageFloorStageMarkupOverlayProps } from "./StageFloorStageMarkupOverlay";
import { StageFloorStageMarkupOverlay } from "./StageFloorStageMarkupOverlay";
import { StageGuideAndAlignLines } from "./StageGuideAndAlignLines";
import { StageMillimeterGridSvg } from "./StageMillimeterGridSvg";
import { StageShapeMaskSvg } from "./StageShapeMaskSvg";
import type { StageGuideMark } from "./StageGuideAndAlignLines";

export type StageMainFloorBaseOverlaysProps = {
  stageShapeActive: boolean;
  stageShapeMaskPath: string;
  stageShapeSvgPoints: string;
  hasStageDims: boolean;
  showStageMmGridOverlay: boolean;
  mmSnapGrid: { stepXPct: number; stepYPct: number } | null;
  stageGridLinesVertical: boolean;
  stageGridLinesHorizontal: boolean;
  guideLineDrawMarks: readonly StageGuideMark[];
  alignGuides: { x: number | null; y: number | null };
  showStageFloorMarkup: boolean;
} & StageFloorStageMarkupOverlayProps;

/**
 * メイン床の「下層」オーバーレイ: カスタム形状・寸法格子・ガイド線・床線／テキスト。
 * 大道具・ダンサー印より下に置く想定で親から順に並べる。
 */
export function StageMainFloorBaseOverlays({
  stageShapeActive,
  stageShapeMaskPath,
  stageShapeSvgPoints,
  hasStageDims,
  showStageMmGridOverlay,
  mmSnapGrid,
  stageGridLinesVertical,
  stageGridLinesHorizontal,
  guideLineDrawMarks,
  alignGuides,
  showStageFloorMarkup,
  ...floorOverlay
}: StageMainFloorBaseOverlaysProps) {
  return (
    <>
      {stageShapeActive && stageShapeMaskPath ? (
        <StageShapeMaskSvg
          maskPath={stageShapeMaskPath}
          polygonPoints={stageShapeSvgPoints}
        />
      ) : null}
      {hasStageDims ? (
        <StageMillimeterGridSvg
          opacity={showStageMmGridOverlay ? 0.52 : 1}
          showFineGrid={showStageMmGridOverlay}
          mmSnapGrid={mmSnapGrid}
          stageGridLinesVertical={stageGridLinesVertical}
          stageGridLinesHorizontal={stageGridLinesHorizontal}
        />
      ) : null}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 2,
        }}
        aria-hidden
      >
        <StageGuideAndAlignLines
          verticalGuideMarks={guideLineDrawMarks}
          alignX={alignGuides.x}
          alignY={alignGuides.y}
        />
      </svg>
      {showStageFloorMarkup ? (
        <StageFloorStageMarkupOverlay {...floorOverlay} />
      ) : null}
    </>
  );
}
