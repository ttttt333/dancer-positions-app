import type { ChoreographyProjectJson, Cue } from "../types/choreography";
import { sortCuesByStart } from "../core/timelineController";

export type ViewerCueNavState = {
  cuesSorted: Cue[];
  cueIndex: number;
  cueCount: number;
  currentCue: Cue | null;
  canPrev: boolean;
  canNext: boolean;
  /** 表示用 1-based index（キュー未選択時は 0） */
  displayIndex: number;
};

/** 生徒閲覧: 名簿スロットを除いたキュー送り状態 */
export function computeViewerCueNavState(
  project: ChoreographyProjectJson,
  selectedCueId: string | null | undefined
): ViewerCueNavState {
  const cuesSorted = sortCuesByStart(project.cues);
  const cueCount = cuesSorted.length;
  if (cueCount === 0) {
    return {
      cuesSorted,
      cueIndex: -1,
      cueCount: 0,
      currentCue: null,
      canPrev: false,
      canNext: false,
      displayIndex: 0,
    };
  }
  let cueIndex = selectedCueId
    ? cuesSorted.findIndex((c) => c.id === selectedCueId)
    : 0;
  if (cueIndex < 0) cueIndex = 0;
  const currentCue = cuesSorted[cueIndex] ?? null;
  return {
    cuesSorted,
    cueIndex,
    cueCount,
    currentCue,
    canPrev: cueIndex > 0,
    canNext: cueIndex < cueCount - 1,
    displayIndex: cueIndex + 1,
  };
}
