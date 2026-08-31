import type { CSSProperties } from "react";
import type { DepthGroupMarkOnStage } from "../lib/stageDepthPreview";

export type StageDepthGroupMarksOverlayProps = {
  marks: readonly DepthGroupMarkOnStage[];
  /** ステージ回転に対して番号を正立させる */
  rot: number;
};

const markStyle: CSSProperties = {
  position: "absolute",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 36,
  height: 36,
  padding: "0 7px",
  borderRadius: 999,
  border: "2px solid rgba(251, 191, 36, 0.95)",
  background: "rgba(8, 11, 18, 0.94)",
  color: "#fde68a",
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "0.02em",
  lineHeight: 1,
  pointerEvents: "none",
  userSelect: "none",
  boxShadow: "0 2px 8px rgba(0,0,0,0.75)",
  zIndex: 14,
};

/**
 * 前後グループ番号。人の ID ではなく、判定時点のグループに付く。
 * Preview 中も同じ人に同じ番号が付いたまま移動して見える。
 */
export function StageDepthGroupMarksOverlay({
  marks,
  rot,
}: StageDepthGroupMarksOverlayProps) {
  if (marks.length === 0) return null;
  const upright = ((rot % 360) + 360) % 360;
  return (
    <div data-depth-group-marks aria-hidden style={{ pointerEvents: "none" }}>
      {marks.map((m) => (
        <span
          key={`depth-mark-${m.dancerId}`}
          data-depth-group-mark={m.mark}
          data-dancer-id={m.dancerId}
          style={{
            ...markStyle,
            left: `${m.xPct}%`,
            top: `${m.yPct}%`,
            transform: `translate(-50%, -50%) rotate(${-upright}deg)`,
          }}
        >
          {m.mark}
        </span>
      ))}
    </div>
  );
}
