import { useEffect } from "react";
import { togglePlaybackRespectingTrimStart } from "../lib/playbackTransport";

export type UseEditorKeyboardShortcutsArgs = {
  stageZenFullscreen: boolean;
  setStageZenFullscreen: (next: boolean) => void;
  cloudSaveDialogOpen: boolean;
  setCloudSaveDialogOpen: (open: boolean) => void;
  stageAreaSettingsOpen: boolean;
  setStageAreaSettingsOpen: (open: boolean) => void;
  stageSettingsOpen: boolean;
  setStageSettingsOpen: (open: boolean) => void;
  exportDialogOpen: boolean;
  setExportDialogOpen: (open: boolean) => void;
  flowLibraryOpen: boolean;
  setFlowLibraryOpen: (open: boolean) => void;
  cueListModalOpen: boolean;
  setCueListModalOpen: (open: boolean) => void;
  shortcutsHelpOpen: boolean;
  setShortcutsHelpOpen: (open: boolean) => void;
  rosterImportDraft: unknown;
  setRosterImportDraft: (draft: null) => void;
  setRosterImportExtraNames: (names: string[]) => void;
  undo: () => void;
  redo: () => void;
  getTrimStartSec: () => number;
};

/** Escape で各種モーダルを閉じ、Space で再生、⌘Z/⌘⇧Z で Undo/Redo。 */
export function useEditorKeyboardShortcuts({
  stageZenFullscreen,
  setStageZenFullscreen,
  cloudSaveDialogOpen,
  setCloudSaveDialogOpen,
  stageAreaSettingsOpen,
  setStageAreaSettingsOpen,
  stageSettingsOpen,
  setStageSettingsOpen,
  exportDialogOpen,
  setExportDialogOpen,
  flowLibraryOpen,
  setFlowLibraryOpen,
  cueListModalOpen,
  setCueListModalOpen,
  shortcutsHelpOpen,
  setShortcutsHelpOpen,
  rosterImportDraft,
  setRosterImportDraft,
  setRosterImportExtraNames,
  undo,
  redo,
  getTrimStartSec,
}: UseEditorKeyboardShortcutsArgs): void {
  useEffect(() => {
    if (!stageZenFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setStageZenFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stageZenFullscreen, setStageZenFullscreen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      if (e.key === "Escape" && cloudSaveDialogOpen) {
        setCloudSaveDialogOpen(false);
        return;
      }
      if (e.key === "Escape" && stageAreaSettingsOpen) {
        setStageAreaSettingsOpen(false);
        return;
      }
      if (e.key === "Escape" && stageSettingsOpen) {
        setStageSettingsOpen(false);
        return;
      }
      if (e.key === "Escape" && exportDialogOpen) {
        setExportDialogOpen(false);
        return;
      }
      if (e.key === "Escape" && flowLibraryOpen) {
        setFlowLibraryOpen(false);
        return;
      }
      if (e.key === "Escape" && cueListModalOpen) {
        setCueListModalOpen(false);
        return;
      }
      if (e.key === "Escape" && shortcutsHelpOpen) {
        setShortcutsHelpOpen(false);
        return;
      }
      if (e.key === "Escape" && rosterImportDraft) {
        setRosterImportDraft(null);
        setRosterImportExtraNames([]);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlaybackRespectingTrimStart(getTrimStartSec());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    redo,
    undo,
    getTrimStartSec,
    cloudSaveDialogOpen,
    setCloudSaveDialogOpen,
    stageAreaSettingsOpen,
    setStageAreaSettingsOpen,
    stageSettingsOpen,
    setStageSettingsOpen,
    shortcutsHelpOpen,
    setShortcutsHelpOpen,
    exportDialogOpen,
    setExportDialogOpen,
    flowLibraryOpen,
    setFlowLibraryOpen,
    rosterImportDraft,
    setRosterImportDraft,
    setRosterImportExtraNames,
    cueListModalOpen,
    setCueListModalOpen,
  ]);
}
