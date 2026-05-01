import { useMemo } from "react";
import { sortCuesByStart } from "../core/timelineController";
import type { ChoreographyProjectJson } from "../types/choreography";

/** 波形・キュー操作で共通利用する `project` の一部（時間順キューなど） */
export function useTimelinePanelProjectSlice(project: ChoreographyProjectJson) {
  const { cues, trimStartSec, trimEndSec, formations } = project;
  const cuesSorted = useMemo(() => sortCuesByStart(cues), [cues]);
  return { cuesSorted, trimStartSec, trimEndSec, formations };
}
