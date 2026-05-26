import { NeonIconPanel } from "../../components/NeonIconPanel";
import type { EditorLayoutProps } from "./editorLayoutProps";

export function EditorNeonIconPanel(props: EditorLayoutProps) {
  const choreoToolbarSharedProps = props.choreoToolbarSharedProps as Record<string, unknown>;
  const project = props.project as EditorLayoutProps["project"];
  const setProjectSafe = props.setProjectSafe as EditorLayoutProps["setProjectSafe"];
  const undo = props.undo as () => void;
  const redo = props.redo as () => void;
  const stageUndoDisabled = props.stageUndoDisabled as boolean;
  const stageRedoDisabled = props.stageRedoDisabled as boolean;
  const saveStageToFormationBox = props.saveStageToFormationBox as () => void;
  const setCueListModalOpen = props.setCueListModalOpen as (open: boolean) => void;
  const setAddCueDialogOpen = props.setAddCueDialogOpen as (open: boolean) => void;
  const setShareLinksOpen = props.setShareLinksOpen as (open: boolean) => void;
  const setAiSuggestOpen = props.setAiSuggestOpen as (open: boolean) => void;
  const stageView = props.stageView as "2d" | "3d";
  const floorTextPlaceSession = props.floorTextPlaceSession;
  const setFloorTextPlaceSession = props.setFloorTextPlaceSession as (v: unknown) => void;
  const setFloorTextSideSheetOpen = props.setFloorTextSideSheetOpen as (open: boolean) => void;
  const setEditorViewerSheetOpen = props.setEditorViewerSheetOpen as (open: boolean) => void;
  const setStageZenFullscreen = props.setStageZenFullscreen as (v: boolean) => void;
  const openAudioImport = props.openAudioImport as () => void;
  const setFlowLibraryOpen = props.setFlowLibraryOpen as (open: boolean) => void;
  const importCrewCsvFromStageToolbar = props.importCrewCsvFromStageToolbar as () => void;
  const addDancerFromStageToolbar = props.addDancerFromStageToolbar as () => void;
  const setMemberRosterSheetOpen = props.setMemberRosterSheetOpen as (open: boolean) => void;
  const setStageShapePickerOpen = props.setStageShapePickerOpen as (open: boolean) => void;
  const rightPaneCollapsed = props.rightPaneCollapsed as boolean;
  const wideEditorLayout = props.wideEditorLayout as boolean;
  const setRightPaneCollapsed = props.setRightPaneCollapsed as (
    v: boolean | ((prev: boolean) => boolean)
  ) => void;
  const setStageAreaSettingsOpen = props.setStageAreaSettingsOpen as (open: boolean) => void;
  const t = props.t as (key: string, params?: Record<string, string | number>) => string;

  return (
    <NeonIconPanel
      {...choreoToolbarSharedProps}
      stageGridLinesEnabled={
        (project.stageGridLinesVerticalEnabled ?? project.stageGridLinesEnabled ?? false) ||
        (project.stageGridLinesHorizontalEnabled ?? project.stageGridLinesEnabled ?? false)
      }
      onToggleStageGridLines={() => {
        const current =
          (project.stageGridLinesVerticalEnabled ?? project.stageGridLinesEnabled ?? false) ||
          (project.stageGridLinesHorizontalEnabled ?? project.stageGridLinesEnabled ?? false);
        const next = !current;
        setProjectSafe((p) => ({
          ...p,
          stageGridLinesVerticalEnabled: next,
          stageGridLinesHorizontalEnabled: next,
          stageGridLinesEnabled: next,
          snapGrid: next,
        }));
      }}
      snapGrid={project.snapGrid ?? false}
      onOpenStageShapePicker={() => setStageAreaSettingsOpen(true)}
      onUndo={undo}
      onRedo={redo}
      undoDisabled={stageUndoDisabled}
      redoDisabled={stageRedoDisabled}
      onSave={saveStageToFormationBox}
      onOpenCueList={() => setCueListModalOpen(true)}
      onOpenCueSettings={() => setAddCueDialogOpen(true)}
      onOpenShareLinks={() => setShareLinksOpen(true)}
      onOpenAISuggest={() => setAiSuggestOpen(true)}
      onOpenFloorText={() => {
        if (stageView !== "2d") {
          window.alert(t("editor.layout.floorText2dOnly"));
          return;
        }
        if (floorTextPlaceSession) {
          setFloorTextPlaceSession(null);
          setFloorTextSideSheetOpen(false);
        } else {
          setFloorTextPlaceSession({
            body: "",
            fontSizePx: 24,
            fontWeight: 700,
            xPct: 50,
            yPct: 50,
            color: "#fef08a",
          });
          setFloorTextSideSheetOpen(true);
        }
      }}
      onOpenViewMode={() => setEditorViewerSheetOpen(true)}
      onZoomStage={() => setStageZenFullscreen(true)}
      onOpenAudioImport={openAudioImport}
      onOpenLibrary={() => setFlowLibraryOpen(true)}
      onOpenRosterImport={importCrewCsvFromStageToolbar}
      onAddDancer={addDancerFromStageToolbar}
      onOpenRoster={() => setMemberRosterSheetOpen(true)}
      onOpenStageTransform={() => setStageShapePickerOpen(true)}
      collapsed={rightPaneCollapsed && wideEditorLayout}
      onCollapseToggle={
        wideEditorLayout ? () => setRightPaneCollapsed((v) => !v) : undefined
      }
    />
  );
}
