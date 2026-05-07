/**
 * MobileToolSheet — ツールメニュー ボトムシート
 *
 * MORE タブ押下で表示。backdrop + sheet アニメーション。
 * EditorStageWorkbench layout="rail" をそのままレンダリング。
 */
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import { shell } from "../../theme/choreoShell";
import { EditorStageWorkbench } from "../EditorStageWorkbench";
import type { EditorStageWorkbenchProps } from "../EditorStageWorkbench";

export type MobileToolSheetProps = {
  open: boolean;
  onClose: () => void;
  workbenchProps: Omit<EditorStageWorkbenchProps, "layout">;
};

export function MobileToolSheet({ open, onClose, workbenchProps }: MobileToolSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        animation: "mobileSheetBackdropIn 180ms ease forwards",
      }}
    >
      <style>{`
        @keyframes mobileSheetBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes mobileSheetSlideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div
        ref={sheetRef}
        style={{
          background: shell.surface,
          borderRadius: "20px 20px 0 0",
          border: `1px solid ${shell.borderStrong}`,
          borderBottom: "none",
          maxHeight: "80dvh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          animation: "mobileSheetSlideUp 220ms cubic-bezier(0.34,1.56,0.64,1) forwards",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: shell.borderStrong }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 16px 8px",
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: shell.textMuted,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            ツール
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              padding: "4px 8px",
              cursor: "pointer",
              color: shell.textMuted,
              fontSize: 14,
              fontWeight: 600,
              WebkitTapHighlightColor: "transparent",
            }}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* Rail content */}
        <EditorStageWorkbench
          layout="rail"
          {...workbenchProps}
          hideUndoRedoInRail={false}
        />

        {/* Bottom padding */}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
