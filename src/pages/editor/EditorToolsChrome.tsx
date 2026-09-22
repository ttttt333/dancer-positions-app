import type { EditorLayoutProps } from "./editorLayoutProps";
import { EditorNeonIconPanel } from "./EditorNeonIconPanel";

/**
 * ワイド: 編集操作は上部波形ドックの一列統合バーへ集約。右 Neon パネルのみ。
 * （ホームは TimelineToolbar 内に置き、固定フローティングと UPDATE LOG の重なりを防ぐ）
 * モバイル: 波形に被る FAB は出さず、MENU / Change 等に集約。
 */
export function EditorToolsChrome(props: EditorLayoutProps) {
  const mobileStackEditor = props.mobileStackEditor as boolean;
  const choreoPublicView = props.choreoPublicView as boolean;

  if (choreoPublicView) return null;

  if (mobileStackEditor) {
    // スマホは MENU / Change / ボトムバーに操作を集約。波形に被る FAB は出さない。
    return null;
  }

  // ホームは波形ツールバー側。ここでは右 Neon パネルのみ。
  return <EditorNeonIconPanel {...props} />;
}
