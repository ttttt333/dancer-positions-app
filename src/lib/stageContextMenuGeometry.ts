import type { CSSProperties } from "react";
import { readLayoutViewportSize } from "./viewportLayoutMetrics";

export type StageContextMenuAnchor = {
  kind: "dancer" | "floorText" | "setPiece";
  clientX: number;
  clientY: number;
};

/** 右クリックメニューを画面内に収める固定位置スタイル */
export function computeStageContextMenuStyle(
  menu: StageContextMenuAnchor
): CSSProperties {
  const pad = 10;

  if (menu.kind === "dancer") {
    const { width: vw, height: vh } =
      typeof window !== "undefined"
        ? readLayoutViewportSize()
        : { width: 1200, height: 800 };
    const width = Math.min(720, vw - pad * 2);
    const maxHeight = Math.min(vh * 0.94, 760);

    return {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 10000,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
      overflowY: "auto",
      overflowX: "hidden",
      padding: "10px 14px 12px",
      borderRadius: "12px",
      border: "1px solid #475569",
      background: "#0f172a",
      boxShadow: "0 24px 80px rgba(0,0,0,0.65)",
    };
  }

  const mw =
    menu.kind === "floorText" ? 168 : 132;
  const mh = menu.kind === "floorText" ? 88 : 52;
  const { width: vw, height: vh } =
    typeof window !== "undefined"
      ? readLayoutViewportSize()
      : { width: 1200, height: 800 };
  const maxL = vw - mw - pad;
  const maxT = vh - mh - pad;
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
