import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

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
  /** モバイル CSS 上書き用（例: formation-preset-picker） */
  sheetId?: string;
  /** 右パネル面の上書き（共有シートなどブランド面） */
  panelStyle?: CSSProperties;
  children: ReactNode;
};

/**
 * ステージを暗く覆わず、右からスライドする入力パネル。
 * 左側の透明領域クリックで閉じる（blockDismiss 時は無効）。
 *
 * 開いた直後〜約 320ms は外側クリックで閉じない
 * （PC で開く操作の mouseup / 残クリックで即閉じするのを防ぐ）。
 */
export function EditorSideSheet({
  open,
  onClose,
  width = "min(440px, 44vw)",
  zIndex = 64,
  blockDismiss = false,
  ariaLabelledBy,
  sheetId,
  panelStyle,
  children,
}: EditorSideSheetProps) {
  const [dismissArmed, setDismissArmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setDismissArmed(false);
      return;
    }
    setDismissArmed(false);
    const id = window.setTimeout(() => setDismissArmed(true), 320);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const canDismiss = dismissArmed && !blockDismiss;

  return (
    <div
      data-editor-sheet-root={sheetId}
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
        tabIndex={-1}
        disabled={!canDismiss}
        onClick={(e) => {
          e.stopPropagation();
          if (canDismiss) onClose();
        }}
        style={{
          position: "absolute",
          inset: 0,
          right: "var(--ed-sheet-w)",
          border: "none",
          background: "transparent",
          cursor: canDismiss ? "pointer" : "default",
          pointerEvents: canDismiss ? "auto" : "none",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        data-editor-sheet={sheetId}
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
          ...panelStyle,
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
