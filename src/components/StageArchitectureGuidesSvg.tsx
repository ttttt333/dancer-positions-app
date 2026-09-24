import type { StageCenterMark } from "../types/choreography";
import type { StageGuideMark } from "./StageGuideAndAlignLines";

export type StageArchitectureGuidesSvgProps = {
  /** @deprecated centerMarks を使う */
  hesoVisible?: boolean;
  centerMarks?: readonly StageCenterMark[];
  verticalGuideMarks?: readonly StageGuideMark[];
  alignX?: number | null;
  alignY?: number | null;
};

function CenterMarkGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r="1.6"
        fill="none"
        stroke="rgba(248, 250, 252, 0.9)"
        strokeWidth="0.35"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={x}
        y1={y - 3.5}
        x2={x}
        y2={y + 3.5}
        stroke="rgba(248, 250, 252, 0.85)"
        strokeWidth="0.3"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={x - 3.5}
        y1={y}
        x2={x + 3.5}
        y2={y}
        stroke="rgba(248, 250, 252, 0.85)"
        strokeWidth="0.3"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/**
 * ヘソ・場ミリ縦ガイド・スナップ補助線。
 * 前からの横グリッドは StageMillimeterGridSvg（奥行間隔）に統合。
 * そで幕は StageSleeveCurtainOverlay でドラッグ可能に描画。
 * マーク本体は pointer-events:none（立ち位置編集を邪魔しない）。
 */
export function StageArchitectureGuidesSvg({
  hesoVisible = false,
  centerMarks,
  verticalGuideMarks = [],
  alignX = null,
  alignY = null,
}: StageArchitectureGuidesSvgProps) {
  const marks: readonly StageCenterMark[] =
    centerMarks && centerMarks.length > 0
      ? centerMarks
      : hesoVisible
        ? [{ id: "legacy-heso", xPct: 50, yPct: 50 }]
        : [];

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2,
      }}
      aria-hidden
    >
      {verticalGuideMarks.map(({ xp, k }, i) => (
        <line
          key={`gm-${i}-${k}-${xp}`}
          x1={xp}
          y1="0"
          x2={xp}
          y2="100"
          stroke="rgba(251, 191, 36, 0.72)"
          strokeWidth="0.4"
          strokeDasharray="1.6 1.6"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {marks.map((m) => (
        <CenterMarkGlyph key={m.id} x={m.xPct} y={m.yPct} />
      ))}
      {alignX != null && (
        <line
          x1={alignX}
          y1="0"
          x2={alignX}
          y2="100"
          stroke="#22d3ee"
          strokeWidth="0.5"
          strokeDasharray="2 1.2"
          vectorEffect="non-scaling-stroke"
          opacity={0.95}
        />
      )}
      {alignY != null && (
        <line
          x1="0"
          y1={alignY}
          x2="100"
          y2={alignY}
          stroke="#22d3ee"
          strokeWidth="0.5"
          strokeDasharray="2 1.2"
          vectorEffect="non-scaling-stroke"
          opacity={0.95}
        />
      )}
    </svg>
  );
}
