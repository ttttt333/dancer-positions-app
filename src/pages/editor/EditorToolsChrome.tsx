import { MobilePrimaryFloatingTools } from "../../components/editor/FloatingHeaderToolbar";
import {
  EditorFloatingHomeButton,
  EditorFloatingTools,
} from "../../components/EditorFloatingTools";
import type { EditorLayoutProps } from "./editorLayoutProps";
import { EditorNeonIconPanel } from "./EditorNeonIconPanel";

/**
 * ワイド: 編集操作は上部波形ドックの一列統合バーへ集約。HOME + 右 Neon パネルのみ。
 * モバイル: 追加/隊形は常時FAB、Undo等は展開FAB。
 */
export function EditorToolsChrome(props: EditorLayoutProps) {
  const wideEditorLayout = props.wideEditorLayout as boolean;
  const mobileStackEditor = props.mobileStackEditor as boolean;
  const choreoPublicView = props.choreoPublicView as boolean;
  const project = props.project as EditorLayoutProps["project"];
  const undo = props.undo as () => void;
  const redo = props.redo as () => void;
  const stageUndoDisabled = props.stageUndoDisabled as boolean;
  const stageRedoDisabled = props.stageRedoDisabled as boolean;
  const saveStageToFormationBox = props.saveStageToFormationBox as () => void;
  const addDancerFromStageToolbar =
    props.addDancerFromStageToolbar as () => void;
  const setFormationPresetPickerOpen = props.setFormationPresetPickerOpen as (
    open: boolean
  ) => void;
  const setFlowLibraryOpen = props.setFlowLibraryOpen as (open: boolean) => void;
  const setShareLinksOpen = props.setShareLinksOpen as (open: boolean) => void;
  const setAiSuggestOpen = props.setAiSuggestOpen as (open: boolean) => void;
  const setAddCueDialogOpen = props.setAddCueDialogOpen as (
    open: boolean
  ) => void;
  const openAudioImport = props.openAudioImport as () => void;
  const setExportDialogOpen = props.setExportDialogOpen as (
    open: boolean
  ) => void;
  const setRightPaneCollapsed = props.setRightPaneCollapsed as (
    v: boolean | ((prev: boolean) => boolean)
  ) => void;

  if (choreoPublicView) return null;

  const disabled = project?.viewMode === "view";

  if (mobileStackEditor) {
    return (
      <>
        <MobilePrimaryFloatingTools
          disabled={disabled}
          onAddDancer={addDancerFromStageToolbar}
          onOpenFormationPresets={() => setFormationPresetPickerOpen(true)}
        />
        <EditorFloatingTools
          variant="mobile"
          hidePrimaryActions
          disabled={disabled}
          onAddDancer={addDancerFromStageToolbar}
          onOpenFormationPresets={() => setFormationPresetPickerOpen(true)}
          onUndo={undo}
          onRedo={redo}
          undoDisabled={stageUndoDisabled}
          redoDisabled={stageRedoDisabled}
          onSave={saveStageToFormationBox}
          onOpenLibrary={() => setFlowLibraryOpen(true)}
          onOpenExport={() => setExportDialogOpen(true)}
          onOpenShareLinks={() => setShareLinksOpen(true)}
          onOpenAISuggest={() => setAiSuggestOpen(true)}
          onOpenCueSettings={() => setAddCueDialogOpen(true)}
          onOpenAudioImport={openAudioImport}
          onOpenMore={() => setRightPaneCollapsed((v) => !v)}
        />
      </>
    );
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
