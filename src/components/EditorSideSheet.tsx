import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type EditorSideSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 右パネルの CSS width（例: min(440px, 44vw)） */
  width?: string;
  zIndex?: number;
  /** true のとき左側クリックでは閉じない（処理中など） */
  blockDismiss?: boolean;
  /**
   * true のとき左側（ステージ側）はポインターを通す。
   * 舞台設定中にヘソ／そで幕をドラッグするため。閉じるのはパネル内ボタンのみ。
   */
  passThroughOutside?: boolean;
  /** `role="dialog"` の `aria-labelledby` */
  ariaLabelledBy?: string;
  /** モバイル CSS 上書き用（例: formation-preset-picker） */
  sheetId?: string;
  /** 右パネル面の上書き（共有シートなどブランド面） */
  panelStyle?: CSSProperties;
  children: ReactNode;
};

type ShellMirror = "portrait" | "landscape" | null;

function readShellMirror(): ShellMirror {
  if (typeof document === "undefined") return null;
  if (document.querySelector("[data-shell-portrait]")) return "portrait";
  if (document.querySelector("[data-shell-landscape]")) return "landscape";
  return null;
}

/**
 * ステージを暗く覆わず、右からスライドする入力パネル。
 * 既定では左側の透明領域クリックで閉じる（blockDismiss / passThroughOutside 時は無効）。
 * passThroughOutside 時はステージ操作（ヘソ・そで幕ドラッグ等）を妨げない。
 *
 * body に portal し、MobileShell のステージ stacking context や
 * メニューシート（z≈521）の下に潜らないようにする。
 * モバイル時は portal ルートに data-shell-* をミラーし、既存の全画面 CSS を維持する。
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
  passThroughOutside = false,
  ariaLabelledBy,
  sheetId,
  panelStyle,
  children,
}: EditorSideSheetProps) {
  const [dismissArmed, setDismissArmed] = useState(false);
  const [shellMirror, setShellMirror] = useState<ShellMirror>(null);

  useEffect(() => {
    if (!open) {
      setDismissArmed(false);
      setShellMirror(null);
      return;
    }
    setShellMirror(readShellMirror());
    setDismissArmed(false);
    const id = window.setTimeout(() => setDismissArmed(true), 320);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const canDismiss = dismissArmed && !blockDismiss && !passThroughOutside;
  const mobileWidth = shellMirror != null ? "100%" : width;

  const node = (
    <div
      data-editor-sheet-root={sheetId ?? ""}
      {...(shellMirror === "portrait"
        ? { "data-shell-portrait": "" }
        : shellMirror === "landscape"
          ? { "data-shell-landscape": "" }
          : {})}
      style={
        {
          position: "fixed",
          inset: 0,
          zIndex,
          pointerEvents: "none",
          ["--ed-sheet-w" as string]: mobileWidth,
        } as React.CSSProperties
      }
    >
      {!passThroughOutside ? (
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
      ) : null}
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

  return createPortal(node, document.body);
}
