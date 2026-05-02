import type { CSSProperties } from "react";
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
  /** 客席＝画面上（180°）のとき、回転後に下側の「舞台裏」帯が欠けないようわずかに上へ */
  const rotNorm = ((rotatedFrame.rotationDeg % 360) + 360) % 360;
  const wrapperStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 0,
    minHeight: 0,
    flex: "1 1 0%",
    ...(rotNorm === 180 ? { transform: "translateY(-5mm)" } : {}),
  };

  return (
    <StageBoardFitViewport>
      <div style={wrapperStyle}>
        <StageRotatedStageFrame {...rotatedFrame}>
          <StageExportRootColumn {...exportColumn} />
        </StageRotatedStageFrame>
      </div>
    </StageBoardFitViewport>
  );
}
