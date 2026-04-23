import type { ReactNode } from "react";

export type EditorSideSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 右パネルの CSS width（例: min(440px, 44vw)） */
  width?: string;
  zIndex?: number;
  /** true のとき左側クリックでは閉じない（処理中など） */
  blockDismiss?: boolean;
  /** `role="dialog"` の `aria-labelledby` */
  ariaLabelledBy?: string;
  children: ReactNode;
};

/**
 * ステージを暗く覆わず、右からスライドする入力パネル。
 * 左側の透明領域クリックで閉じる（blockDismiss 時は無効）。
 */
export function EditorSideSheet({
  open,
  onClose,
  width = "min(440px, 44vw)",
  zIndex = 64,
  blockDismiss = false,
  ariaLabelledBy,
  children,
}: EditorSideSheetProps) {
  if (!open) return null;
  return (
    <div
      style={
        {
          position: "fixed",
          inset: 0,
          zIndex,
          pointerEvents: "none",
          ["--ed-sheet-w" as string]: width,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        aria-label="パネルを閉じる"
        disabled={blockDismiss}
        onClick={() => {
          if (!blockDismiss) onClose();
        }}
        style={{
          position: "absolute",
          inset: 0,
          right: "var(--ed-sheet-w)",
          border: "none",
          background: "transparent",
          cursor: blockDismiss ? "default" : "pointer",
          pointerEvents: blockDismiss ? "none" : "auto",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "var(--ed-sheet-w)",
          maxWidth: "100%",
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          background: "#0f172a",
          borderLeft: "1px solid #334155",
          boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
