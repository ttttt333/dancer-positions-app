import type { ReactNode } from "react";

export type StageBoardBulkToolbarSlotProps = {
  /** 色バー表示時など、床下に高さを確保してステージが跳ねないようにする */
  reserveMinHeight: boolean;
  children: ReactNode;
};

/**
 * メイン列の床下スロット（一括色ツールバー等）用のレイアウト枠。
 */
export function StageBoardBulkToolbarSlot({
  reserveMinHeight,
  children,
}: StageBoardBulkToolbarSlotProps) {
  return (
    <div
      style={{
        flexShrink: 0,
        width: "100%",
        maxWidth: "min(100%, 440px)",
        minHeight: reserveMinHeight ? 88 : 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {children}
    </div>
  );
}
