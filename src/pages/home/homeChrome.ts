import type { CSSProperties } from "react";
import { shell } from "../../theme/choreoShell";

export const HOME_FONT =
  '"Figtree", "Noto Sans JP", system-ui, -apple-system, sans-serif';
export const HOME_DISPLAY =
  '"Syne", "Noto Sans JP", system-ui, -apple-system, sans-serif';

export const homeRootStyle: CSSProperties = {
  minHeight: "100dvh",
  background: shell.bgDeep,
  color: shell.text,
  fontFamily: HOME_FONT,
  WebkitFontSmoothing: "antialiased",
};

export const homeIconBtn: CSSProperties = {
  width: 44,
  height: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  color: shell.text,
  cursor: "pointer",
  borderRadius: 10,
  padding: 0,
};

export const homeMenuRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  width: "100%",
  padding: "14px 18px",
  border: "none",
  background: "transparent",
  color: shell.text,
  fontSize: 16,
  fontFamily: "inherit",
  textAlign: "left",
  cursor: "pointer",
  boxSizing: "border-box",
};

export const homeDivider: CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.08)",
  margin: "4px 0",
  border: "none",
};

export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._\-\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._\-]+/g, " ").trim() || email;
}
