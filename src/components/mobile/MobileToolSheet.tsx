/**
 * MobileToolSheet — ツールメニュー ボトムシート
 *
 * MORE タブ押下で表示。backdrop + sheet アニメーション。
 * EditorStageWorkbench layout="rail" をそのままレンダリング。
 */
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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onTouchEnd={(e) => {
        // backdrop tap to close (touch)
        if (e.target === e.currentTarget) { e.preventDefault(); onClose(); }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
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
          from { transform: translateY(60px); opacity: 0; }
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
          maxHeight: "82dvh",
          overflowY: "scroll",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          animation: "mobileSheetSlideUp 220ms cubic-bezier(0.34,1.56,0.64,1) forwards",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
          /* スクロール内のタップを確実に通す */
          isolation: "isolate",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: shell.borderStrong }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px 8px 16px",
          gap: 8,
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

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            {/* 音源ボタン — 常に表示（重要な操作） */}
            {workbenchProps.onOpenAudioImport && (
              <button
                type="button"
                onClick={() => { workbenchProps.onOpenAudioImport!(); onClose(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 12,
                  border: "1px solid #ef444440",
                  background: "#ef444418",
                  cursor: "pointer",
                  color: "#fca5a5",
                  fontSize: 13,
                  fontWeight: 600,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
                aria-label="音源を取り込む"
              >
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" aria-hidden style={{ display: "block", flexShrink: 0 }}>
                  <path d="M3 12 Q6 6 9 12 Q12 18 15 12 Q18 6 21 12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" fill="none"/>
                  <path d="M12 18 L12 22" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M9 22 L15 22" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                音源
              </button>
            )}

            {/* ✕ close button — 44×44 touch target */}
            <button
              type="button"
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                minWidth: 44,
                borderRadius: 22,
                background: "rgba(148,163,184,0.12)",
                border: `1px solid rgba(148,163,184,0.2)`,
                cursor: "pointer",
                color: shell.text,
                fontSize: 18,
                fontWeight: 400,
                lineHeight: 1,
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                flexShrink: 0,
              }}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Rail content */}
        <EditorStageWorkbench
          layout="rail"
          {...workbenchProps}
          hideUndoRedoInRail={false}
        />

        {/* Bottom padding */}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
