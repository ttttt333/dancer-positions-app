import type { ReactNode } from "react";

export type StageBoardLayoutProps = {
  screenOverlay: ReactNode;
  mainColumn: ReactNode;
  /** ステージ上の右クリックメニュー（不要なら `null`） */
  stageContextMenu: ReactNode;
};

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
