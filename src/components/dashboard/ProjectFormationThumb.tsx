import type { CSSProperties } from "react";
import { modDancerColorIndex, DANCER_COLOR_PALETTE_HEX } from "../../lib/dancerColorPalette";
import type { ProjectThumbDancer } from "../../lib/projectListSummary";
import { shell } from "../../theme/choreoShell";

type Props = {
  dancers: ProjectThumbDancer[];
  size?: number;
  /** true のとき親幅いっぱいに伸ばし、aspect は viewBox に任せる */
  fluid?: boolean;
  style?: CSSProperties;
};

/** ダッシュボード一覧用のミニ舞台サムネ */
export function ProjectFormationThumb({
  dancers,
  size = 72,
  fluid = false,
  style,
}: Props) {
  const w = size;
  const h = Math.round(size * 0.72);
  const dotR = dancers.length > 24 ? 2.2 : dancers.length > 12 ? 2.8 : 3.2;

  return (
    <svg
      width={fluid ? undefined : w}
      height={fluid ? undefined : h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className={fluid ? "home-project-thumb" : undefined}
      style={{
        flexShrink: 0,
        borderRadius: 8,
        border: `1px solid ${shell.border}`,
        background: "rgba(0,0,0,0.35)",
        ...(fluid ? { width: "100%", height: "auto", display: "block" } : {}),
        ...style,
      }}
    >
      <rect
        x={1}
        y={1}
        width={w - 2}
        height={h - 2}
        rx={6}
        fill="rgba(15, 23, 42, 0.55)"
        stroke="rgba(148, 163, 184, 0.25)"
        strokeWidth={1}
      />
      {dancers.map((d, i) => {
        const cx = (d.xPct / 100) * w;
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
