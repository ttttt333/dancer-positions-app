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

function dedupeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * 波形の赤枠。今の選択が残っていれば維持する。
 * 消したキューが選択だったときは、その直前（先頭を消したときは直後）へ移す。
 * どれも残らなければ空。削除が無く選択だけ空なら、残った先頭を選ぶ。
 */
export function resolveCueSelectionAfterListChange(args: {
  previousCues: readonly Cue[];
  previousSelectedIds: readonly string[];
  nextCues: readonly Cue[];
  nextSelectedIds: readonly string[];
}): string[] {
  const alive = new Set(args.nextCues.map((c) => c.id));
  if (args.nextCues.length === 0) return [];
  const valid = dedupeIds(args.nextSelectedIds.filter((id) => alive.has(id)));
  if (valid.length > 0) return valid;

  const removed = dedupeIds(
    args.previousSelectedIds.filter((id) => !alive.has(id))
  );
  if (removed.length > 0 && args.previousCues.length > 0) {
    const pick = pickCueAfterDelete(args.previousCues, new Set(removed));
    if (pick && alive.has(pick.id)) return [pick.id];
  }

  const first = sortCuesByStart([...args.nextCues])[0];
  return first ? [first.id] : [];
}
