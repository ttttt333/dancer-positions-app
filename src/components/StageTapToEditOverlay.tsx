import type { PointerEventHandler } from "react";

export type StageTapToEditOverlayProps = {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
};

/** 「タップでレイアウト編集」モード時の透明オーバーレイ */
export function StageTapToEditOverlay({
  onPointerDown,
}: StageTapToEditOverlayProps) {
  return (
    <div
      role="presentation"
      title="クリックすると選択中のフォーメーションをドラッグで調整できます"
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        cursor: "pointer",
        background: "transparent",
      }}
    />
  );
}
