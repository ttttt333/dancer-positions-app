import type { ReactNode, CSSProperties, Dispatch, SetStateAction, MutableRefObject, RefObject } from "react";
import type { ChoreographyProjectJson, Cue, DancerSpot, Formation, StageFloorMarkup } from "../../types/choreography";
import type { EditorStageWorkbenchProps } from "../../components/EditorStageWorkbench";
import type { StagePresetItem } from "../../lib/stagePresets";
import type { StudentPick } from "../../components/ChoreoStudentViewGate";

/** Shared layout props passed from EditorPage to layout components. */
export type EditorLayoutProps = {
  [key: string]: unknown;
  mobileStackEditor: boolean;
  wideEditorLayout: boolean;
  choreoPublicView: boolean;
  project: ChoreographyProjectJson;
  setProjectSafe: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  timelinePanelEl: ReactNode;
  playbackAudioElement: ReactNode;
  exportDialogEl: ReactNode;
  flowLibraryDialogEl: ReactNode;
  addCueDialogEl: ReactNode;
  photoParseDialogEl: ReactNode;
  formationBoxManagerDialogEl: ReactNode;
  formationPresetPickerSheetEl: ReactNode;
  rosterImportSheetEl: ReactNode;
  stageWorkbenchProps: Omit<EditorStageWorkbenchProps, "layout">;
};
