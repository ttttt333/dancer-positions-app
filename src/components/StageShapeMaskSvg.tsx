export type StageShapeMaskSvgProps = {
  maskPath: string;
  polygonPoints: string;
};

/** カスタム舞台形: 外側を暗くし、舞台輪郭をハイライト */
export function StageShapeMaskSvg({
  maskPath,
  polygonPoints,
}: StageShapeMaskSvgProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <path
        d={maskPath}
        fill="rgba(2, 6, 23, 0.55)"
        fillRule="evenodd"
      />
      <polygon
        points={polygonPoints}
        fill="none"
        stroke="rgba(94, 234, 212, 0.85)"
        strokeWidth="0.45"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
