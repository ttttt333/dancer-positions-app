import type { EditorLayoutProps } from "./editorLayoutProps";
import { EditorThreePaneGrid } from "./EditorThreePaneGrid";
import { EditorStageRowOverlays } from "./EditorStageRowOverlays";
import { EditorNeonIconPanel } from "./EditorNeonIconPanel";

/**
 * デスクトップ編集レイアウト。
 * オーバーレイ（動画書き出しシート等）は absolute の 0 サイズ枠に置き、
 * 親 flex の兄弟として幅を食わないようにする（シート開閉でレイアウトが跳ねるのを防ぐ）。
 */
export function EditorDesktopLayout(props: EditorLayoutProps) {
  const choreoPublicView = props.choreoPublicView as boolean;
  const mobileStackEditor = props.mobileStackEditor as boolean;

  return (
    <>
      <EditorThreePaneGrid {...props} />
      {!choreoPublicView && !mobileStackEditor ? (
        <EditorNeonIconPanel {...props} />
      ) : null}
      <div
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <EditorStageRowOverlays {...props} />
      </div>
    </>
  );
}
