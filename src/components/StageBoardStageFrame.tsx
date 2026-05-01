import { StageBoardFitViewport } from "./StageBoardFitViewport";
import {
  StageRotatedStageFrame,
  type StageRotatedStageFrameProps,
} from "./StageRotatedStageFrame";
import {
  StageExportRootColumn,
  type StageExportRootColumnProps,
} from "./StageExportRootColumn";

export type StageBoardStageFrameProps = Omit<
  StageRotatedStageFrameProps,
  "children"
> & {
  exportColumn: StageExportRootColumnProps;
};

/**
 * ステージ本体の視覚スタック: ビューポートフィット → 回転枠 → エクスポート列（床＋オーバーレイ）。
 */
export function StageBoardStageFrame({
  exportColumn,
  ...rotatedFrame
}: StageBoardStageFrameProps) {
  return (
    <StageBoardFitViewport>
      <StageRotatedStageFrame {...rotatedFrame}>
        <StageExportRootColumn {...exportColumn} />
      </StageRotatedStageFrame>
    </StageBoardFitViewport>
  );
}
