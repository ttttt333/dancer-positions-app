import { useEffect } from "react";
import { playbackEngine } from "../core/playbackEngine";
import {
  seekPlaybackClampedAndSyncStore,
  togglePlaybackRespectingTrimStart,
} from "../lib/playbackTransport";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";

/** 再生中の ←/→ による相対シーク秒 */
export const KEYBOARD_SEEK_STEP_SEC = 5;

export type UseEditorKeyboardShortcutsArgs = {
  stageZenFullscreen: boolean;
  setStageZenFullscreen: (next: boolean) => void;
  cloudSaveDialogOpen: boolean;
  setCloudSaveDialogOpen: (open: boolean) => void;
  stageAreaSettingsOpen: boolean;
  onCloseStageAreaSettings: () => void;
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
  /** 停止中の ←/→ で前後キューへ（-1=前, +1=次） */
  onSelectAdjacentCue?: (direction: -1 | 1) => void;
  /** 再生中の相対シーク用（トリム／尺） */
  getSeekContext?: () => {
    durationSec: number;
    trimStartSec: number;
    trimEndSec: number | null;
  } | null;
};

/** Escape で各種モーダルを閉じ、Space で再生、←/→ でシークまたはキュー送り、⌘Z/⌘⇧Z で Undo/Redo。 */
export function useEditorKeyboardShortcuts({
  stageZenFullscreen,
  setStageZenFullscreen,
  cloudSaveDialogOpen,
  setCloudSaveDialogOpen,
  stageAreaSettingsOpen,
  onCloseStageAreaSettings,
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
  onSelectAdjacentCue,
  getSeekContext,
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
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      if (e.key === "Escape" && cloudSaveDialogOpen) {
        setCloudSaveDialogOpen(false);
        return;
      }
      if (e.key === "Escape" && stageAreaSettingsOpen) {
        onCloseStageAreaSettings();
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
        return;
      }

      // Alt+矢印はステージ上のダンサー微移動に任せる
      if (e.altKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey) return;

      e.preventDefault();
      const direction: -1 | 1 = e.key === "ArrowLeft" ? -1 : 1;
      const playing =
        usePlaybackUiStore.getState().isPlaying || !playbackEngine.isPaused();

      if (playing) {
        const ctx = getSeekContext?.();
        if (!ctx) return;
        const head = usePlaybackUiStore.getState().currentTimeSec;
        seekPlaybackClampedAndSyncStore({
          t: head + direction * KEYBOARD_SEEK_STEP_SEC,
          durationSec: ctx.durationSec,
          trimStartSec: ctx.trimStartSec,
          trimEndSec: ctx.trimEndSec,
        });
        return;
      }

      onSelectAdjacentCue?.(direction);
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
    onCloseStageAreaSettings,
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
    onSelectAdjacentCue,
    getSeekContext,
  ]);
}
