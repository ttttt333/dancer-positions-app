import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  StageResizeHandles,
  type StageResizeHandleId,
} from "./StageResizeHandles";

export type StageRotatedStageFrameProps = {
  hasStageDims: boolean;
  outerWmm: number;
  outerDmm: number;
  stageAspectRatio: string;
  rotationDeg: number;
  children: ReactNode;
  showResizeHandles: boolean;
  hoveredHandle: StageResizeHandleId | null;
  resizeDraftActive: boolean;
  /** Galaxy 等の CQ 崩れ回避: 実測 px でフィット */
  forcedSizePx?: { width: number; height: number } | null;
  /**
   * 実測前のフォールバック。cqi/cqb の代わりに % + aspect-ratio で contain する。
   * （実測が有効な端末で初回極小フラッシュを防ぐ）
   */
  preferPercentFit?: boolean;
  onResizePointerDown: (
    handle: StageResizeHandleId,
    e: ReactPointerEvent<HTMLDivElement>
  ) => void;
  onHandlePointerEnter: (handle: StageResizeHandleId) => void;
  onHandlePointerLeave: (handle: StageResizeHandleId) => void;
};

const frameStyle = ({
  hasStageDims,
  outerWmm,
  outerDmm,
  stageAspectRatio,
  rotationDeg,
  forcedSizePx,
  preferPercentFit = false,
}: Pick<
  StageRotatedStageFrameProps,
  | "hasStageDims"
  | "outerWmm"
  | "outerDmm"
  | "stageAspectRatio"
  | "rotationDeg"
  | "forcedSizePx"
  | "preferPercentFit"
>): CSSProperties => {
  const forced =
    forcedSizePx && forcedSizePx.width > 0 && forcedSizePx.height > 0
      ? forcedSizePx
      : null;
  const cqWidth = hasStageDims
    ? `min(100cqi, calc(100cqb * (${outerWmm}) / (${outerDmm})))`
    : "min(100cqi, calc(100cqb * 4 / 3))";
  return {
    flexShrink: preferPercentFit && !forced ? 1 : 0,
    position: "relative",
    width: forced
      ? `${forced.width}px`
      : preferPercentFit
        ? "100%"
        : cqWidth,
    height: forced ? `${forced.height}px` : preferPercentFit ? "auto" : undefined,
    maxWidth: "100%",
    maxHeight: "100%",
    aspectRatio: forced ? undefined : stageAspectRatio,
    boxSizing: "border-box",
    transform: `rotate(${rotationDeg}deg)`,
    transformOrigin: "center center",
    transition: forced ? undefined : "transform 0.2s ease",
    containerType: "size",
    containerName: "stage-frame",
  };
};

export function StageRotatedStageFrame({
  hasStageDims,
  outerWmm,
  outerDmm,
  stageAspectRatio,
  rotationDeg,
  children,
  showResizeHandles,
  hoveredHandle,
  resizeDraftActive,
  forcedSizePx = null,
  preferPercentFit = false,
  onResizePointerDown,
  onHandlePointerEnter,
  onHandlePointerLeave,
}: StageRotatedStageFrameProps) {
  return (
    <div
      style={frameStyle({
        hasStageDims,
        outerWmm,
        outerDmm,
        stageAspectRatio,
        rotationDeg,
        forcedSizePx,
        preferPercentFit,
      })}
    >
      {children}
      {showResizeHandles ? (
        <StageResizeHandles
          hoveredHandle={hoveredHandle}
          resizeDraftActive={resizeDraftActive}
          onResizePointerDown={onResizePointerDown}
          onHandlePointerEnter={onHandlePointerEnter}
          onHandlePointerLeave={onHandlePointerLeave}
        />
      ) : null}
    </div>
  );
}
