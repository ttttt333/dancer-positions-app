export type StageMarqueeOverlayProps = {
  startXPct: number;
  curXPct: number;
  startYPct: number;
  curYPct: number;
};

/** 範囲選択ドラッグ中の矩形オーバーレイ */
export function StageMarqueeOverlay({
  startXPct,
  curXPct,
  startYPct,
  curYPct,
}: StageMarqueeOverlayProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: `${Math.min(startXPct, curXPct)}%`,
        top: `${Math.min(startYPct, curYPct)}%`,
        width: `${Math.abs(curXPct - startXPct)}%`,
        height: `${Math.abs(curYPct - startYPct)}%`,
        border: "1px dashed rgba(129, 140, 248, 0.95)",
        background: "rgba(99, 102, 241, 0.12)",
        pointerEvents: "none",
        zIndex: 7,
        boxSizing: "border-box",
      }}
    />
  );
}
