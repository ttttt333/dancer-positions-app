import type { EditorLayoutProps } from "./editorLayoutProps";
import { EditorThreePaneGrid } from "./EditorThreePaneGrid";
import { EditorStageRowOverlays } from "./EditorStageRowOverlays";

export function EditorMobileLayout(props: EditorLayoutProps) {
  return (
    <>
      <EditorThreePaneGrid {...props} />
      <EditorStageRowOverlays {...props} />
    </>
  );
}
