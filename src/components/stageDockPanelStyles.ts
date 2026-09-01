import type { CSSProperties } from "react";
import { btnSecondary } from "./stageButtonStyles";

export const dockCard: CSSProperties = {
  border: "1px solid #1e293b",
  borderRadius: 10,
  padding: "10px 10px 12px",
  marginBottom: 12,
  background: "#080b12",
};

export const dockSectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#94a3b8",
  margin: "0 0 6px",
};

export const dockSectionHint: CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  margin: "0 0 8px",
  lineHeight: 1.45,
};

export const dockActionBtn: CSSProperties = {
  ...btnSecondary,
  width: "100%",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 600,
  minHeight: 44,
};
