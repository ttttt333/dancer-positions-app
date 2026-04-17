import type { DancerSpot } from "../types/choreography";

const VB_W = 100;
const VB_H = 60;

const PALETTE = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#2dd4bf",
  "#e879f9",
  "#f8fafc",
] as const;

type Props = {
  dancers: DancerSpot[];
  /** 幅（px）。高さは viewBox 比で自動 */
  width?: number;
  className?: string;
};

/**
 * フォーメーションの実座標（%）を縮図表示（上＝奥・下＝客席側に合わせる）。
 */
export function FormationShapeThumb({ dancers, width = 36, className }: Props) {
  const h = Math.round((width * VB_H) / VB_W);

  if (dancers.length === 0) {
    return (
      <svg
        className={className}
        width={width}
        height={h}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        aria-hidden
      >
        <rect
          x={4}
          y={4}
          width={VB_W - 8}
          height={VB_H - 8}
          rx={4}
          fill="#0f172a"
          stroke="#334155"
          strokeWidth={1}
        />
      </svg>
    );
  }

  const xs = dancers.map((d) => d.xPct);
  const ys = dancers.map((d) => d.yPct);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = Math.max(maxX - minX, 6);
  const rangeY = Math.max(maxY - minY, 6);
  const pad = 10;
  const mapX = (x: number) => pad + ((x - minX) / rangeX) * (VB_W - 2 * pad);
  const mapY = (y: number) => pad + ((y - minY) / rangeY) * (VB_H - 2 * pad);

  return (
    <svg
      className={className}
      width={width}
      height={h}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      aria-hidden
    >
      <rect
        x={2}
        y={2}
        width={VB_W - 4}
        height={VB_H - 4}
        rx={4}
        fill="#020617"
        stroke="#1e293b"
        strokeWidth={0.75}
      />
      {dancers.map((d) => (
        <circle
          key={d.id}
          cx={mapX(d.xPct)}
          cy={mapY(d.yPct)}
          r={3.1}
          fill={PALETTE[d.colorIndex % PALETTE.length]}
          stroke="rgba(15,23,42,0.65)"
          strokeWidth={0.45}
        />
      ))}
    </svg>
  );
}
