/**
 * @file `StageExportRootColumn` 用 props の純関数。プレビュー帯・人数・回転・花道・床ブロック（`mainFloor`）を列に束ねる。
 */
import type { DancerSpot } from "../types/choreography";
import type { StageExportRootColumnProps } from "../components/StageExportRootColumn";
import type { StageShellWithMainFloorProps } from "../components/StageShellWithMainFloor";

/** @see モジュール先頭 `@file` */
export function buildStageExportRootColumnProps(input: {
  previewDancers: readonly DancerSpot[] | null | undefined;
  displayDancers: readonly DancerSpot[];
  stageRotationDeg: number;
  hanamichiEnabled: boolean;
  stageShapeActive: boolean;
  hanamichiDepthPct: number;
  mainFloor: StageShellWithMainFloorProps;
}): StageExportRootColumnProps {
  return {
    previewFormationHighlight: Boolean(input.previewDancers?.length),
    dancerCount: input.displayDancers.length,
    stageRotationDeg: input.stageRotationDeg,
    hanamichiEnabled: input.hanamichiEnabled,
    stageShapeActive: input.stageShapeActive,
    hanamichiDepthPct: input.hanamichiDepthPct,
    mainFloor: input.mainFloor,
  };
}
