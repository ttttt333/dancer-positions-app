import type { CSSProperties } from "react";
import { StageDancerCountBadge } from "./StageDancerCountBadge";
import { StageHanamichiStrip } from "./StageHanamichiStrip";
import {
  StageShellWithMainFloor,
  type StageShellWithMainFloorProps,
} from "./StageShellWithMainFloor";

export type StageExportRootColumnProps = {
  previewFormationHighlight: boolean;
  dancerCount: number;
  stageRotationDeg: number;
  hanamichiEnabled: boolean;
  stageShapeActive: boolean;
  hanamichiDepthPct: number;
  mainFloor: StageShellWithMainFloorProps;
};

const exportRootStyle = (
  previewFormationHighlight: boolean
): CSSProperties => ({
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "visible",
  touchAction: "none",
  boxShadow: previewFormationHighlight
    ? "0 0 0 2px rgba(167,139,250,0.65), 0 12px 40px rgba(0,0,0,0.35)"
    : undefined,
  display: "flex",
  flexDirection: "column",
});

export function StageExportRootColumn({
  previewFormationHighlight,
  dancerCount,
  stageRotationDeg,
  hanamichiEnabled,
  stageShapeActive,
  hanamichiDepthPct,
  mainFloor,
}: StageExportRootColumnProps) {
  return (
    <div
      id="stage-export-root"
      style={exportRootStyle(previewFormationHighlight)}
    >
      <StageDancerCountBadge
        count={dancerCount}
        stageRotationDeg={stageRotationDeg}
      />
      <StageShellWithMainFloor {...mainFloor} />
      {hanamichiEnabled && !stageShapeActive ? (
        <StageHanamichiStrip depthPct={hanamichiDepthPct} />
      ) : null}
    </div>
  );
}
