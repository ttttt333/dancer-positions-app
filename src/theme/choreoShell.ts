import type { CSSProperties } from "react";

/**
 * エディタ全体のトーン（モバイルの振付アプリのようなダーク・低彩度・細い境界線）。
 * 参照: 近い色相の #09090b 系 + アクセント赤。
 */
export const shell = {
  bgDeep: "#09090b",
  bgChrome: "#0c0c0e",
  surface: "#121214",
  surfaceRaised: "#18181b",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",
  text: "#fafafa",
  textMuted: "#a1a1aa",
  textSubtle: "#71717a",
  accent: "#dc2626",
  accentSoft: "rgba(220, 38, 38, 0.16)",
} as const;

/** タイムライン列・ステージ列などのカード面 */
export const panelCard: CSSProperties = {
  background: shell.surface,
  border: `1px solid ${shell.border}`,
  borderRadius: "14px",
};
