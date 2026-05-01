import type { CSSProperties } from "react";

export type StageDancerCountBadgeProps = {
  count: number;
  /** ステージ全体の回転（deg）。バッジは画面に対して読みやすい向きに逆回転する */
  stageRotationDeg: number;
};

const badgeStyle = (stageRotationDeg: number): CSSProperties => ({
  position: "absolute",
  top: 8,
  right: 8,
  zIndex: 35,
  pointerEvents: "none",
  transform: `rotate(${-stageRotationDeg}deg)`,
  transformOrigin: "top right",
  padding: "4px 9px",
  borderRadius: "8px",
  border: "1px solid rgba(51, 65, 85, 0.95)",
  background: "rgba(15, 23, 42, 0.88)",
  color: "#e2e8f0",
  fontSize: "12px",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.2,
  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
});

export function StageDancerCountBadge({
  count,
  stageRotationDeg,
}: StageDancerCountBadgeProps) {
  return (
    <div
      aria-live="polite"
      aria-label={`ステージ上 ${count} 人`}
      title="いまステージに表示している人数"
      style={badgeStyle(stageRotationDeg)}
    >
      {count}人
    </div>
  );
}
