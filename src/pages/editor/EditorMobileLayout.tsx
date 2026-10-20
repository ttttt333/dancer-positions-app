import type { EditorLayoutProps } from "./editorLayoutProps";
import { EditorThreePaneGrid } from "./EditorThreePaneGrid";
import { EditorStageRowOverlays } from "./EditorStageRowOverlays";
import { EditorToolsChrome } from "./EditorToolsChrome";

/** モバイル編集レイアウト（オーバーレイは flex を圧迫しない枠へ） */
export function EditorMobileLayout(props: EditorLayoutProps) {
  const choreoPublicView = props.choreoPublicView as boolean;
  return (
    <>
      <EditorThreePaneGrid {...props} />
      {!choreoPublicView ? <EditorToolsChrome {...props} /> : null}
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
