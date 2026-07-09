import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type { TrashDropEdge } from "../lib/stageBoardRosterAndTrash";

export type TrashDropStripPortalProps = {
  /** ゴミ箱 UI を出すか（親の `showTrashDrop`） */
  open: boolean;
  trashHot: boolean;
  dockRef: RefObject<HTMLDivElement | null>;
  /** デスクトップ=左端、モバイル=下端 */
  edge?: TrashDropEdge;
  /** タップで選択中メンバーを削除（ドラッグ削除と併用） */
  onTapDelete?: () => void;
};

/** 画面端のゴミ箱ドロップ帯（body にポータル） */
export function TrashDropStripPortal({
  open,
  trashHot,
  dockRef,
  edge = "left",
  onTapDelete,
}: TrashDropStripPortalProps) {
  if (!open || typeof document === "undefined") return null;

  const isBottom = edge === "bottom";

  return createPortal(
    <div
      ref={dockRef}
      role="region"
      aria-label={
        isBottom
          ? "画面の下端へドラッグして離すと印や床テキストを削除できます"
          : "画面の左端へドラッグして離すと印や床テキストを削除できます"
      }
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        ...(isBottom
          ? {
              left: 0,
              right: 0,
              bottom: 0,
              height: "clamp(72px, 8.5vh, 140px)",
            }
          : {
              left: 0,
              top: 0,
              bottom: 0,
              width: "clamp(72px, 8.5vw, 140px)",
            }),
        zIndex: 200000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: isBottom ? "6px 10px" : "10px 6px",
        boxSizing: "border-box",
        borderTop: isBottom
          ? `2px dashed ${
              trashHot ? "rgba(248,113,113,0.95)" : "rgba(100,116,139,0.75)"
            }`
          : undefined,
        borderRight: !isBottom
          ? `2px dashed ${
              trashHot ? "rgba(248,113,113,0.95)" : "rgba(100,116,139,0.75)"
            }`
          : undefined,
        background: trashHot
          ? "rgba(127,29,29,0.55)"
          : isBottom
            ? "linear-gradient(0deg, rgba(15,23,42,0.92), rgba(15,23,42,0.45))"
            : "linear-gradient(90deg, rgba(15,23,42,0.92), rgba(15,23,42,0.45))",
        color: "#e2e8f0",
        fontSize: "10px",
        lineHeight: 1.35,
        textAlign: "center",
        pointerEvents: "none",
        userSelect: "none",
        boxShadow: isBottom
          ? "0 -4px 24px rgba(0,0,0,0.35)"
          : "4px 0 24px rgba(0,0,0,0.35)",
      }}
    >
      <span style={{ fontSize: "10px", lineHeight: 1.35, textAlign: "center" }}>
        {onTapDelete ? (
          <button
            type="button"
            aria-label="選択中の立ち位置を削除"
            title="タップで削除"
            onClick={(e) => {
              e.stopPropagation();
              onTapDelete();
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: 0,
              margin: 0,
              border: "none",
              background: "transparent",
              color: "inherit",
              font: "inherit",
              cursor: "pointer",
              pointerEvents: "auto",
              touchAction: "manipulation",
            }}
          >
            <span style={{ fontSize: "26px", lineHeight: 1 }} aria-hidden>
              🗑
            </span>
            <span>
              {isBottom ? (
                <>
                  タップまたは下へ
                  <br />
                  ドロップで削除
                </>
              ) : (
                <>
                  タップまたは左へ
                  <br />
                  ドロップで削除
                </>
              )}
            </span>
          </button>
        ) : (
          <>
            <span style={{ fontSize: "26px", lineHeight: 1 }} aria-hidden>
              🗑
            </span>
            <span>
              {isBottom ? (
                <>
                  画面の下へ
                  <br />
                  ドロップで削除
                </>
              ) : (
                <>
                  画面の左へ
                  <br />
                  ドロップで削除
                </>
              )}
            </span>
          </>
        )}
      </span>
    </div>,
    document.body
  );
}
