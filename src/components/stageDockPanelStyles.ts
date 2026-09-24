import type { CSSProperties } from "react";
import { btnSecondary } from "./stageButtonStyles";

export const dockCard: CSSProperties = {
  border: "1px solid #1e293b",
  borderRadius: 8,
  padding: "6px 7px 7px",
  marginBottom: 6,
  background: "#080b12",
};

export const dockSectionTitle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#94a3b8",
  margin: "0 0 4px",
  letterSpacing: "0.02em",
};

export const dockSectionHint: CSSProperties = {
  fontSize: 9,
  color: "#64748b",
  margin: "0 0 5px",
  lineHeight: 1.35,
};

export const dockActionBtn: CSSProperties = {
  ...btnSecondary,
  width: "100%",
  padding: "6px 8px",
  fontSize: 11,
  fontWeight: 600,
  minHeight: 30,
  borderRadius: 7,
};
