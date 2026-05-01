export type StageGroupRotateGuideBadgeProps = {
  centerXPct: number;
  centerYPct: number;
  deltaDeg: number;
};

/** 群回転ドラッグ中に枠中央上へ表示する角度バッジ */
export function StageGroupRotateGuideBadge({
  centerXPct,
  centerYPct,
  deltaDeg,
}: StageGroupRotateGuideBadgeProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: `${centerXPct}%`,
        top: `${centerYPct}%`,
        transform: "translate(-50%, calc(-50% - 18px))",
        padding: "3px 8px",
        borderRadius: "6px",
        border: "1px solid rgba(51, 65, 85, 0.95)",
        background: "rgba(15, 23, 42, 0.92)",
        color: "#e2e8f0",
        fontSize: "11px",
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        pointerEvents: "none",
        zIndex: 9,
        whiteSpace: "nowrap",
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
      }}
    >
      {Math.round(deltaDeg)}°
    </div>
  );
}
