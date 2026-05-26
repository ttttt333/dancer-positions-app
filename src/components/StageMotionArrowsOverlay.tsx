/**
 * StageMotionArrowsOverlay
 * アクティブフォーメーション → 次フォーメーションへの移動経路を SVG 矢印で表示。
 * ダンサー印の上に被せる想定で position: absolute / inset: 0 / pointerEvents: none。
 */
import type { CSSProperties } from "react";
import type { DancerSpot, Formation } from "../types/choreography";

interface Props {
  /** 全フォーメーション */
  formations: Formation[];
  /** 現在表示中のフォーメーション ID */
  activeFormationId: string | null;
  /** 矢印色の透明度（0〜1） */
  opacity?: number;
  /** ハイライトする crewMemberId（個人閲覧モードで1人だけ目立たせるとき） */
  highlightCrewMemberId?: string | null;
}

/** ダンサー ID でアンカー */
function findById(dancers: DancerSpot[], id: string): DancerSpot | undefined {
  return dancers.find((d) => d.id === id);
}

/** 矢印の先端三角形を描く path */
function arrowHeadPath(
  x1: number, y1: number,
  x2: number, y2: number,
  headSize: number
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return "";
  const nx = dx / len;
  const ny = dy / len;
  const px = -ny;
  const py = nx;
  const bx = x2 - nx * headSize;
  const by = y2 - ny * headSize;
  const ax = bx + px * headSize * 0.5;
  const ay = by + py * headSize * 0.5;
  const cx = bx - px * headSize * 0.5;
  const cy = by - py * headSize * 0.5;
  return `M ${x2} ${y2} L ${ax} ${ay} L ${cx} ${cy} Z`;
}

export function StageMotionArrowsOverlay({
  formations,
  activeFormationId,
  opacity = 0.72,
  highlightCrewMemberId = null,
}: Props) {
  if (!activeFormationId || formations.length < 2) return null;

  const currentIdx = formations.findIndex((f) => f.id === activeFormationId);
  if (currentIdx < 0 || currentIdx >= formations.length - 1) return null;

  const from = formations[currentIdx]!;
  const to = formations[currentIdx + 1]!;

  // 各ダンサーの start→end ペアを作る（IDで対応付け）
  type Arrow = {
    x1: number; y1: number;
    x2: number; y2: number;
    color: string;
    isHighlight: boolean;
  };

  const DANCER_COLORS = [
    "#f87171", "#fb923c", "#facc15", "#4ade80",
    "#34d399", "#22d3ee", "#60a5fa", "#a78bfa",
    "#f472b6", "#e879f9", "#94a3b8", "#fbbf24",
    "#86efac", "#7dd3fc", "#c4b5fd", "#f9a8d4",
  ];

  const arrows: Arrow[] = [];

  for (const fromSpot of from.dancers) {
    const toSpot = findById(to.dancers, fromSpot.id);
    if (!toSpot) continue;

    const dist = Math.hypot(fromSpot.xPct - toSpot.xPct, fromSpot.yPct - toSpot.yPct);
    if (dist < 1.2) continue; // ほぼ静止はスキップ

    const isHighlight =
      highlightCrewMemberId != null &&
      (fromSpot.crewMemberId === highlightCrewMemberId ||
        fromSpot.id === highlightCrewMemberId);

    const color = DANCER_COLORS[fromSpot.colorIndex % DANCER_COLORS.length] ?? "#94a3b8";

    arrows.push({
      x1: fromSpot.xPct,
      y1: fromSpot.yPct,
      x2: toSpot.xPct,
      y2: toSpot.yPct,
      color,
      isHighlight,
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
    >
      <defs>
        {arrows.map((a, i) => (
          <marker
            key={`ah-${i}`}
            id={`mah-${i}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path
              d="M0,0 L6,3 L0,6 Z"
              fill={a.color}
              opacity={
                highlightCrewMemberId != null && !a.isHighlight ? 0.3 : opacity
              }
            />
          </marker>
        ))}
      </defs>
      {arrows.map((a, i) => {
        const isHighlight = a.isHighlight;
        const dimmed = highlightCrewMemberId != null && !isHighlight;
        const strokeOpacity = dimmed ? 0.22 : opacity;
        const strokeWidth = isHighlight ? 0.9 : 0.6;

        // 線の終点をマーカーサイズ分だけ手前に縮める
        const dx = a.x2 - a.x1;
        const dy = a.y2 - a.y1;
        const len = Math.hypot(dx, dy);
        const trim = 2.2 / (len || 1);
        const ex = a.x2 - dx * trim;
        const ey = a.y2 - dy * trim;

        return (
          <line
            key={i}
            x1={a.x1}
            y1={a.y1}
            x2={ex}
            y2={ey}
            stroke={a.color}
            strokeWidth={strokeWidth}
            strokeOpacity={strokeOpacity}
            strokeDasharray={isHighlight ? undefined : "1.6 1.2"}
            markerEnd={`url(#mah-${i})`}
          />
        );
      })}
    </svg>
  );
}
