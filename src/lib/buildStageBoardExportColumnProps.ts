/**
 * @file `StageBoardBody` の export 列組み立て入口。`buildStageBoardMainFloor` → `buildStageExportRootColumnProps` を直列実行する純関数。
 */
import type { DancerSpot } from "../types/choreography";
import type { StageExportRootColumnProps } from "../components/StageExportRootColumn";
import {
  buildStageBoardMainFloor,
  type BuildStageBoardMainFloorParams,
} from "./buildStageBoardMainFloor";
import { buildStageExportRootColumnProps } from "./buildStageExportRootColumn";

/** メイン床の束 + エクスポート列メタ（プレビュー・人数・花道） */
export type BuildStageBoardExportColumnInput = BuildStageBoardMainFloorParams & {
  previewDancers: readonly DancerSpot[] | null | undefined;
  displayDancers: readonly DancerSpot[];
  stageRotationDeg: number;
  hanamichiEnabled: boolean;
  stageShapeActive: boolean;
  hanamichiDepthPct: number;
};

/**
 * `StageExportRootColumn` 用 props を一括組み立て（床ブロック → 列メタ）。
 */
export function buildStageBoardExportColumnProps(
  input: BuildStageBoardExportColumnInput
): StageExportRootColumnProps {
  const {
    previewDancers,
    displayDancers,
    stageRotationDeg,
    hanamichiEnabled,
    stageShapeActive,
    hanamichiDepthPct,
    ...mainFloorParams
  } = input;

  const mainFloor = buildStageBoardMainFloor(mainFloorParams);

  return buildStageExportRootColumnProps({
    previewDancers,
    displayDancers,
    stageRotationDeg,
    hanamichiEnabled,
    stageShapeActive,
    hanamichiDepthPct,
    mainFloor,
  });
}
