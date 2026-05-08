import type { ReactElement } from "react";
import { round2 } from "../lib/stageBoardModelHelpers";

export type StageMillimeterGridSvgProps = {
  /** mm 格子を描いているときは全体をやや薄くする */
  opacity: number;
  /** 細かい格子線を描くか（寸法あり・縦横のいずれか表示のとき） */
  showFineGrid: boolean;
  mmSnapGrid: { stepXPct: number; stepYPct: number } | null;
  stageGridLinesVertical: boolean;
  stageGridLinesHorizontal: boolean;
};

/** センター縦線（黄金）＋任意の mm 基準格子（幅・奥行 mm から算出した % 間隔） */
export function StageMillimeterGridSvg({
  opacity,
  showFineGrid,
  mmSnapGrid,
  stageGridLinesVertical,
  stageGridLinesHorizontal,
}: StageMillimeterGridSvgProps) {
  const fineLines =
    showFineGrid && mmSnapGrid != null
      ? (() => {
          const MAX = 120;
          const K = Math.max(2, MAX - 2);
          const { stepXPct, stepYPct } = mmSnapGrid;
          if (
            !Number.isFinite(stepXPct) ||
            !Number.isFinite(stepYPct) ||
            stepXPct <= 0 ||
            stepYPct <= 0
          ) {
            return [] as ReactElement[];
          }
          const sx = Math.max(
            1,
            Math.min(50_000, Math.ceil(50 / (K * stepXPct)))
          );
          const sy = Math.max(
            1,
            Math.min(50_000, Math.ceil(50 / (K * stepYPct)))
          );
          const nodes: ReactElement[] = [];
          const stepX = stepXPct * sx;
          const stepY = stepYPct * sy;
          if (stageGridLinesVertical) {
            for (let k = 1; k <= MAX; k++) {
              const off = k * stepX;
              const r = 50 + off;
              const l = 50 - off;
              if (r > 100 + 1e-6 && l < -1e-6) break;
              if (r <= 100 + 1e-6 && Math.abs(r - 50) > 0.02) {
                const g = round2(Math.min(100, r));
                nodes.push(
                  <line
                    key={`v+${k}-${sx}`}
                    x1={`${g}%`}
                    y1="0%"
                    x2={`${g}%`}
                    y2="100%"
                    stroke="#475569"
                    strokeWidth="0.42"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }
              if (l >= -1e-6 && Math.abs(l - 50) > 0.02) {
                const g = round2(Math.max(0, l));
                nodes.push(
                  <line
                    key={`v-${k}-${sx}`}
                    x1={`${g}%`}
                    y1="0%"
                    x2={`${g}%`}
                    y2="100%"
                    stroke="#475569"
                    strokeWidth="0.42"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }
            }
          }
          if (stageGridLinesHorizontal) {
            for (let k = 1; k <= MAX; k++) {
              const off = k * stepY;
              const b = 50 + off;
              const t = 50 - off;
              if (b > 100 + 1e-6 && t < -1e-6) break;
              if (b <= 100 + 1e-6 && Math.abs(b - 50) > 0.02) {
                const g = round2(Math.min(100, b));
                nodes.push(
                  <line
                    key={`h+${k}-${sy}`}
                    x1="0%"
                    y1={`${g}%`}
                    x2="100%"
                    y2={`${g}%`}
                    stroke="#475569"
                    strokeWidth="0.42"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }
              if (t >= -1e-6 && Math.abs(t - 50) > 0.02) {
                const g = round2(Math.max(0, t));
                nodes.push(
                  <line
                    key={`h-${k}-${sy}`}
                    x1="0%"
                    y1={`${g}%`}
                    x2="100%"
                    y2={`${g}%`}
                    stroke="#475569"
                    strokeWidth="0.42"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }
            }
          }
          return nodes;
        })()
      : [];

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity,
        zIndex: 1,
      }}
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1="50%"
        y1="0%"
        x2="50%"
        y2="100%"
        stroke="rgba(251, 191, 36, 0.92)"
        strokeWidth="0.55"
        vectorEffect="non-scaling-stroke"
      />
      {fineLines}
    </svg>
  );
}
