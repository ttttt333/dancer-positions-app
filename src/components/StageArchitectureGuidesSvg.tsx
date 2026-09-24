import type { StageDepthGuideMark } from "../lib/stageArchitectureGuides";
import type { StageGuideMark } from "./StageGuideAndAlignLines";

export type StageArchitectureGuidesSvgProps = {
  hesoVisible?: boolean;
  frontGridMarks?: readonly StageDepthGuideMark[];
  sleeveMarks?: readonly StageDepthGuideMark[];
  verticalGuideMarks?: readonly StageGuideMark[];
  alignX?: number | null;
  alignY?: number | null;
};

/**
 * ヘソ・前からの横グリッド・そで幕・場ミリ縦ガイド・スナップ補助線。
 */
export function StageArchitectureGuidesSvg({
  hesoVisible = false,
  frontGridMarks = [],
  sleeveMarks = [],
  verticalGuideMarks = [],
  alignX = null,
  alignY = null,
}: StageArchitectureGuidesSvgProps) {
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
      {frontGridMarks.map((m) => (
        <g key={m.id}>
          <line
            x1="0"
            y1={m.yPct}
            x2="100"
            y2={m.yPct}
            stroke="rgba(148, 163, 184, 0.55)"
            strokeWidth="0.35"
            strokeDasharray="1.2 1.4"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      {sleeveMarks.map((m) => (
        <g key={m.id}>
          {/* 下手袖 */}
          <rect
            x="0"
            y={m.yPct - 1.2}
            width="4.5"
            height="2.4"
            fill="rgba(251, 113, 133, 0.35)"
            stroke="rgba(251, 113, 133, 0.85)"
            strokeWidth="0.25"
            vectorEffect="non-scaling-stroke"
          />
          {/* 上手袖 */}
          <rect
            x="95.5"
            y={m.yPct - 1.2}
            width="4.5"
            height="2.4"
            fill="rgba(251, 113, 133, 0.35)"
            stroke="rgba(251, 113, 133, 0.85)"
            strokeWidth="0.25"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1={m.yPct}
            x2="100"
            y2={m.yPct}
            stroke="rgba(251, 113, 133, 0.35)"
            strokeWidth="0.2"
            strokeDasharray="0.8 1.6"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
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
      {hesoVisible ? (
        <g>
          <circle
            cx="50"
            cy="50"
            r="1.6"
            fill="none"
            stroke="rgba(248, 250, 252, 0.9)"
            strokeWidth="0.35"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="50"
            y1="46.5"
            x2="50"
            y2="53.5"
            stroke="rgba(248, 250, 252, 0.85)"
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="46.5"
            y1="50"
            x2="53.5"
            y2="50"
            stroke="rgba(248, 250, 252, 0.85)"
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : null}
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
