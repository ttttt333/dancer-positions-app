import type { CSSProperties } from "react";
import type { DepthGroupMarkOnStage } from "../lib/stageDepthPreview";

export type StageDepthGroupMarksOverlayProps = {
  marks: readonly DepthGroupMarkOnStage[];
  /** ステージ回転に対して番号を正立させる */
  rot: number;
};

const markStyle: CSSProperties = {
  position: "absolute",
  transform: "translate(-50%, -50%)",
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(226, 232, 240, 0.42)",
  letterSpacing: "0.02em",
  lineHeight: 1,
  pointerEvents: "none",
  userSelect: "none",
  textShadow: "0 1px 2px rgba(0,0,0,0.55)",
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
