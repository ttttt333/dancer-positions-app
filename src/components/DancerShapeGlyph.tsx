import type { SVGProps } from "react";
import {
  DANCER_MARKER_SHAPE_POINTS,
  normalizeDancerMarkerShape,
} from "../lib/dancerMarkerShape";

type Props = {
  cx: number;
  cy: number;
  /** 丸のときの半径。他の形も同じ外接サイズに収める */
  r: number;
  shape?: unknown;
  facingDeg?: number;
} & Pick<
  SVGProps<SVGElement>,
  "fill" | "fillOpacity" | "stroke" | "strokeWidth"
>;

/** サムネイル用のダンサー印 1 個（丸・四角・ダイヤ・星・三角・矢印） */
export function DancerShapeGlyph({
  cx,
  cy,
  r,
  shape,
  facingDeg,
  fill,
  fillOpacity,
  stroke,
  strokeWidth,
}: Props) {
  const s = normalizeDancerMarkerShape(shape);
  const rot =
    typeof facingDeg === "number" && Number.isFinite(facingDeg) && facingDeg !== 0
      ? facingDeg
      : 0;
  if (!s) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  const k = (2 * r) / 100;
  const sw =
    typeof strokeWidth === "number" ? strokeWidth / k : strokeWidth;
  return (
    <polygon
      points={DANCER_MARKER_SHAPE_POINTS[s]}
      transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${k}) translate(-50 -50)`}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinejoin="round"
    />
  );
}
