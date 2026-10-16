import { sortCuesByStart } from "./cueInterval";
import type { Cue } from "../types/choreography";

/**
 * 削除後に選ぶキュー: 削除対象のうち最も早いキューの **直前**。
 * 直前が無ければ、残った先頭。何も残らなければ null。
 */
export function pickCueAfterDelete(
  cues: readonly Cue[],
  deletedIds: ReadonlySet<string>
): Cue | null {
  if (deletedIds.size === 0) return null;
  const sorted = sortCuesByStart([...cues]);
  const deleteIndices: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (deletedIds.has(sorted[i]!.id)) deleteIndices.push(i);
  }
  if (deleteIndices.length === 0) return null;

  const earliestIdx = Math.min(...deleteIndices);
  for (let i = earliestIdx - 1; i >= 0; i--) {
    const c = sorted[i]!;
    if (!deletedIds.has(c.id)) return c;
  }
  return sorted.find((c) => !deletedIds.has(c.id)) ?? null;
}
