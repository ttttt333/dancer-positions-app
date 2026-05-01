import type { ReactNode } from "react";

export type StageBoardShellProps = {
  /** `StageBoardLayout`（screen / main column / context menu） */
  main: ReactNode;
  /** ポータル・ダイアログ等（`StageBoardBodyOverlays`） */
  overlays: ReactNode;
};

/**
 * ステージボードの「画面内レイアウト」と「body 直下のオーバーレイ」を並べるだけの薄いルート。
 */
export function StageBoardShell({ main, overlays }: StageBoardShellProps) {
  return (
    <>
      {main}
      {overlays}
    </>
  );
}
