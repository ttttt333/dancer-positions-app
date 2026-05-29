import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { clamp } from "../lib/stageBoardModelHelpers";

export type FloorTextInlineEditLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FloorTextInlineEditPortalProps = {
  layout: FloorTextInlineEditLayout;
  value: string;
  onValueChange: (body: string) => void;
  fontSizePx: number;
  fontWeight: number;
  fontFamily: string;
  /** `floorTextDraftColorHex` などで解決済みの文字色 */
  textColor: string;
  markupScale: number;
  onRequestClose: () => void;
};

/** 床テキストのその場編集（`position: fixed` を body にポータル） */
export function FloorTextInlineEditPortal({
  layout,
  value,
  onValueChange,
  fontSizePx,
  fontWeight,
  fontFamily,
  textColor,
  markupScale,
  onRequestClose,
}: FloorTextInlineEditPortalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(
    () => () => {
      if (blurTimerRef.current != null) {
        window.clearTimeout(blurTimerRef.current);
      }
    },
    []
  );

  if (typeof document === "undefined") return null;

  const displayFontSize = Math.max(16, Math.round(clamp(fontSizePx * markupScale, 8, 96)));

  return createPortal(
    <textarea
      ref={textareaRef}
      autoFocus
      aria-label="床テキストをその場で編集"
      value={value}
      enterKeyHint="done"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      onChange={(e) => onValueChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onRequestClose();
        }
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.parentElement?.contains(next)) return;
        blurTimerRef.current = window.setTimeout(() => {
          blurTimerRef.current = null;
          onRequestClose();
        }, 180);
      }}
      onFocus={() => {
        if (blurTimerRef.current != null) {
          window.clearTimeout(blurTimerRef.current);
          blurTimerRef.current = null;
        }
      }}
      style={{
        position: "fixed",
        left: layout.left,
        top: layout.top,
        width: Math.max(180, layout.width),
        minHeight: Math.max(56, layout.height),
        zIndex: 100000,
        boxSizing: "border-box",
        margin: 0,
        padding: "8px 12px",
        borderRadius: 8,
        border: "2px solid rgba(129, 140, 248, 0.9)",
        boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.6), 0 8px 24px rgba(0,0,0,0.35)",
        background: "rgba(15, 23, 42, 0.98)",
        color: textColor,
        fontFamily,
        fontSize: displayFontSize,
        fontWeight,
        lineHeight: 1.35,
        resize: "none",
        textShadow: "0 0 2px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.65)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    />,
    document.body
  );
}
