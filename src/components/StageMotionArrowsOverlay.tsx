/**
 * StageMotionArrowsOverlay
 * 現在配置 → 次キュー配置への移動軌跡（破線＋終点ドット）。
 * ダンサー印の上に被せる想定で position: absolute / inset: 0 / pointerEvents: none。
 */
import type { CSSProperties } from "react";
import type { DancerSpot, Formation } from "../types/choreography";

interface Props {
  /** 全フォーメーション（from/to 未指定時のフォールバック） */
  formations?: Formation[];
  /** 現在表示中のフォーメーション ID（フォールバック用） */
  activeFormationId?: string | null;
  /** 明示的な始点（再生中は補間後の座標を渡すと軌跡が縮む） */
  fromDancers?: DancerSpot[] | null;
  /** 次キューの終点 */
  toDancers?: DancerSpot[] | null;
  /** 選択中ダンサー（これらは常時表示） */
  selectedDancerIds?: string[];
  /**
   * true: 全員の軌跡を表示。
   * false: 選択中のみ（selected が空なら何も出さない）。
   */
  showAll?: boolean;
  /** 矢印色の透明度（0〜1） */
  opacity?: number;
  /** ハイライトする crewMemberId（個人閲覧モードで1人だけ目立たせるとき） */
  highlightCrewMemberId?: string | null;
}

function findById(dancers: DancerSpot[], id: string): DancerSpot | undefined {
  return dancers.find((d) => d.id === id);
}

const DANCER_COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#e879f9",
  "#94a3b8",
  "#fbbf24",
  "#86efac",
  "#7dd3fc",
  "#c4b5fd",
  "#f9a8d4",
];

export function StageMotionArrowsOverlay({
  formations = [],
  activeFormationId = null,
  fromDancers = null,
  toDancers = null,
  selectedDancerIds = [],
  showAll = false,
  opacity = 0.78,
  highlightCrewMemberId = null,
}: Props) {
  let from: DancerSpot[] | null = fromDancers;
  let to: DancerSpot[] | null = toDancers;

  if ((!from || !to) && activeFormationId && formations.length >= 2) {
    const currentIdx = formations.findIndex((f) => f.id === activeFormationId);
    if (currentIdx >= 0 && currentIdx < formations.length - 1) {
      from = from ?? formations[currentIdx]!.dancers;
      to = to ?? formations[currentIdx + 1]!.dancers;
    }
  }

  if (!from || !to || from.length === 0 || to.length === 0) return null;

  const selected = new Set(selectedDancerIds);
  if (!showAll && selected.size === 0) return null;

  type Arrow = {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    isHighlight: boolean;
    isSelected: boolean;
  };

  const arrows: Arrow[] = [];

  for (const fromSpot of from) {
    const toSpot = findById(to, fromSpot.id);
    if (!toSpot) continue;

    const isSelected = selected.has(fromSpot.id);
    if (!showAll && !isSelected) continue;

    const dist = Math.hypot(
      fromSpot.xPct - toSpot.xPct,
      fromSpot.yPct - toSpot.yPct
    );
    if (dist < 1.2) continue;

    const isHighlight =
      highlightCrewMemberId != null &&
      (fromSpot.crewMemberId === highlightCrewMemberId ||
        fromSpot.id === highlightCrewMemberId);

    const color =
      DANCER_COLORS[fromSpot.colorIndex % DANCER_COLORS.length] ?? "#94a3b8";

    arrows.push({
      id: fromSpot.id,
      x1: fromSpot.xPct,
      y1: fromSpot.yPct,
      x2: toSpot.xPct,
      y2: toSpot.yPct,
      color,
      isHighlight,
      isSelected,
    });
  }

  if (arrows.length === 0) return null;

  const svgStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
    zIndex: 6,
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={svgStyle}
      aria-hidden="true"
      data-trajectory-overlay
    >
      {arrows.map((a) => {
        const dimmed =
          highlightCrewMemberId != null && !a.isHighlight && !a.isSelected;
        const strokeOpacity = dimmed ? 0.2 : a.isSelected ? 0.95 : opacity;
        const strokeWidth = a.isSelected || a.isHighlight ? 0.85 : 0.55;

        return (
          <g key={a.id}>
            <line
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke={a.color}
              strokeWidth={strokeWidth}
              strokeOpacity={strokeOpacity}
              strokeDasharray="1.8 1.4"
              strokeLinecap="round"
            />
            {/* 終点ドット */}
            <circle
              cx={a.x2}
              cy={a.y2}
              r={a.isSelected ? 1.1 : 0.85}
              fill={a.color}
              fillOpacity={strokeOpacity}
              stroke="rgba(15,23,42,0.55)"
              strokeWidth={0.25}
            />
            {/* 始点の小さな印 */}
            <circle
              cx={a.x1}
              cy={a.y1}
              r={0.45}
              fill={a.color}
              fillOpacity={strokeOpacity * 0.7}
            />
          </g>
        );
      })}
    </svg>
  );
}
