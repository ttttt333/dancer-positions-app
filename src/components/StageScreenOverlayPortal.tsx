import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export type StageScreenOverlayPortalProps = {
  root: HTMLElement | null;
  /** `root` があって中身を描画すべきとき true（空のポータルを避ける） */
  open: boolean;
  children: ReactNode;
};

/** 編集画面（`viewportTextOverlayRoot`）上の screen レイヤー床テキスト・大道具・置きプレビュー */
export function StageScreenOverlayPortal({
  root,
  open,
  children,
}: StageScreenOverlayPortalProps) {
  if (typeof document === "undefined" || !root || !open) return null;

  return createPortal(
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 55,
      }}
    >
      {children}
    </div>,
    root
  );
}
