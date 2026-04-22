import type { CSSProperties } from "react";
import { shell } from "../theme/choreoShell";

/** クラウド保存など、画面で一番目立たせたい操作（参照アプリの赤 CTA に近い） */
export const btnAccent: CSSProperties = {
  padding: "8px 16px",
  borderRadius: "999px",
  border: "none",
  background: shell.accent,
  color: "#ffffff",
  fontWeight: 600,
  fontSize: "13px",
  letterSpacing: "0.01em",
  cursor: "pointer",
  boxShadow: "0 2px 14px rgba(220, 38, 38, 0.35)",
};

export const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #4f46e5, #ec4899)",
  color: "white",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: `1px solid ${shell.borderStrong}`,
  backgroundColor: "rgba(255,255,255,0.04)",
  color: shell.text,
  fontSize: "13px",
  letterSpacing: "0.01em",
  cursor: "pointer",
};

/** ヘッダのタイトル入力など */
export const inputField: CSSProperties = {
  borderRadius: "10px",
  border: `1px solid ${shell.border}`,
  background: "rgba(0,0,0,0.28)",
  color: shell.text,
  fontSize: "13px",
};
