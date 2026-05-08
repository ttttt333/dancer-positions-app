import { useEffect, type MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";
import { sortCuesByStart } from "../core/timelineController";
import type { ChoreographyProjectJson } from "../types/choreography";

type Params = {
  viewMode: ChoreographyProjectJson["viewMode"];
  selectedCueIdsRef: MutableRefObject<string[]>;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  onSelectedCueIdsChange: Dispatch<SetStateAction<string[]>>;
};

/** Delete / Backspace で選択中キューを削除（入力フォーカス時は無視） */
export function useTimelineDeleteSelectedCuesOnKey({
  viewMode,
  selectedCueIdsRef,
  setProject,
  onSelectedCueIdsChange,
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
      setProject((p) => ({
        ...p,
        cues: sortCuesByStart(p.cues.filter((c) => !idSet.has(c.id))),
      }));
      onSelectedCueIdsChange([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, setProject, onSelectedCueIdsChange]);
}
