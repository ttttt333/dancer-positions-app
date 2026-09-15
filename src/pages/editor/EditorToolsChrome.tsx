import { EditorFloatingHomeButton } from "../../components/EditorFloatingTools";
import type { EditorLayoutProps } from "./editorLayoutProps";
import { EditorNeonIconPanel } from "./EditorNeonIconPanel";

/**
 * ワイド: 編集操作は上部波形ドックの一列統合バーへ集約。HOME + 右 Neon パネルのみ。
 * モバイル: 波形に被る FAB は出さず、MENU / Change 等に集約。
 */
export function EditorToolsChrome(props: EditorLayoutProps) {
  const wideEditorLayout = props.wideEditorLayout as boolean;
  const mobileStackEditor = props.mobileStackEditor as boolean;
  const choreoPublicView = props.choreoPublicView as boolean;

  if (choreoPublicView) return null;

  if (mobileStackEditor) {
    // スマホは MENU / Change / ボトムバーに操作を集約。波形に被る FAB は出さない。
    return null;
  }

  if (wideEditorLayout) {
    return (
      <>
        <EditorFloatingHomeButton />
        <EditorNeonIconPanel {...props} />
      </>
    );
  }

  return <EditorNeonIconPanel {...props} />;
}
