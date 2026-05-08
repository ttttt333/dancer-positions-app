import type { StageBoardLayoutSlots } from "./stageBoardTypes";

export type StageBoardLayoutProps = StageBoardLayoutSlots;

/**
 * ステージボードの見た目レイヤー: screen オーバーレイ・メイン列・コンテキストメニュー。
 * インライン編集ポータルやゴミ箱帯などは親（`StageBoardBody`）に残す。
 */
export function StageBoardLayout({
  screenOverlay,
  mainColumn,
  stageContextMenu,
}: StageBoardLayoutProps) {
  return (
    <>
      {screenOverlay}
      {mainColumn}
      {stageContextMenu}
    </>
  );
}
