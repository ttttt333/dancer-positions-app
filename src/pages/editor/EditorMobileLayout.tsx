import type { EditorLayoutProps } from "./editorLayoutProps";
import { EditorThreePaneGrid } from "./EditorThreePaneGrid";
import { EditorStageRowOverlays } from "./EditorStageRowOverlays";

/** モバイル編集レイアウト（オーバーレイは flex を圧迫しない枠へ） */
export function EditorMobileLayout(props: EditorLayoutProps) {
  return (
    <>
      <EditorThreePaneGrid {...props} />
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
