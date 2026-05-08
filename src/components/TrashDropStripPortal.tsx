import type { RefObject } from "react";
import { createPortal } from "react-dom";

export type TrashDropStripPortalProps = {
  /** ゴミ箱 UI を出すか（親の `showTrashDrop`） */
  open: boolean;
  trashHot: boolean;
  dockRef: RefObject<HTMLDivElement | null>;
};

/** 画面左端のゴミ箱ドロップ帯（body にポータル） */
export function TrashDropStripPortal({
  open,
  trashHot,
  dockRef,
}: TrashDropStripPortalProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={dockRef}
      role="region"
      aria-label="画面の左端へドラッグして離すと印や床テキストを削除できます"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: "clamp(72px, 8.5vw, 140px)",
        zIndex: 200000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "10px 6px",
        boxSizing: "border-box",
        borderRight: `2px dashed ${
          trashHot ? "rgba(248,113,113,0.95)" : "rgba(100,116,139,0.75)"
        }`,
        background: trashHot
          ? "rgba(127,29,29,0.55)"
          : "linear-gradient(90deg, rgba(15,23,42,0.92), rgba(15,23,42,0.45))",
        color: "#e2e8f0",
        fontSize: "10px",
        lineHeight: 1.35,
        textAlign: "center",
        pointerEvents: "none",
        userSelect: "none",
        boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
      }}
    >
      <span style={{ fontSize: "26px", lineHeight: 1 }} aria-hidden>
        🗑
      </span>
      <span>
        画面の左へ
        <br />
        ドロップで削除
      </span>
    </div>,
    document.body
  );
}
