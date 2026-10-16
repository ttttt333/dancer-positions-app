import { useEffect, type MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";
import { sortCuesByStart } from "../core/timelineController";
import { pickCueAfterDelete } from "../lib/cueSelectionAfterDelete";
import {
  notifyFormationChosenWhenStopped,
  syncPlaybackHeadAfterCueEditWhenStopped,
} from "../lib/playbackTransport";
import type { ChoreographyProjectJson } from "../types/choreography";

type Params = {
  viewMode: ChoreographyProjectJson["viewMode"];
  selectedCueIdsRef: MutableRefObject<string[]>;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  onSelectedCueIdsChange: Dispatch<SetStateAction<string[]>>;
  durationRef: MutableRefObject<number>;
  onFormationChosenFromCueList?: () => void;
};

/** Delete / Backspace で選択中キューを削除（入力フォーカス時は無視） */
export function useTimelineDeleteSelectedCuesOnKey({
  viewMode,
  selectedCueIdsRef,
  setProject,
  onSelectedCueIdsChange,
  durationRef,
  onFormationChosenFromCueList,
}: Params) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (viewMode === "view") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (t instanceof HTMLElement && t.isContentEditable) return;
      const ids = selectedCueIdsRef.current;
      if (ids.length === 0) return;
      e.preventDefault();
      const idSet = new Set(ids);
      let nextSelected: string[] = [];
      let seekT: number | null = null;
      let trimStartSec = 0;
      let trimEndSec: number | null = null;
      setProject((p) => {
        const pick = pickCueAfterDelete(p.cues, idSet);
        nextSelected = pick ? [pick.id] : [];
        seekT = pick ? pick.tStartSec : null;
        trimStartSec = p.trimStartSec;
        trimEndSec = p.trimEndSec;
        return {
          ...p,
          cues: sortCuesByStart(p.cues.filter((c) => !idSet.has(c.id))),
          ...(pick ? { activeFormationId: pick.formationId } : {}),
        };
      });
      onSelectedCueIdsChange(nextSelected);
      if (seekT != null) {
        syncPlaybackHeadAfterCueEditWhenStopped({
          t: seekT,
          durationSec: durationRef.current,
          trimStartSec,
          trimEndSec,
        });
        notifyFormationChosenWhenStopped(onFormationChosenFromCueList);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    viewMode,
    setProject,
    onSelectedCueIdsChange,
    durationRef,
    onFormationChosenFromCueList,
  ]);
}
