import { clusterSelectionColumns } from "../../../stageColumnSwap";
import type { StageConfig } from "../types/CueTypes";
import type { Point } from "../types/FormationTypes";
import { defaultSplitSizes } from "./geometry";

/**
 * Optional adapter around existing K-Means column clustering.
 * Used for SPLIT when a current formation exists — does not modify K-Means.
 */
export function splitSizesFromCurrent(
  current: Record<string, Point>,
  stage: StageConfig,
  dancerCount: number
): number[] | null {
  const ids = Object.keys(current).sort((a, b) => a.localeCompare(b));
  if (ids.length < 4) return null;
  const dancers = ids.map((id, index) => {
    const p = current[id]!;
    return {
      id,
      label: id,
      xPct: stage.width > 0 ? (p.x / stage.width) * 100 : 50,
      yPct: stage.depth > 0 ? (p.y / stage.depth) * 100 : 50,
      colorIndex: index % 8,
    };
  });
  const columns = clusterSelectionColumns(dancers, ids);
  if (columns.length < 2) return defaultSplitSizes(dancerCount);
  const sizes = columns.map((c) => c.members.length).filter((n) => n > 0);
  const total = sizes.reduce((s, n) => s + n, 0);
  if (total !== dancerCount) return defaultSplitSizes(dancerCount);
  return sizes;
}
