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
  /** 生徒共有横画面など: CQ の代わりに実測 px でフィット */
  forcedSizePx?: { width: number; height: number } | null;
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
}: Pick<
  StageRotatedStageFrameProps,
  | "hasStageDims"
  | "outerWmm"
  | "outerDmm"
  | "stageAspectRatio"
  | "rotationDeg"
  | "forcedSizePx"
>): CSSProperties => {
  const forced =
    forcedSizePx && forcedSizePx.width > 0 && forcedSizePx.height > 0
      ? forcedSizePx
      : null;
  return {
    flexShrink: 0,
    position: "relative",
    width: forced
      ? `${forced.width}px`
      : hasStageDims
        ? `min(100cqi, calc(100cqb * (${outerWmm}) / (${outerDmm})))`
        : "min(100cqi, calc(100cqb * 4 / 3))",
    height: forced ? `${forced.height}px` : undefined,
    maxWidth: "100%",
    maxHeight: "100%",
    aspectRatio: forced ? undefined : stageAspectRatio,
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
