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
  if (typeof document === "undefined") return null;

  return createPortal(
    <textarea
      autoFocus
      aria-label="床テキストをその場で編集"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onRequestClose();
        }
      }}
      onBlur={() => {
        onRequestClose();
      }}
      style={{
        position: "fixed",
        left: layout.left,
        top: layout.top,
        width: layout.width,
        minHeight: layout.height,
        zIndex: 100000,
        boxSizing: "border-box",
        margin: 0,
        padding: "4px 8px",
        borderRadius: 6,
        border: "1px solid rgba(129, 140, 248, 0.85)",
        boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.6), 0 8px 24px rgba(0,0,0,0.35)",
        background: "rgba(15, 23, 42, 0.97)",
        color: textColor,
        fontFamily,
        fontSize: Math.round(clamp(fontSizePx * markupScale, 8, 96)),
        fontWeight,
        lineHeight: 1.25,
        resize: "none",
        textShadow: "0 0 2px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.65)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    />,
    document.body
  );
}
