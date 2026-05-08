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
}: Pick<
  StageRotatedStageFrameProps,
  "hasStageDims" | "outerWmm" | "outerDmm" | "stageAspectRatio" | "rotationDeg"
>): CSSProperties => ({
  flexShrink: 0,
  position: "relative",
  width: hasStageDims
    ? `min(100cqi, calc(100cqb * (${outerWmm}) / (${outerDmm})))`
    : "min(100cqi, calc(100cqb * 4 / 3))",
  maxWidth: "100%",
  maxHeight: "100%",
  aspectRatio: stageAspectRatio,
  transform: `rotate(${rotationDeg}deg)`,
  transformOrigin: "center center",
  transition: "transform 0.2s ease",
});

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
