import type { RefObject } from "react";
import type { StageFloorStageMarkupOverlayProps } from "./StageFloorStageMarkupOverlay";
import { StageFloorStageMarkupOverlay } from "./StageFloorStageMarkupOverlay";
import { StageMillimeterGridSvg } from "./StageMillimeterGridSvg";
import { StageShapeMaskSvg } from "./StageShapeMaskSvg";
import type { StageGuideMark } from "./StageGuideAndAlignLines";
import type { StageCenterMark, StageLightFixture } from "../types/choreography";
import { StageArchitectureGuidesSvg } from "./StageArchitectureGuidesSvg";
import { StageLightingOverlay } from "./StageLightingOverlay";

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
  stageHesoVisible?: boolean;
  stageCenterMarks?: readonly StageCenterMark[];
  activeStageLights?: readonly StageLightFixture[];
  stageMainFloorRef?: RefObject<HTMLElement | null>;
} & StageFloorStageMarkupOverlayProps;

/**
 * メイン床の「下層」オーバーレイ: カスタム形状・寸法格子・ガイド線・照明・床線／テキスト。
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
  stageHesoVisible = false,
  stageCenterMarks = [],
  activeStageLights = [],
  stageMainFloorRef,
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
      <StageArchitectureGuidesSvg
        hesoVisible={stageHesoVisible && stageCenterMarks.length === 0}
        centerMarks={
          stageHesoVisible && stageCenterMarks.length > 0
            ? stageCenterMarks
            : undefined
        }
        verticalGuideMarks={guideLineDrawMarks}
        alignX={alignGuides.x}
        alignY={alignGuides.y}
      />
      {activeStageLights.length > 0 ? (
        <StageLightingOverlay
          lights={activeStageLights}
          floorRef={stageMainFloorRef}
        />
      ) : null}
      {showStageFloorMarkup ? (
        <StageFloorStageMarkupOverlay {...floorOverlay} />
      ) : null}
    </>
  );
}
