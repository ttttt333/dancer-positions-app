import type { CSSProperties } from "react";
import { shell } from "../theme/choreoShell";

/** Apple + Linear + Figma風のモダンUIシステム */

/** 基本ボタンスタイル - 全ボタンで統一 */
export const btnBase: CSSProperties = {
  padding: "10px 16px",
  borderRadius: "12px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  backgroundColor: "rgba(255, 255, 255, 0.03)",
  color: "rgba(255, 255, 255, 0.9)",
  fontSize: "14px",
  fontWeight: "500",
  letterSpacing: "0.01em",
  cursor: "pointer",
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  outline: "none",
  position: "relative",
  overflow: "hidden",
};

/** ホバー状態 */
export const btnHover: CSSProperties = {
  ...btnBase,
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  borderColor: "rgba(255, 255, 255, 0.15)",
  transform: "translateY(-1px)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
};

/** アクティブ状態 */
export const btnActive: CSSProperties = {
  ...btnBase,
  backgroundColor: "rgba(255, 255, 255, 0.12)",
  borderColor: "rgba(255, 255, 255, 0.2)",
  transform: "translateY(0)",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
};

/** 選択中状態 */
export const btnSelected: CSSProperties = {
  ...btnBase,
  backgroundColor: "rgba(59, 130, 246, 0.15)",
  borderColor: "rgba(59, 130, 246, 0.3)",
  color: "rgba(255, 255, 255, 0.95)",
  boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(59, 130, 246, 0.15)",
};

/** 無効状態 */
export const btnDisabled: CSSProperties = {
  ...btnBase,
  backgroundColor: "rgba(255, 255, 255, 0.02)",
  borderColor: "rgba(255, 255, 255, 0.05)",
  color: "rgba(255, 255, 255, 0.3)",
  cursor: "not-allowed",
  transform: "none",
  boxShadow: "none",
};

/** アクセントボタン - 高級感のあるゴールド */
export const btnAccent: CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.08) 100%)",
  borderColor: "rgba(212, 175, 55, 0.3)",
  color: "rgba(255, 255, 255, 0.95)",
  fontWeight: "600",
};

/** プライマリボタン */
export const btnPrimary: CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%)",
  borderColor: "rgba(59, 130, 246, 0.3)",
  color: "rgba(255, 255, 255, 0.95)",
  fontWeight: "600",
};

/** セカンダリボタン - デフォルト */
export const btnSecondary: CSSProperties = {
  ...btnBase,
};

/** 正方形ツールボタン */
export const btnToolSquare: CSSProperties = {
  ...btnBase,
  width: "48px",
  height: "48px",
  padding: "0",
  borderRadius: "12px",
  fontSize: "20px",
};

/** 小さいツールボタン */
export const btnToolSmall: CSSProperties = {
  ...btnBase,
  width: "36px",
  height: "36px",
  padding: "0",
  borderRadius: "10px",
  fontSize: "16px",
};

/** アイコン統一スタイル */
export const iconBase: CSSProperties = {
  strokeWidth: 1.5,
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
};

/** アイコンホバー効果 */
export const iconHover: CSSProperties = {
  ...iconBase,
  transform: "scale(1.05)",
};

/** カテゴリー別アイコンスタイル */
export const iconStage: CSSProperties = {
  ...iconBase,
  color: "#a855f7",
  filter: "drop-shadow(0 0 4px #a855f7)",
};

export const iconCue: CSSProperties = {
  ...iconBase,
  color: "#f97316",
  filter: "drop-shadow(0 0 4px #f97316)",
};

export const iconMember: CSSProperties = {
  ...iconBase,
  color: "#10b981",
  filter: "drop-shadow(0 0 4px #10b981)",
};

export const iconShare: CSSProperties = {
  ...iconBase,
  color: "#06b6d4",
  filter: "drop-shadow(0 0 4px #06b6d4)",
};

/** ボタンカテゴリースタイル */
export const btnStage: CSSProperties = {
  ...btnBase,
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  borderColor: "rgba(168, 85, 247, 0.3)",
};

export const btnCue: CSSProperties = {
  ...btnBase,
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  borderColor: "rgba(249, 115, 22, 0.3)",
};

export const btnMember: CSSProperties = {
  ...btnBase,
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  borderColor: "rgba(16, 185, 129, 0.3)",
};

export const btnShare: CSSProperties = {
  ...btnBase,
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  borderColor: "rgba(6, 182, 212, 0.3)",
};

/** ホバーエフェクト */
export const btnStageHover: CSSProperties = {
  ...btnStage,
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  transform: "translateY(-1px)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
};

export const btnCueHover: CSSProperties = {
  ...btnCue,
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  transform: "translateY(-1px)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
};

export const btnMemberHover: CSSProperties = {
  ...btnMember,
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  transform: "translateY(-1px)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
};

export const btnShareHover: CSSProperties = {
  ...btnShare,
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  transform: "translateY(-1px)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
};

/** セクションコンテナ */
export const sectionContainer: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "16px",
  borderRadius: "16px",
  backgroundColor: "rgba(255, 255, 255, 0.02)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
};

/** グリッドコンテナ */
export const gridContainer: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(48px, 1fr))",
  gap: "8px",
  alignItems: "center",
};

/** ヘッダのタイトル入力など */
export const inputField: CSSProperties = {
  borderRadius: "10px",
  border: `1px solid ${shell.border}`,
  background: "rgba(0,0,0,0.28)",
  color: shell.text,
  fontSize: "13px",
};
