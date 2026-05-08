import type { CSSProperties } from "react";

export type StageContextMenuAnchor = {
  kind: "dancer" | "floorText" | "setPiece";
  clientX: number;
  clientY: number;
};

/** 右クリックメニューを画面内に収める固定位置スタイル */
export function computeStageContextMenuStyle(
  menu: StageContextMenuAnchor
): CSSProperties {
  const pad = 8;
  const mw =
    menu.kind === "dancer" ? 252 : menu.kind === "floorText" ? 168 : 132;
  const mh =
    menu.kind === "dancer" ? 380 : menu.kind === "floorText" ? 88 : 52;
  const maxL =
    typeof window !== "undefined" ? window.innerWidth - mw - pad : menu.clientX;
  const maxT =
    typeof window !== "undefined" ? window.innerHeight - mh - pad : menu.clientY;
  return {
    position: "fixed",
    left: Math.max(pad, Math.min(menu.clientX, maxL)),
    top: Math.max(pad, Math.min(menu.clientY, maxT)),
    zIndex: 10000,
    minWidth: `${mw}px`,
    maxHeight: menu.kind === "dancer" ? "min(72vh, 520px)" : undefined,
    overflowY: menu.kind === "dancer" ? "auto" : undefined,
    padding: "5px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "#0f172a",
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
  };
}
