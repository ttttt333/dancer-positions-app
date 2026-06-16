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
  const pad = 12;

  if (menu.kind === "dancer") {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const width = Math.min(420, vw - pad * 2);
    const maxHeight = Math.min(vh * 0.88, 720);

    return {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 10000,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
      overflowY: "auto",
      padding: "14px 16px 16px",
      borderRadius: "14px",
      border: "1px solid #475569",
      background: "#0f172a",
      boxShadow: "0 24px 80px rgba(0,0,0,0.65)",
    };
  }

  const mw =
    menu.kind === "floorText" ? 168 : 132;
  const mh = menu.kind === "floorText" ? 88 : 52;
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
    padding: "5px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "#0f172a",
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
  };
}
