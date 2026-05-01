import type { CSSProperties, PointerEventHandler, ReactNode } from "react";
import { forwardRef } from "react";

export type StageMainFloorPanelProps = {
  onPointerDownCapture: PointerEventHandler<HTMLDivElement>;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  style: CSSProperties;
  children: ReactNode;
};

/** メイン床コンテナ（`ref`・床ポインタ・枠スタイル）。中身は親がツールバー／オーバーレイ／操作層で組み立てる */
export const StageMainFloorPanel = forwardRef<
  HTMLDivElement,
  StageMainFloorPanelProps
>(function StageMainFloorPanel(
  { onPointerDownCapture, onPointerDown, style, children },
  ref
) {
  return (
    <div
      ref={ref}
      onPointerDownCapture={onPointerDownCapture}
      onPointerDown={onPointerDown}
      style={style}
    >
      {children}
    </div>
  );
});
