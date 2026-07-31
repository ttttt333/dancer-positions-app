import { useRef, type CSSProperties } from "react";
import { StageBoardFitViewport } from "./StageBoardFitViewport";
import {
  StageRotatedStageFrame,
  type StageRotatedStageFrameProps,
} from "./StageRotatedStageFrame";
import {
  StageExportRootColumn,
  type StageExportRootColumnProps,
} from "./StageExportRootColumn";
import { useStageBoardPinchViewport } from "../hooks/useStageBoardPinchViewport";
import { useFillStageFrameSize } from "../hooks/useFillStageFrameSize";

export type StageBoardStageFrameProps = Omit<
  StageRotatedStageFrameProps,
  "children" | "forcedSizePx"
> & {
  exportColumn: StageExportRootColumnProps;
  /** 閲覧: 客席帯が aspect 外に出る分のビューポート余白を確保 */
  compactViewportChrome?: boolean;
  /** 閲覧横画面: `compactViewportChrome` 時の帯余白をさらに詰める */
  compactLandscapeViewport?: boolean;
  /** スマホ: ピンチ拡大縮小（波形とは独立） */
  enablePinchViewport?: boolean;
};

/**
 * ステージ本体の視覚スタック: ビューポートフィット → 回転枠 → エクスポート列（床＋オーバーレイ）。
 */
export function StageBoardStageFrame({
  exportColumn,
  compactViewportChrome = false,
  compactLandscapeViewport = false,
  enablePinchViewport = false,
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

  const pinch = useStageBoardPinchViewport(enablePinchViewport);
  const fitMeasureRef = useRef<HTMLDivElement | null>(null);

  const fillSize = useFillStageFrameSize({
    enabled: compactLandscapeViewport,
    containerRef: fitMeasureRef,
    aspectWidth: rotatedFrame.hasStageDims ? rotatedFrame.outerWmm : 4,
    aspectDepth: rotatedFrame.hasStageDims ? rotatedFrame.outerDmm : 3,
    // 左レール分は CSS padding-left で測り領域から除外済み
    leftInsetPx: 0,
    topInsetPx: 2,
    bottomInsetPx: 2,
    rightInsetPx: 2,
  });

  const wrapperStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 0,
    minHeight: 0,
    flex: "1 1 0%",
    ...pinch.wrapperStyle,
  };

  /**
   * 客席帯は aspect 比の外（床下）に描くため、上下どちらに出るかに応じて
   * `cqb` を少しだけ削ってラベルが切れないようにする。
   * 横画面の実測フィット時は帯余白ゼロ（ラベルは重ね描き）。
   */
  const audienceBandPad = compactLandscapeViewport ? 0 : 42;
  const backstageBandPad = compactLandscapeViewport ? 0 : 28;

  let paddingTop: number | undefined;
  let paddingBottom: number | undefined;
  const useSymmetricEditorFit = !compactViewportChrome;
  if (useSymmetricEditorFit) {
    paddingTop = undefined;
    paddingBottom = undefined;
  } else if (!compactLandscapeViewport) {
    if (isAudienceTop) {
      paddingTop = audienceBandPad;
      paddingBottom = backstageBandPad;
    } else {
      paddingTop = backstageBandPad;
      paddingBottom = audienceBandPad;
    }
  }

  const forcedSizePx = fillSize
    ? { width: fillSize.widthPx, height: fillSize.heightPx }
    : null;

  const stageInner = (
    <div
      ref={pinch.wrapperRef}
      className="stage-board-stage-wrapper"
      style={wrapperStyle}
    >
      <StageRotatedStageFrame {...rotatedFrame} forcedSizePx={forcedSizePx}>
        <StageExportRootColumn {...exportColumn} />
      </StageRotatedStageFrame>
    </div>
  );

  return (
    <StageBoardFitViewport
      measureRef={fitMeasureRef}
      alignTop={false}
      paddingTop={paddingTop}
      paddingBottom={paddingBottom}
      className={
        compactLandscapeViewport
          ? "stage-board-fit-viewport--public-landscape"
          : undefined
      }
    >
      {enablePinchViewport ? (
        <div
          ref={pinch.clipRef}
          className="stage-board-pinch-clip"
          style={pinch.clipStyle}
          onPointerDownCapture={pinch.onPointerDownCapture}
          onPointerMoveCapture={pinch.onPointerMoveCapture}
          onPointerUpCapture={pinch.onPointerUpCapture}
          onPointerCancelCapture={pinch.onPointerCancelCapture}
        >
          {stageInner}
        </div>
      ) : (
        stageInner
      )}
    </StageBoardFitViewport>
  );
}
