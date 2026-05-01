export type StageGuideMark = { xp: number; k: number };

export type StageGuideAndAlignLinesProps = {
  verticalGuideMarks: readonly StageGuideMark[];
  alignX: number | null;
  alignY: number | null;
};

/**
 * viewBox 0–100 の SVG 内用。センター基準の縦ガイド線と、ドラッグスナップ補助線。
 */
export function StageGuideAndAlignLines({
  verticalGuideMarks,
  alignX,
  alignY,
}: StageGuideAndAlignLinesProps) {
  return (
    <>
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
    </>
  );
}
