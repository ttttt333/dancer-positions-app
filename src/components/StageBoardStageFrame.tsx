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
  /**
   * 客席＝画面上（rot=180°）のとき、ステージが上端からはみ出さないよう上部に余白を確保する。
   * - ステージを 180° 回転すると `StageAudienceFooterBand`（高さ最大 44px）が画面上側に飛び出す。
   * - `paddingTop` でコンテナの上端からステージ枠を押し下げることで帯分のスペースを作る。
   * - `translateY` による下シフトは逆側（下）がはみ出す原因になるため廃止。
   */
  const rotNorm = ((rotatedFrame.rotationDeg % 360) + 360) % 360;
  const wrapperStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 0,
    minHeight: 0,
    flex: "1 1 0%",
    ...(rotNorm === 180 ? { paddingTop: 44 } : {}),
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
