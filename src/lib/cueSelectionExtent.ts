import type { Cue } from "../types/choreography";
import { sortCuesByStart } from "../core/timelineController";

/**
 * 選択枠の時間範囲: キュー本体 + 次キューまでの空白（移動区間）。
 * 最後のキューは tEnd まで。
 */
export function cueSelectionExtentSec(
  cue: Pick<Cue, "id" | "tStartSec" | "tEndSec">,
  cues: readonly Pick<Cue, "id" | "tStartSec" | "tEndSec">[],
  dragPreview?: { cueId: string; tStart: number; tEnd: number } | null
): { startSec: number; endSec: number; holdEndSec: number } {
  const sorted = sortCuesByStart(cues as Cue[]);
  const idx = sorted.findIndex((c) => c.id === cue.id);
  const self = sorted[idx] ?? cue;
  let start =
    dragPreview && dragPreview.cueId === self.id
      ? dragPreview.tStart
      : self.tStartSec;
  let holdEnd =
    dragPreview && dragPreview.cueId === self.id
      ? dragPreview.tEnd
      : self.tEndSec;
  if (start > holdEnd) {
    const t = start;
    start = holdEnd;
    holdEnd = t;
  }
  const next = idx >= 0 ? sorted[idx + 1] : undefined;
  let endSec = holdEnd;
  if (next) {
    const nextStart =
      dragPreview && dragPreview.cueId === next.id
        ? dragPreview.tStart
        : next.tStartSec;
    if (nextStart > holdEnd) endSec = nextStart;
  }
  return { startSec: start, endSec, holdEndSec: holdEnd };
}
