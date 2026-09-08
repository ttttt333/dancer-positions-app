import { EditorFloatingHomeButton, EditorFloatingTools } from "../../components/EditorFloatingTools";
import type { EditorLayoutProps } from "./editorLayoutProps";
import { EditorNeonIconPanel } from "./EditorNeonIconPanel";

/**
 * ワイド没入 UI: Glass 縦ツール + ホーム（Neon は「その他」で展開）。
 * モバイル縦積み: FAB。
 * その他: 従来 NeonIconPanel。
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
  const addDancerFromStageToolbar = props.addDancerFromStageToolbar as () => void;
  const setFormationPresetPickerOpen = props.setFormationPresetPickerOpen as (
    open: boolean
  ) => void;
  const setFlowLibraryOpen = props.setFlowLibraryOpen as (open: boolean) => void;
  const setShareLinksOpen = props.setShareLinksOpen as (open: boolean) => void;
  const setAiSuggestOpen = props.setAiSuggestOpen as (open: boolean) => void;
  const setAddCueDialogOpen = props.setAddCueDialogOpen as (open: boolean) => void;
  const openAudioImport = props.openAudioImport as () => void;
  const setExportDialogOpen = props.setExportDialogOpen as (open: boolean) => void;
  const setRightPaneCollapsed = props.setRightPaneCollapsed as (
    v: boolean | ((prev: boolean) => boolean)
  ) => void;
  const rightPaneCollapsed = props.rightPaneCollapsed as boolean;

  if (choreoPublicView) return null;

  const common = {
    disabled: project?.viewMode === "view",
    onAddDancer: addDancerFromStageToolbar,
    onOpenFormationPresets: () => setFormationPresetPickerOpen(true),
    onUndo: undo,
    onRedo: redo,
    undoDisabled: stageUndoDisabled,
    redoDisabled: stageRedoDisabled,
    onSave: saveStageToFormationBox,
    onOpenLibrary: () => setFlowLibraryOpen(true),
    onOpenExport: () => setExportDialogOpen(true),
    onOpenShareLinks: () => setShareLinksOpen(true),
    onOpenAISuggest: () => setAiSuggestOpen(true),
    onOpenCueSettings: () => setAddCueDialogOpen(true),
    onOpenAudioImport: openAudioImport,
    onOpenMore: () => setRightPaneCollapsed(false),
  };

  if (mobileStackEditor) {
    return <EditorFloatingTools variant="mobile" {...common} />;
  }

  if (wideEditorLayout) {
    return (
      <>
        <EditorFloatingHomeButton />
        <EditorFloatingTools variant="desktop" {...common} />
        {!rightPaneCollapsed ? <EditorNeonIconPanel {...props} /> : null}
      </>
    );
  }

  return <EditorNeonIconPanel {...props} />;
}
