import type { StageLightFixture } from "../types/choreography";
import { hexToRgba } from "../lib/stageLighting";

export type StageLightingOverlayProps = {
  lights: readonly StageLightFixture[];
};

/** 点灯中の照明色を床にソフトに重ねる */
export function StageLightingOverlay({ lights }: StageLightingOverlayProps) {
  if (!lights.length) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 3,
      }}
      aria-hidden
    >
      <defs>
        {lights.map((L) => (
          <radialGradient
            key={`lg-${L.id}`}
            id={`stage-light-${L.id}`}
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop
              offset="0%"
              stopColor={hexToRgba(L.color, Math.min(0.85, L.intensity * 0.95))}
            />
            <stop
              offset="55%"
              stopColor={hexToRgba(L.color, L.intensity * 0.35)}
            />
            <stop offset="100%" stopColor={hexToRgba(L.color, 0)} />
          </radialGradient>
        ))}
      </defs>
      {lights.map((L) => {
        const r =
          L.kind === "pinSpot"
            ? 8
            : L.kind === "suspension"
              ? 22
              : L.kind === "footlight" || L.kind === "backlight"
                ? 28
                : 16;
        return (
          <ellipse
            key={L.id}
            cx={L.xPct}
            cy={L.yPct}
            rx={r}
            ry={r * 0.72}
            fill={`url(#stage-light-${L.id})`}
          />
        );
      })}
    </svg>
  );
}
