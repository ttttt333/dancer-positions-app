import type { CSSProperties } from "react";

/**
 * ブランドロゴ（金のワイヤー＋中央ルビー）に合わせたダーク UI。
 * ゴールドを主アクセント、ルビーはステージ上の強調用に限定。
 */
export const shell = {
  bgDeep: "#060606",
  bgChrome: "#0a0908",
  surface: "#10100e",
  surfaceRaised: "#161512",
  border: "rgba(212, 175, 55, 0.08)",
  borderStrong: "rgba(212, 175, 55, 0.18)",
  text: "#faf7f0",
  textMuted: "#a8a29e",
  textSubtle: "#78716c",
  /** 主アクセント（メタリックゴールド） */
  accent: "#d4af37",
  accentDeep: "#8a7020",
  accentSoft: "rgba(212, 175, 55, 0.16)",
  /** ロゴ中央のルビーに合わせたステージ強調 */
  ruby: "#c41e3a",
  rubySoft: "rgba(196, 30, 58, 0.22)",
  /** ロゴマーク周りのリング */
  brandRing: "rgba(212, 175, 55, 0.45)",
  brandGlow: "rgba(212, 175, 55, 0.1)",
} as const;

/** タイムライン列・ステージ列などのカード面 */
export const panelCard: CSSProperties = {
  background: shell.surface,
  border: `1px solid ${shell.border}`,
  borderRadius: "14px",
};
