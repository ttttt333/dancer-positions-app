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
  /** 閲覧横画面など: 客席上のときの上下余白を小さくする */
  compactViewportChrome?: boolean;
};

/**
 * ステージ本体の視覚スタック: ビューポートフィット → 回転枠 → エクスポート列（床＋オーバーレイ）。
 */
export function StageBoardStageFrame({
  exportColumn,
  compactViewportChrome = false,
  ...rotatedFrame
}: StageBoardStageFrameProps) {
  /**
   * 客席＝画面上（rot=180°）のとき、ステージを 180° 回転すると
   * `StageAudienceFooterBand`（高さ最大 ~56px）が画面上側に飛び出す。
   * コンテナクエリの親（`StageBoardFitViewport`）に `paddingTop` を渡すことで
   * `cqb` が縮小され、ステージ枠が自動的に小さくなって帯が枠内に収まる。
   */
  const rotNorm = ((rotatedFrame.rotationDeg % 360) + 360) % 360;
  const isAudienceTop = rotNorm === 180;

  const wrapperStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 0,
    minHeight: 0,
    flex: "1 1 0%",
  };

  const audienceTopPad = compactViewportChrome ? 12 : 28;
  const audienceBottomPad = compactViewportChrome ? 8 : 20;

  return (
    <StageBoardFitViewport
      alignTop={isAudienceTop}
      paddingTop={isAudienceTop ? audienceTopPad : undefined}
      paddingBottom={isAudienceTop ? audienceBottomPad : undefined}
    >
      <div className="stage-board-stage-wrapper" style={wrapperStyle}>
        <StageRotatedStageFrame {...rotatedFrame}>
          <StageExportRootColumn {...exportColumn} />
        </StageRotatedStageFrame>
      </div>
    </StageBoardFitViewport>
  );
}
