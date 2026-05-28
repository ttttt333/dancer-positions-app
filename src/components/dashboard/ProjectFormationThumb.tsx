import type { CSSProperties } from "react";
import { modDancerColorIndex, DANCER_COLOR_PALETTE_HEX } from "../../lib/dancerColorPalette";
import type { ProjectThumbDancer } from "../../lib/projectListSummary";
import { shell } from "../../theme/choreoShell";

type Props = {
  dancers: ProjectThumbDancer[];
  size?: number;
  style?: CSSProperties;
};

/** ダッシュボード一覧用のミニ舞台サムネ */
export function ProjectFormationThumb({ dancers, size = 72, style }: Props) {
  const h = Math.round(size * 0.72);
  const dotR = dancers.length > 24 ? 2.2 : dancers.length > 12 ? 2.8 : 3.2;

  return (
    <svg
      width={size}
      height={h}
      viewBox={`0 0 ${size} ${h}`}
      aria-hidden
      style={{
        flexShrink: 0,
        borderRadius: 8,
        border: `1px solid ${shell.border}`,
        background: "rgba(0,0,0,0.35)",
        ...style,
      }}
    >
      <rect
        x={1}
        y={1}
        width={size - 2}
        height={h - 2}
        rx={6}
        fill="rgba(15, 23, 42, 0.55)"
        stroke="rgba(148, 163, 184, 0.25)"
        strokeWidth={1}
      />
      {dancers.map((d, i) => {
        const cx = (d.xPct / 100) * size;
        const cy = (d.yPct / 100) * h;
        const fill = DANCER_COLOR_PALETTE_HEX[modDancerColorIndex(d.colorIndex)];
        return (
          <circle
            key={`${d.xPct}-${d.yPct}-${i}`}
            cx={cx}
            cy={cy}
            r={dotR}
            fill={fill}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={0.6}
          />
        );
      })}
    </svg>
  );
}
