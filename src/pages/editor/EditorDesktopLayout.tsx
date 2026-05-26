import type { EditorLayoutProps } from "./editorLayoutProps";
import { EditorThreePaneGrid } from "./EditorThreePaneGrid";
import { EditorStageRowOverlays } from "./EditorStageRowOverlays";
import { EditorNeonIconPanel } from "./EditorNeonIconPanel";

export function EditorDesktopLayout(props: EditorLayoutProps) {
  const choreoPublicView = props.choreoPublicView as boolean;
  const mobileStackEditor = props.mobileStackEditor as boolean;

  return (
    <>
      <EditorThreePaneGrid {...props} />
      <EditorStageRowOverlays {...props} />
      {!choreoPublicView && !mobileStackEditor ? (
        <EditorNeonIconPanel {...props} />
      ) : null}
    </>
  );
}
