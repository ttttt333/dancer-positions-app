import {
  DANCER_COLOR_PALETTE_HEX,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import type { FlowFormationSnapshot } from "../lib/flowLibrary";

type Props = {
  formation: FlowFormationSnapshot | null;
  /** 幅（px）。高さは viewBox 比で自動 */
  width?: number;
  className?: string;
};

/** ステージ俯瞰（上＝奥、下＝客席帯） */
const VB = "0 0 100 60";

function clampStagePct(v: number): number {
  return Math.min(100, Math.max(0, v));
}

/**
 * フローライブラリ行の右側：先頭キューの立ち位置ミニプレビュー。
 */
export function FlowLibraryFormationPreview({
  formation,
  width = 72,
  className,
}: Props) {
  const h = Math.round((width * 60) / 100);
  const dancers = formation?.dancers ?? [];
  const r =
    dancers.length > 24 ? 2 : dancers.length > 14 ? 2.4 : dancers.length > 8 ? 2.8 : 3.2;

  return (
    <svg
      className={className}
      viewBox={VB}
      width={width}
      height={h}
      aria-hidden
      style={{
        flexShrink: 0,
        display: "block",
        borderRadius: "6px",
        border: "1px solid #1e293b",
        background: "#0f172a",
      }}
    >
      <rect
        x="0"
        y="48"
        width="100"
        height="12"
        fill="#334155"
        fillOpacity={0.55}
        rx="1"
      />
      {dancers.map((d, i) => {
        const colorIdx = modDancerColorIndex(
          typeof d.colorIndex === "number" && Number.isFinite(d.colorIndex)
            ? Math.floor(d.colorIndex)
            : i
        );
        return (
          <circle
            key={`${d.label}-${i}`}
            cx={clampStagePct(d.xPct)}
            cy={8 + (clampStagePct(d.yPct) / 100) * 38}
            r={r}
            fill={DANCER_COLOR_PALETTE_HEX[colorIdx]}
            stroke="#0f172a"
            strokeWidth={0.6}
          />
        );
      })}
    </svg>
  );
}
