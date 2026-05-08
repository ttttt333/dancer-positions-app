import type { CSSProperties } from "react";
import { shell } from "../theme/choreoShell";

/** クラウド保存など、画面で一番目立たせたい操作（ブランドゴールド） */
export const btnAccent: CSSProperties = {
  padding: "8px 16px",
  borderRadius: "999px",
  border: "1px solid rgba(212, 175, 55, 0.55)",
  background: "linear-gradient(180deg, #f3e5a8 0%, #d4af37 42%, #a67c2d 100%)",
  color: "#14100a",
  fontWeight: 600,
  fontSize: "13px",
  letterSpacing: "0.01em",
  cursor: "pointer",
  boxShadow: "0 2px 18px rgba(212, 175, 55, 0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
};

export const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "999px",
  border: "1px solid rgba(212, 175, 55, 0.4)",
  background: "linear-gradient(135deg, #8a7020, #d4af37 55%, #c9a84c)",
  color: "#0c0a06",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 2px 12px rgba(212, 175, 55, 0.25)",
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
