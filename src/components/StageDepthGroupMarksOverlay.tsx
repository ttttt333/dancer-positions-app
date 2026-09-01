import type { CSSProperties } from "react";
import type { DepthGroupMarkOnStage } from "../lib/stageDepthPreview";

export type StageDepthGroupMarksOverlayProps = {
  marks: readonly DepthGroupMarkOnStage[];
  /** ステージ回転に対して番号を正立させる */
  rot: number;
  selectedA?: readonly number[];
  selectedB?: readonly number[];
  onSelectIndex?: (groupIndex: number) => void;
};

function markStyleFor(
  groupIndex: number,
  selectedA: readonly number[],
  selectedB: readonly number[]
): CSSProperties {
  const inA = selectedA.includes(groupIndex);
  const inB = selectedB.includes(groupIndex);
  return {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    padding: 0,
    borderRadius: "50%",
    border: inB
      ? "2px solid rgba(125, 211, 252, 0.95)"
      : "2px solid rgba(251, 191, 36, 0.95)",
    background: inA
      ? "rgba(251, 191, 36, 0.92)"
      : inB
        ? "rgba(14, 116, 144, 0.92)"
        : "rgba(8, 11, 18, 0.94)",
    color: inA ? "#14100a" : inB ? "#ecfeff" : "#fde68a",
    fontSize: 16,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: 0,
    lineHeight: 1,
    pointerEvents: "auto",
    userSelect: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.75)",
    zIndex: 14,
    cursor: "pointer",
  };
}

/**
 * 前後グループ番号。Unicode の ① は使わず、丸は CSS の一つだけ。
 */
export function StageDepthGroupMarksOverlay({
  marks,
  rot,
  selectedA = [],
  selectedB = [],
  onSelectIndex,
}: StageDepthGroupMarksOverlayProps) {
  if (marks.length === 0) return null;
  const upright = ((rot % 360) + 360) % 360;
  return (
    <div data-depth-group-marks aria-hidden={false} style={{ pointerEvents: "none" }}>
      {marks.map((m) => (
        <button
          key={`depth-mark-${m.dancerId}`}
          type="button"
          data-depth-group-mark={m.mark}
          data-rank-index={m.groupIndex}
          data-dancer-id={m.dancerId}
          aria-label={`${m.mark}列目`}
          aria-pressed={selectedA.includes(m.groupIndex) || selectedB.includes(m.groupIndex)}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectIndex?.(m.groupIndex);
          }}
          style={{
            ...markStyleFor(m.groupIndex, selectedA, selectedB),
            left: `${m.xPct}%`,
            top: `${m.yPct}%`,
            transform: `translate(-50%, -50%) rotate(${-upright}deg)`,
            pointerEvents: "auto",
          }}
        >
          {m.mark}
        </button>
      ))}
    </div>
  );
}
