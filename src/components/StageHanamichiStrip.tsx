import type { CSSProperties } from "react";

export type StageHanamichiStripProps = {
  depthPct: number;
};

const rootStyle = (depthPct: number): CSSProperties => ({
  flex: "0 0 auto",
  height: `${depthPct}%`,
  minHeight: 28,
  maxHeight: "42%",
  borderTop: "1px solid rgba(71, 85, 105, 0.55)",
  background: "linear-gradient(180deg, #0f172a, #020617)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "11px",
  color: "#64748b",
  letterSpacing: "0.14em",
  userSelect: "none",
});

export function StageHanamichiStrip({ depthPct }: StageHanamichiStripProps) {
  return <div style={rootStyle(depthPct)}>花道</div>;
}
