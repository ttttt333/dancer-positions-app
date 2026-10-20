/**
 * FODI 風フローティング UI 用の Glassmorphism トークン。
 * Tailwind 非依存（既存 inline style 体系に合わせる）。
 */
import type { CSSProperties } from "react";
import { shell } from "./choreoShell";

export const editorGlass = {
  /** 半透明ベース（ステージが見える） */
  bg: "rgba(10, 9, 8, 0.72)",
  bgStrong: "rgba(10, 9, 8, 0.88)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderGold: `1px solid ${shell.borderStrong}`,
  blur: "blur(14px) saturate(1.2)",
  shadow: "0 12px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.04)",
  radiusPill: 999,
  radiusPanel: 18,
  safeBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
  safeLeft: "max(12px, env(safe-area-inset-left, 0px))",
  safeRight: "max(12px, env(safe-area-inset-right, 0px))",
} as const;

/** 下部中央の再生ピル */
export const glassPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  borderRadius: editorGlass.radiusPill,
  background: editorGlass.bg,
  border: editorGlass.border,
  boxShadow: editorGlass.shadow,
  backdropFilter: editorGlass.blur,
  WebkitBackdropFilter: editorGlass.blur,
  color: shell.text,
};

/** 下部波形パネルなど角丸の浮遊面 */
export const glassPanelStyle: CSSProperties = {
  background: editorGlass.bgStrong,
  border: editorGlass.border,
  borderRadius: editorGlass.radiusPanel,
  boxShadow: editorGlass.shadow,
  backdropFilter: editorGlass.blur,
  WebkitBackdropFilter: editorGlass.blur,
  overflow: "hidden",
};
